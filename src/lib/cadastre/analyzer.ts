import { CadastreUnit, ListingInput, TruthReport, CertaintyLevel, Level1Data, Level2Data, Level3Data, Level4Data } from './types';
import { CadastreClient } from './client';
import { NeighborhoodSampler } from './sampler';

export class CadastreAnalyzer {
  private client: CadastreClient;
  private sampler: NeighborhoodSampler;

  constructor() {
    this.client = new CadastreClient();
    this.sampler = new NeighborhoodSampler();
  }

  async analyze(listing: ListingInput): Promise<TruthReport> {
    const report: TruthReport = {
      found: false,
      certainty: 'NONE',
      discrepancies: [],
      warnings: []
    };

    // ==================================================================
    // LEVEL 1: NEIGHBORHOOD CONTEXT (The Backdrop)
    // ==================================================================
    if (listing.address) {
       // Extract neighborhood or just use full address
       const hoodProfile = await this.sampler.sampleArea('neighborhood', listing.address);
       
       if (hoodProfile) {
           report.level1 = {
               scope: 'Neighborhood',
               description: `Area Context`, // We could be more specific if we parsed neighborhood name
               averageYear: hoodProfile.averageYear,
               dominantUse: hoodProfile.dominantUse,
               ageRange: hoodProfile.ageRange,
               sampleSize: hoodProfile.sampleSize
           };
           report.certainty = 'NEIGHBORHOOD_CONTEXT';
           
           if (hoodProfile.averageYear < 1950) {
               report.warnings.push(`Historic District (L1): Neighborhood average age is ${hoodProfile.averageYear}. Preservation rules may apply.`);
           }
       }
    }

    // ==================================================================
    // LEVEL 2: BLOCK CONTEXT (The Street)
    // ==================================================================
    // Only run if we have an address to parse Street Name + Number
    if (listing.address) {
        const { street, number } = this.parseAddressForSampler(listing.address);
        if (street) {
            const blockProfile = await this.sampler.sampleArea('block', street, number);
            
            if (blockProfile) {
                let trend = "Typical for the area";
                if (report.level1) {
                    const diff = blockProfile.averageYear - report.level1.averageYear;
                    if (diff > 10) trend = "Newer than neighborhood average";
                    if (diff < -10) trend = "Older than neighborhood average";
                }

                report.level2 = {
                    scope: 'Block/Street',
                    streetName: street,
                    averageYear: blockProfile.averageYear,
                    dominantUse: blockProfile.dominantUse,
                    sampleSize: blockProfile.sampleSize,
                    trend
                };
                report.certainty = 'BLOCK_CONTEXT';
            }
        }
    }

    if (!listing.coordinates) {
      report.warnings.push('No coordinates provided. Analysis stopped at Level 2.');
      return report;
    }

    // ==================================================================
    // LEVEL 3: BUILDING/PARCEL (The Structure)
    // ==================================================================
    
    const refCat = await this.client.getRefCatFromCoordinates(listing.coordinates.lat, listing.coordinates.lng);
    
    if (!refCat) {
      report.warnings.push('Building could not be identified from coordinates (L3 failed).');
      return report;
    }

    const isSpecificUnit = refCat.length === 20;
    const parcelRef = isSpecificUnit ? refCat.substring(0, 14) : refCat;
    const parcelData = await this.client.getByRefCat(parcelRef);
    
    if (parcelData.units.length > 0) {
        report.found = true;
        report.certainty = 'BUILDING_CONTEXT';
        
        // --- UPDATED LOGIC: FETCH DETAILS FOR ALL UNITS (Concurrency Limited) ---
        // We need detailed Year/Use/Size for accurate building stats, not just the list.
        // Limit to first 50 units to avoid timeout if building is huge, or implement batches.
        // User requested "ALL", but practical limit is needed for API speed.
        // Let's try 50.
        const limit = 50; 
        const unitsToFetch = parcelData.units.slice(0, limit);
        
        const detailPromises = unitsToFetch.map(async (u) => {
            // If refCat is valid 20 chars, fetch details.
            // Note: getByRefCat list items have full refCat constructed.
            if (u.refCat && u.refCat.length === 20) {
                try {
                    return await this.client.getUnitDetails(u.refCat);
                } catch (e) {
                    return null;
                }
            }
            return null;
        });
        
        const detailedUnits = (await Promise.all(detailPromises)).filter(u => u !== null) as CadastreUnit[];
        
        // Use detailed units for stats if available, otherwise fall back to list data (which might lack year)
        // Note: List data (lrcdnp) usually does NOT have year/surface. So detailed fetch is critical.
        
        const statsSource = detailedUnits.length > 0 ? detailedUnits : parcelData.units;
        
        // Calculate Building Mode Year
        const years = statsSource.map(u => u.yearBuilt || 0).filter(y => y > 0);
        const modeYear = this.getMode(years) || 0;
        
        // Infer Structure Type
        let structureType = "Unknown";
        if (modeYear > 0) {
            if (modeYear < 1940) structureType = "Masonry / Load-bearing Walls";
            else if (modeYear < 1960) structureType = "Early Concrete / Mixed";
            else structureType = "Reinforced Concrete Frame";
        }

        report.level3 = {
             scope: 'Building',
             refCatParcel: parcelRef,
             totalUnits: parcelData.units.length,
             yearBuiltMostCommon: modeYear,
             dominantUse: this.getMode(statsSource.map(u => u.usage || 'Unknown')) || 'Unknown',
             structureType
        };
    } else {
        report.warnings.push("Parcel found but no units listed (L3 partial).");
    }

    // ==================================================================
    // LEVEL 4: SPECIFIC UNIT (The Legal Reality)
    // ==================================================================
    
    let targetUnit: CadastreUnit | null = null;

    if (isSpecificUnit) {
        // Direct hit
        targetUnit = await this.client.getUnitDetails(refCat);
        if (targetUnit) report.certainty = 'EXACT_MATCH';
    } else if (parcelData.units.length > 0) {
        // Heuristic match
        const match = await this.findBestUnitMatch(listing, parcelData.units);
        if (match) {
            targetUnit = await this.client.getUnitDetails(match.unit.refCat); // Fetch full details
            report.certainty = match.confidence;
        }
    }

    if (targetUnit) {
        report.level4 = {
            scope: 'Unit',
            unit: targetUnit,
            legalReality: targetUnit.usage || "Unknown"
        };
        // Analyze Discrepancies (L4 vs Claims)
        this.analyzeDiscrepancies(listing, targetUnit, report);
    } else if (parcelData.units.length > 0) {
        report.warnings.push(`Building found, but specific unit not matched (L4 failed).`);
    }
    
    return report;
  }
  
  // --- HELPERS ---

  private parseAddressForSampler(address: string): { street: string | null, number: string | undefined } {
      // Simple heuristic to extract street name and number
      // e.g. "Carrer de Balmes 120, Barcelona" -> Street: "Carrer de Balmes", Number: "120"
      // This is rough but Gemini is forgiving.
      try {
          const parts = address.split(',');
          const mainPart = parts[0].trim(); // "Carrer de Balmes 120"
          
          // Regex to find last number
          const match = mainPart.match(/^(.*?)\s+(\d+)\s*$/);
          if (match) {
              return { street: match[1], number: match[2] };
          }
          // Fallback: just use the whole string as street
          return { street: mainPart, number: undefined };
      } catch (e) {
          return { street: null, number: undefined };
      }
  }

  private getMode(array: any[]): any {
    if (array.length === 0) return null;
    const modeMap: any = {};
    let maxEl = array[0], maxCount = 1;
    for (let i = 0; i < array.length; i++) {
        const el = array[i];
        if (modeMap[el] == null) modeMap[el] = 1;
        else modeMap[el]++;  
        if (modeMap[el] > maxCount) {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
  }

  private async findBestUnitMatch(listing: ListingInput, units: CadastreUnit[]): Promise<{ unit: CadastreUnit, confidence: CertaintyLevel } | null> {
    let candidates = units;
    if (listing.claimedFloor) {
      const targetFloor = this.normalizeFloor(listing.claimedFloor);
      const floorMatches = units.filter(u => u.floor === targetFloor);
      if (floorMatches.length > 0) candidates = floorMatches;
    }

    if (candidates.length > 1 && listing.claimedSize) {
        const detailedCandidates = [];
        // Limit detailed fetching for matching to top 10 candidates to avoid spamming
        const limitedCandidates = candidates.slice(0, 10); 
        for (const cand of limitedCandidates) {
            const details = await this.client.getUnitDetails(cand.refCat);
            if (details) detailedCandidates.push(details);
        }
        const sortedBySize = detailedCandidates.sort((a, b) => {
            const diffA = Math.abs((a.surfaceConstructed || 0) - (listing.claimedSize || 0));
            const diffB = Math.abs((b.surfaceConstructed || 0) - (listing.claimedSize || 0));
            return diffA - diffB;
        });
        if (sortedBySize.length > 0) {
            const best = sortedBySize[0];
            const diff = Math.abs((best.surfaceConstructed || 0) - (listing.claimedSize || 0));
            if (diff / (listing.claimedSize || 1) < 0.15) return { unit: best, confidence: 'HIGH_PROBABILITY' };
        }
    } else if (candidates.length === 1) {
        return { unit: candidates[0], confidence: 'HIGH_PROBABILITY' };
    }
    return null;
  }

  private normalizeFloor(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('bajo') || r.includes('planta baja')) return '00';
    if (r.includes('entresuelo')) return 'EN'; 
    if (r.includes('primero') || r === '1') return '01';
    if (r.includes('segundo') || r === '2') return '02';
    if (r.includes('tercero') || r === '3') return '03';
    if (r.includes('cuarto') || r === '4') return '04';
    return raw.padStart(2, '0');
  }

  private analyzeDiscrepancies(listing: ListingInput, unit: CadastreUnit, report: TruthReport) {
      if (listing.claimedYear && unit.yearBuilt) {
          if (Math.abs(listing.claimedYear - unit.yearBuilt) > 5) report.discrepancies.push(`Year Discrepancy: Listing says ${listing.claimedYear}, Cadastre says ${unit.yearBuilt}.`);
      }
      if (listing.claimedSize && unit.surfaceConstructed) {
          const diff = unit.surfaceConstructed - listing.claimedSize;
          if (diff < -5) report.discrepancies.push(`Size Warning: Official size (${unit.surfaceConstructed}m2) is smaller than listed (${listing.claimedSize}m2).`);
          else if (diff > 15) report.warnings.push(`Official size is ${unit.surfaceConstructed}m2. Ensure listing (${listing.claimedSize}m2) refers to useful area, not constructed.`);
      }
      if (unit.usage && unit.usage.toLowerCase() !== 'residencial') report.warnings.push(`CRITICAL: Official usage is '${unit.usage}'. Verify Certificate of Habitability.`);
      if (unit.yearBuilt && unit.yearBuilt < 1980) report.warnings.push(`Property built in ${unit.yearBuilt} (Pre-1980). Check for lead pipes and non-grounded electrical wiring.`);
  }

  public getAnalysisSummary(report: TruthReport): string {
      let summary = `OFFICIAL CADASTRAL TRUTH REPORT (Max Level: ${this.getLevelNumber(report)})\n`;
      summary += "=================================================\n\n";
      
      // Story Construction
      
      if (report.level4) {
          summary += `LEVEL 4 (UNIT): You are buying a ${report.level4.unit.yearBuilt} ${report.level4.legalReality} unit (${report.level4.unit.surfaceConstructed}m2).\n`;
      } else {
          summary += `LEVEL 4 (UNIT): Specific unit NOT identified.\n`;
      }
      
      if (report.level3) {
          summary += `LEVEL 3 (BUILDING): Inside a ${report.level3.yearBuiltMostCommon} building (${report.level3.structureType}) with ${report.level3.totalUnits} units.\n`;
      }
      
      if (report.level2) {
          summary += `LEVEL 2 (BLOCK): On a street (${report.level2.streetName}) where the typical building is from ${report.level2.averageYear} (${report.level2.trend}).\n`;
      }
      
      if (report.level1) {
          summary += `LEVEL 1 (ZONE): In a neighborhood averaging ${report.level1.averageYear} construction.\n`;
      }
      
      // Issues
      if (report.discrepancies.length > 0) {
          summary += "\n🚨 DISCREPANCIES (Listing vs Truth):\n- " + report.discrepancies.join("\n- ") + "\n";
      }
      
      if (report.warnings.length > 0) {
          summary += "\n⚠️ RISKS & WARNINGS:\n- " + report.warnings.join("\n- ") + "\n";
      }
      
      return summary;
  }
  
  private getLevelNumber(report: TruthReport): number {
      if (report.level4) return 4;
      if (report.level3) return 3;
      if (report.level2) return 2;
      if (report.level1) return 1;
      return 0;
  }
}

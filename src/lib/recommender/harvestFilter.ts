/**
 * Harvest Filter
 * 
 * Filters harvested listings from DynamoDB based on life profile.
 * Phase R3 of the Recommender system.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LifeProfile, SweetSpot } from '@/types/recommender';
import { generateSweetSpot, getSweetSpotLocations } from './sweetSpot';

// ============================================================================
// Types
// ============================================================================

export interface FilteredListing {
  domain: string;
  listing_id: string;
  url: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqm: number;
  city: string;
  region: string;
  address: string;
  image_urls: string[];
  lat?: number;
  lng?: number;
  status: string;
  first_seen: string;
  last_seen: string;
}

export interface FilterOptions {
  maxPrice?: number;
  minPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minSqm?: number;
  maxSqm?: number;
  locations?: string[];
  propertyTypes?: string[];
  limit?: number;
}

export interface FilterResult {
  listings: FilteredListing[];
  total: number;
  filters: FilterOptions;
  sweetSpot?: SweetSpot;
}

// ============================================================================
// DynamoDB Client
// ============================================================================

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Convert life profile to filter options
 */
export function profileToFilters(profile: LifeProfile): FilterOptions {
  return {
    maxPrice: profile.constraints.maxBudget,
    minBedrooms: profile.propertyPreferences.minBedrooms,
    minBathrooms: profile.propertyPreferences.minBathrooms,
    minSqm: profile.propertyPreferences.minSqm,
    locations: profile.propertyPreferences.preferredLocations,
    propertyTypes: profile.propertyPreferences.propertyTypes,
    limit: 100, // Default limit for shortlist
  };
}

/**
 * Check if listing matches filter criteria
 */
function matchesFilters(listing: any, filters: FilterOptions): boolean {
  // Price filter
  if (filters.maxPrice && listing.price && listing.price > filters.maxPrice) {
    return false;
  }
  if (filters.minPrice && listing.price && listing.price < filters.minPrice) {
    return false;
  }

  // Bedroom filter
  if (filters.minBedrooms && listing.bedrooms && listing.bedrooms < filters.minBedrooms) {
    return false;
  }

  // Bathroom filter
  if (filters.minBathrooms && listing.bathrooms && listing.bathrooms < filters.minBathrooms) {
    return false;
  }

  // Sqm filter
  if (filters.minSqm && listing.sqm && listing.sqm < filters.minSqm) {
    return false;
  }
  if (filters.maxSqm && listing.sqm && listing.sqm > filters.maxSqm) {
    return false;
  }

  // Location filter (case-insensitive partial match)
  if (filters.locations && filters.locations.length > 0) {
    const listingLocation = `${listing.city || ''} ${listing.region || ''} ${listing.address || ''}`.toLowerCase();
    const matchesLocation = filters.locations.some(loc => 
      listingLocation.includes(loc.toLowerCase())
    );
    if (!matchesLocation) {
      return false;
    }
  }

  // Status filter - only active listings
  if (listing.status && listing.status !== 'active') {
    return false;
  }

  return true;
}

/**
 * Filter listings from DynamoDB based on profile
 */
export async function filterListingsForProfile(
  profile: LifeProfile
): Promise<FilterResult> {
  console.log('[HarvestFilter] Starting filter for profile');

  // Generate sweet spot
  const sweetSpot = await generateSweetSpot(profile);
  
  // Get expanded location list from sweet spot
  const sweetSpotLocations = getSweetSpotLocations(sweetSpot);
  
  // Convert profile to filters, adding sweet spot locations
  const filters = profileToFilters(profile);
  filters.locations = [
    ...new Set([
      ...(filters.locations || []),
      ...sweetSpotLocations,
    ])
  ];

  console.log('[HarvestFilter] Filters:', {
    maxPrice: filters.maxPrice,
    minBedrooms: filters.minBedrooms,
    locations: filters.locations,
    limit: filters.limit,
  });

  // Query DynamoDB
  const listings = await filterListings(filters);

  return {
    listings,
    total: listings.length,
    filters,
    sweetSpot,
  };
}

/**
 * Filter listings from DynamoDB
 */
export async function filterListings(filters: FilterOptions): Promise<FilteredListing[]> {
  const client = getDocClient();
  const allListings: FilteredListing[] = [];
  let lastEvaluatedKey: any = undefined;
  let scanned = 0;
  const maxScan = 10000; // Limit total scan to avoid runaway costs

  console.log('[HarvestFilter] Scanning leo-listings table');

  try {
    // Use scan with filter expression
    // Note: In production, we'd use GSIs for better performance
    do {
      const command = new ScanCommand({
        TableName: 'leo-listings',
        FilterExpression: buildFilterExpression(filters),
        ExpressionAttributeNames: buildExpressionAttributeNames(filters),
        ExpressionAttributeValues: buildExpressionAttributeValues(filters),
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 1000, // Batch size
      });

      const response = await client.send(command);
      
      if (response.Items) {
        for (const item of response.Items) {
          // Double-check with in-memory filter (for complex logic)
          if (matchesFilters(item, filters)) {
            allListings.push(item as FilteredListing);
            
            // Stop if we have enough
            if (allListings.length >= (filters.limit || 100)) {
              break;
            }
          }
        }
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
      scanned += response.Items?.length || 0;
      
      console.log(`[HarvestFilter] Scanned ${scanned}, found ${allListings.length}`);

    } while (
      lastEvaluatedKey && 
      allListings.length < (filters.limit || 100) &&
      scanned < maxScan
    );

  } catch (error: any) {
    console.error('[HarvestFilter] DynamoDB error:', error.message);
    
    // Fallback: return empty array if DynamoDB fails
    // In production, we'd want better error handling
    return [];
  }

  console.log(`[HarvestFilter] Completed. Found ${allListings.length} listings`);
  return allListings;
}

// ============================================================================
// DynamoDB Expression Builders
// ============================================================================

function buildFilterExpression(filters: FilterOptions): string {
  const conditions: string[] = [];

  // Price conditions
  if (filters.maxPrice) {
    conditions.push('(attribute_not_exists(price) OR price <= :maxPrice)');
  }
  if (filters.minPrice) {
    conditions.push('(attribute_not_exists(price) OR price >= :minPrice)');
  }

  // Bedroom conditions
  if (filters.minBedrooms) {
    conditions.push('(attribute_not_exists(bedrooms) OR bedrooms >= :minBedrooms)');
  }

  // Bathroom conditions
  if (filters.minBathrooms) {
    conditions.push('(attribute_not_exists(bathrooms) OR bathrooms >= :minBathrooms)');
  }

  // Sqm conditions
  if (filters.minSqm) {
    conditions.push('(attribute_not_exists(sqm) OR sqm >= :minSqm)');
  }

  // Status = active
  conditions.push('(attribute_not_exists(#status) OR #status = :activeStatus)');

  return conditions.length > 0 ? conditions.join(' AND ') : undefined as any;
}

function buildExpressionAttributeNames(filters: FilterOptions): Record<string, string> {
  return {
    '#status': 'status',
  };
}

function buildExpressionAttributeValues(filters: FilterOptions): Record<string, any> {
  const values: Record<string, any> = {
    ':activeStatus': 'active',
  };

  if (filters.maxPrice) values[':maxPrice'] = filters.maxPrice;
  if (filters.minPrice) values[':minPrice'] = filters.minPrice;
  if (filters.minBedrooms) values[':minBedrooms'] = filters.minBedrooms;
  if (filters.minBathrooms) values[':minBathrooms'] = filters.minBathrooms;
  if (filters.minSqm) values[':minSqm'] = filters.minSqm;

  return values;
}

// ============================================================================
// Test Function
// ============================================================================

export async function testFilter(): Promise<void> {
  console.log('=== Testing Harvest Filter ===\n');

  // Mock profile
  const mockProfile: LifeProfile = {
    household: {
      adults: 2,
      children: [{ age: 5 }],
      pets: [{ type: 'dog', size: 'medium' }],
      workSituation: 'hybrid',
    },
    lifestyle: {
      morningRoutine: 'Coffee on balcony',
      eveningRoutine: 'Family dinner',
      weekendActivities: ['hiking', 'parks'],
      dealbreakers: ['no natural light', 'street noise'],
      mustHaves: ['terraza', 'parking'],
    },
    constraints: {
      maxBudget: 500000,
      maxCommuteMinutes: 30,
      commuteDestination: 'Paseo de la Castellana',
      moveInDate: null,
      renovationAppetite: 'cosmetic',
    },
    tradeoffs: {
      spaceVsLocation: -2,
      newVsCharacter: 0,
      quietVsVibrant: -3,
      viewsVsPrivacy: 0,
    },
    propertyPreferences: {
      propertyTypes: ['piso', 'casa'],
      minBedrooms: 3,
      minBathrooms: 2,
      minSqm: 100,
      preferredLocations: ['Chamartín', 'Hortaleza'],
      avoidLocations: ['Centro'],
    },
    intakeCompleted: true,
    intakeStep: 6,
  };

  const result = await filterListingsForProfile(mockProfile);
  
  console.log('\n=== Filter Result ===');
  console.log(`Total listings: ${result.total}`);
  console.log(`Sweet spot primary: ${result.sweetSpot?.primary.map(l => l.name).join(', ')}`);
  console.log(`\nSample listings:`);
  result.listings.slice(0, 5).forEach(l => {
    console.log(`  - ${l.title || 'No title'} | ${l.price}€ | ${l.sqm}m² | ${l.city}`);
  });
}


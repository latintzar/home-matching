/**
 * Phase Cache System
 * 
 * Exports each pipeline phase to files for debugging and testing.
 * Allows loading cached results to skip expensive LLM calls during development.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface PhaseCache {
  listingId: string;
  phase: string;
  timestamp: number;
  data: any;
  metadata: {
    inputSize: number;
    outputSize: number;
    duration: number;
    success: boolean;
    error?: string;
  };
}

export class PhaseCacheManager {
  private cacheDir: string;

  constructor(cacheDir = './pipeline_cache') {
    this.cacheDir = cacheDir;
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
  }

  /**
   * Save a phase result to cache
   */
  savePhase(listingId: string, phase: string, data: any, metadata: Partial<PhaseCache['metadata']> = {}): void {
    const cache: PhaseCache = {
      listingId,
      phase,
      timestamp: Date.now(),
      data,
      metadata: {
        inputSize: JSON.stringify(data).length,
        outputSize: JSON.stringify(data).length,
        duration: 0,
        success: true,
        ...metadata
      }
    };

    const filename = `${listingId}_${phase}.json`;
    const filepath = join(this.cacheDir, filename);
    
    try {
      writeFileSync(filepath, JSON.stringify(cache, null, 2));
      console.log(`💾 Cached ${phase} for ${listingId} to ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to cache ${phase}:`, error);
    }
  }

  /**
   * Load a cached phase result
   */
  loadPhase(listingId: string, phase: string): PhaseCache | null {
    const filename = `${listingId}_${phase}.json`;
    const filepath = join(this.cacheDir, filename);
    
    if (!existsSync(filepath)) {
      return null;
    }

    try {
      const content = readFileSync(filepath, 'utf-8');
      const cache = JSON.parse(content) as PhaseCache;
      console.log(`📂 Loaded cached ${phase} for ${listingId}`);
      return cache;
    } catch (error) {
      console.error(`❌ Failed to load cached ${phase}:`, error);
      return null;
    }
  }

  /**
   * Check if a phase is cached
   */
  isCached(listingId: string, phase: string): boolean {
    const filename = `${listingId}_${phase}.json`;
    const filepath = join(this.cacheDir, filename);
    return existsSync(filepath);
  }

  /**
   * List all cached phases for a listing
   */
  listCachedPhases(listingId: string): string[] {
    const phases: string[] = [];
    try {
      const files = require('fs').readdirSync(this.cacheDir);
      files.forEach((file: string) => {
        if (file.startsWith(`${listingId}_`) && file.endsWith('.json')) {
          const phase = file.replace(`${listingId}_`, '').replace('.json', '');
          phases.push(phase);
        }
      });
    } catch (error) {
      console.error(`❌ Failed to list cached phases:`, error);
    }
    return phases;
  }

  /**
   * Clear cache for a listing
   */
  clearCache(listingId: string): void {
    try {
      const files = require('fs').readdirSync(this.cacheDir);
      files.forEach((file: string) => {
        if (file.startsWith(`${listingId}_`)) {
          const filepath = join(this.cacheDir, file);
          require('fs').unlinkSync(filepath);
        }
      });
      console.log(`🗑️ Cleared cache for ${listingId}`);
    } catch (error) {
      console.error(`❌ Failed to clear cache:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalFiles: number; totalSize: number; listings: string[] } {
    try {
      const files = require('fs').readdirSync(this.cacheDir);
      const listings = new Set<string>();
      let totalSize = 0;

      files.forEach((file: string) => {
        if (file.endsWith('.json')) {
          const filepath = join(this.cacheDir, file);
          const stats = require('fs').statSync(filepath);
          totalSize += stats.size;
          
          const listingId = file.split('_')[0];
          listings.add(listingId);
        }
      });

      return {
        totalFiles: files.length,
        totalSize,
        listings: Array.from(listings)
      };
    } catch (error) {
      console.error(`❌ Failed to get cache stats:`, error);
      return { totalFiles: 0, totalSize: 0, listings: [] };
    }
  }

  /**
   * Export phase data for testing with detailed metadata
   */
  exportPhaseForTesting(listingId: string, phase: string, data: any, validationResults?: any): void {
    const testDir = './pipeline_test_results';
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    const exportData = {
      listingId,
      phase,
      timestamp: new Date().toISOString(),
      data,
      validation: validationResults || null,
      metadata: {
        inputSize: JSON.stringify(data).length,
        outputSize: JSON.stringify(data).length,
        success: !validationResults?.errors?.length
      }
    };

    const filename = `${listingId}_${phase}_test.json`;
    const filepath = join(testDir, filename);
    
    try {
      writeFileSync(filepath, JSON.stringify(exportData, null, 2));
      console.log(`📤 Exported ${phase} test data to ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to export ${phase} test data:`, error);
    }
  }

  /**
   * Load test phase data
   */
  loadTestPhase(listingId: string, phase: string): any | null {
    const testDir = './pipeline_test_results';
    const filename = `${listingId}_${phase}_test.json`;
    const filepath = join(testDir, filename);
    
    if (!existsSync(filepath)) {
      return null;
    }

    try {
      const content = readFileSync(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to load test phase ${phase}:`, error);
      return null;
    }
  }
}

// Global cache manager instance
export const phaseCache = new PhaseCacheManager();

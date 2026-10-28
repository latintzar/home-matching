/**
 * Harvest Run Analytics & Memory Logging
 * 
 * Provides:
 * - Memory usage logging at checkpoints
 * - Run summary recording to DynamoDB (leo-harvest-stats)
 * - Structured analytics for monitoring harvest health
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);

const STATS_TABLE = 'leo-harvest-stats';

// ============================================================
// MEMORY LOGGING
// ============================================================

export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

let peakMemory: MemorySnapshot = { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };

/**
 * Log current memory usage with a label
 * Also tracks peak memory for run summary
 */
export function logMemory(label: string): MemorySnapshot {
  const mem = process.memoryUsage();
  const snapshot: MemorySnapshot = {
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
    rss: Math.round(mem.rss / 1024 / 1024),
  };
  
  // Track peak
  if (snapshot.heapUsed > peakMemory.heapUsed) {
    peakMemory = snapshot;
  }
  
  console.log(`📊 Memory [${label}]: ${snapshot.heapUsed}MB heap / ${snapshot.rss}MB RSS`);
  return snapshot;
}

/**
 * Get peak memory recorded during this run
 */
export function getPeakMemory(): MemorySnapshot {
  return peakMemory;
}

/**
 * Reset peak memory tracking (call at start of new run)
 */
export function resetPeakMemory(): void {
  peakMemory = { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
}

// ============================================================
// RUN ANALYTICS
// ============================================================

export type RunStatus = 
  | 'started'
  | 'discovery_timeout'
  | 'discovery_complete'
  | 'enrichment_timeout'
  | 'enrichment_complete'
  | 'complete'
  | 'error';

export interface RunSummary {
  domain: string;
  timestamp: string;
  harvester_version: string;
  invocation: number;
  max_invocations: number;
  phase: string;
  status: RunStatus;
  duration_sec: number;
  memory_peak_mb: number;
  memory_limit_mb: number;
  scrapfly_credits?: number;
  listings_discovered?: number;
  listings_enriched?: number;
  listings_written?: number;
  listings_new?: number;
  listings_updated?: number;
  listings_removed?: number;
  error_message?: string;
  // Category progress (for E&V style harvesters)
  category_progress?: {
    [key: string]: {
      visited: number;
      pending: number;
      hitCutoff: boolean;
      fullyExplored: boolean;
    };
  };
  // Data quality stats (for diagnostics)
  listings_by_type?: {
    sale: number;
    rent: number;
    unknown: number;
  };
  listings_by_precision?: {
    precise: number;
    approximate: number;
    city_center: number;
    unknown: number;
  };
}

/**
 * Write run summary to DynamoDB leo-harvest-stats table
 */
export async function writeRunSummary(summary: RunSummary): Promise<void> {
  try {
    // Generate unique stat_id: domain#timestamp (e.g., "engelvoelkers.com#2025-12-10T12:00:00.000Z")
    const statId = `${summary.domain}#${summary.timestamp}`;
    
    // Destructure to avoid duplicate keys when spreading
    const { domain, timestamp, ...restSummary } = summary;
    
    await dynamoClient.send(new PutCommand({
      TableName: STATS_TABLE,
      Item: {
        stat_id: statId,  // Required partition key
        domain,
        timestamp,
        // Store as ISO string for sorting
        run_date: timestamp.split('T')[0],
        ...restSummary,
      },
    }));
    
    console.log('');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('📈 RUN SUMMARY RECORDED');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`   Domain: ${summary.domain}`);
    console.log(`   Status: ${summary.status}`);
    console.log(`   Duration: ${summary.duration_sec}s`);
    console.log(`   Memory peak: ${summary.memory_peak_mb}MB / ${summary.memory_limit_mb}MB`);
    if (summary.scrapfly_credits) {
      console.log(`   ScrapFly credits: ${summary.scrapfly_credits}`);
    }
    if (summary.listings_discovered !== undefined) {
      console.log(`   Discovered: ${summary.listings_discovered}`);
    }
    if (summary.listings_written !== undefined) {
      console.log(`   Written to DB: ${summary.listings_written} (${summary.listings_new} new, ${summary.listings_updated} updated)`);
    }
    if (summary.listings_by_type) {
      console.log(`   By Type: ${summary.listings_by_type.sale} sale, ${summary.listings_by_type.rent} rent, ${summary.listings_by_type.unknown} unknown`);
    }
    if (summary.listings_by_precision) {
      const p = summary.listings_by_precision;
      console.log(`   By Precision: ${p.precise} precise, ${p.approximate} approx, ${p.city_center} city, ${p.unknown} unknown`);
    }
    console.log('════════════════════════════════════════════════════════════════');
  } catch (err: any) {
    console.error(`⚠️ Failed to write run summary: ${err.message}`);
    // Don't throw - analytics shouldn't break the harvest
  }
}

/**
 * Helper to create a run summary with common fields
 */
export function createRunSummary(
  domain: string,
  harvesterVersion: string,
  invocation: number,
  maxInvocations: number,
  phase: string,
  status: RunStatus,
  startTime: number,
  memoryLimitMb: number
): RunSummary {
  return {
    domain,
    timestamp: new Date().toISOString(),
    harvester_version: harvesterVersion,
    invocation,
    max_invocations: maxInvocations,
    phase,
    status,
    duration_sec: Math.round((Date.now() - startTime) / 1000),
    memory_peak_mb: getPeakMemory().heapUsed,
    memory_limit_mb: memoryLimitMb,
  };
}

// ============================================================
// SAVE GAME LOGGING
// ============================================================

/**
 * Log a detailed "SAVE GAME" block on timeout
 * Shows progress so users know exactly where the harvester stopped
 */
export function logSaveGame(
  phase: string,
  invocation: number,
  maxInvocations: number,
  progress: Record<string, string | number>
): void {
  console.log('');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`💾 SAVE GAME - ${phase}`);
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`   Invocation: ${invocation}/${maxInvocations}`);
  console.log('   Progress:');
  for (const [key, value] of Object.entries(progress)) {
    console.log(`      ${key}: ${value}`);
  }
  console.log('════════════════════════════════════════════════════════════════');
  console.log('   Next scheduled run will continue from here.');
  console.log('════════════════════════════════════════════════════════════════');
  logMemory('TIMEOUT_CHECKPOINT');
}

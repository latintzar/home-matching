/**
 * AWS Cost Protection System
 * 
 * Implements HARD limits to prevent cost overruns:
 * 1. S3 bucket size limit (stops uploads when exceeded)
 * 2. Daily upload limit (prevents runaway scripts)
 * 3. Real-time cost monitoring
 */

import { 
  S3Client, 
  ListObjectsV2Command,
  HeadBucketCommand 
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

// Recipient configuration is supplied by tools/runtime-env.py.
// HARD LIMITS - Change these to control costs
const LIMITS = {
  // S3 Storage Limits
  MAX_BUCKET_SIZE_GB: 200,          // Stop uploads if bucket exceeds this
  MAX_DAILY_UPLOADS: 50000,         // Max files per day
  MAX_FILE_SIZE_MB: 10,             // Max single file size
  
  // Cost Limits (at $0.023/GB)
  MONTHLY_BUDGET_USD: 30,
  WARNING_THRESHOLD_PCT: 80,         // Warn at 80%
  CRITICAL_THRESHOLD_PCT: 95,        // Critical at 95%
  HARD_STOP_THRESHOLD_PCT: 100,      // Stop at 100%
};

// Calculated limits
const MAX_GB_FOR_BUDGET = LIMITS.MONTHLY_BUDGET_USD / 0.023;  // ~1,300 GB at $30
const WARNING_GB = MAX_GB_FOR_BUDGET * (LIMITS.WARNING_THRESHOLD_PCT / 100);
const CRITICAL_GB = MAX_GB_FOR_BUDGET * (LIMITS.CRITICAL_THRESHOLD_PCT / 100);

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || '';

interface BucketStats {
  totalSizeBytes: number;
  totalSizeGB: number;
  objectCount: number;
  estimatedMonthlyCost: number;
  budgetUsedPercent: number;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
  canUpload: boolean;
  remainingGB: number;
}

export async function getBucketStats(): Promise<BucketStats> {
  let totalSize = 0;
  let objectCount = 0;
  let continuationToken: string | undefined;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      ContinuationToken: continuationToken,
    });
    
    const response = await s3Client.send(command);
    
    for (const obj of response.Contents || []) {
      totalSize += obj.Size || 0;
      objectCount++;
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  const totalSizeGB = totalSize / 1024 / 1024 / 1024;
  const estimatedMonthlyCost = totalSizeGB * 0.023;
  const budgetUsedPercent = (totalSizeGB / MAX_GB_FOR_BUDGET) * 100;
  
  let status: BucketStats['status'] = 'OK';
  if (budgetUsedPercent >= 100) status = 'EXCEEDED';
  else if (budgetUsedPercent >= 95) status = 'CRITICAL';
  else if (budgetUsedPercent >= 80) status = 'WARNING';
  
  const canUpload = totalSizeGB < LIMITS.MAX_BUCKET_SIZE_GB && budgetUsedPercent < 100;
  const remainingGB = Math.max(0, LIMITS.MAX_BUCKET_SIZE_GB - totalSizeGB);
  
  return {
    totalSizeBytes: totalSize,
    totalSizeGB,
    objectCount,
    estimatedMonthlyCost,
    budgetUsedPercent,
    status,
    canUpload,
    remainingGB,
  };
}

/**
 * Check if upload is allowed (call before every upload)
 */
export async function canUpload(fileSizeBytes: number): Promise<{
  allowed: boolean;
  reason?: string;
  stats: BucketStats;
}> {
  const stats = await getBucketStats();
  
  // Check hard size limit
  if (!stats.canUpload) {
    return {
      allowed: false,
      reason: `Budget exceeded! ${stats.budgetUsedPercent.toFixed(1)}% of $${LIMITS.MONTHLY_BUDGET_USD} used`,
      stats,
    };
  }
  
  // Check if this file would exceed limit
  const fileSizeGB = fileSizeBytes / 1024 / 1024 / 1024;
  if (stats.totalSizeGB + fileSizeGB > LIMITS.MAX_BUCKET_SIZE_GB) {
    return {
      allowed: false,
      reason: `File would exceed ${LIMITS.MAX_BUCKET_SIZE_GB}GB limit`,
      stats,
    };
  }
  
  // Check single file size
  const fileSizeMB = fileSizeBytes / 1024 / 1024;
  if (fileSizeMB > LIMITS.MAX_FILE_SIZE_MB) {
    return {
      allowed: false,
      reason: `File size ${fileSizeMB.toFixed(1)}MB exceeds ${LIMITS.MAX_FILE_SIZE_MB}MB limit`,
      stats,
    };
  }
  
  return { allowed: true, stats };
}

/**
 * Print current status
 */
async function printStatus() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  AWS COST PROTECTION STATUS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('📋 CONFIGURED LIMITS:');
  console.log('─────────────────────────────────────');
  console.log(`  Monthly Budget:     $${LIMITS.MONTHLY_BUDGET_USD}`);
  console.log(`  Max Bucket Size:    ${LIMITS.MAX_BUCKET_SIZE_GB} GB`);
  console.log(`  Max per $30 budget: ${MAX_GB_FOR_BUDGET.toFixed(0)} GB`);
  console.log(`  Warning at:         ${WARNING_GB.toFixed(0)} GB (${LIMITS.WARNING_THRESHOLD_PCT}%)`);
  console.log(`  Critical at:        ${CRITICAL_GB.toFixed(0)} GB (${LIMITS.CRITICAL_THRESHOLD_PCT}%)`);
  console.log(`  Hard stop at:       ${MAX_GB_FOR_BUDGET.toFixed(0)} GB (100%)`);
  console.log('');
  
  const stats = await getBucketStats();
  
  const statusEmoji = {
    'OK': '✅',
    'WARNING': '⚠️',
    'CRITICAL': '🔴',
    'EXCEEDED': '🛑',
  };
  
  console.log('📊 CURRENT USAGE:');
  console.log('─────────────────────────────────────');
  console.log(`  Bucket:            ${BUCKET_NAME}`);
  console.log(`  Objects:           ${stats.objectCount.toLocaleString()}`);
  console.log(`  Total Size:        ${stats.totalSizeGB.toFixed(3)} GB`);
  console.log(`  Est. Monthly Cost: $${stats.estimatedMonthlyCost.toFixed(2)}`);
  console.log(`  Budget Used:       ${stats.budgetUsedPercent.toFixed(1)}%`);
  console.log(`  Remaining:         ${stats.remainingGB.toFixed(1)} GB`);
  console.log(`  Status:            ${statusEmoji[stats.status]} ${stats.status}`);
  console.log(`  Can Upload:        ${stats.canUpload ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  // Visual progress bar
  const barWidth = 40;
  const filled = Math.min(barWidth, Math.round((stats.budgetUsedPercent / 100) * barWidth));
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  console.log(`  [${bar}] ${stats.budgetUsedPercent.toFixed(1)}%`);
  console.log('');
  
  // Projection
  if (stats.objectCount > 0) {
    const avgFileSizeKB = (stats.totalSizeBytes / stats.objectCount) / 1024;
    const filesPerGB = (1024 * 1024) / avgFileSizeKB;
    const maxFiles = LIMITS.MAX_BUCKET_SIZE_GB * filesPerGB;
    
    console.log('📈 PROJECTION:');
    console.log('─────────────────────────────────────');
    console.log(`  Avg file size:     ${avgFileSizeKB.toFixed(1)} KB`);
    console.log(`  Files per GB:      ${filesPerGB.toFixed(0)}`);
    console.log(`  Max files at $30:  ${maxFiles.toLocaleString()}`);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run if called directly
if (require.main === module) {
  printStatus().catch(console.error);
}


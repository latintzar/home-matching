/**
 * Harvest Monitor Lambda
 * 
 * Daily health check for the harvesting pipeline. Detects issues like:
 * - Missing or stale data
 * - Count anomalies (sudden drops)
 * - Harvester failures
 * - Export issues
 * 
 * Schedule: Daily at 8 AM UTC (after morning harvest cycle)
 * 
 * Reports via CloudWatch Logs with structured diagnostics.
 * Can be extended to send alerts via SNS, Slack, etc.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);
const s3Client = new S3Client({ region: REGION });
const cwClient = new CloudWatchClient({ region: REGION });

const TABLE_NAME = 'leo-listings';
const STATS_TABLE = 'leo-harvest-stats';
const BUCKET_NAME = 'puedo-casa-html-archive';
const EXPORT_KEY = 'catalogue/listings.json.gz';

// Expected minimums per domain (alert if below)
const DOMAIN_THRESHOLDS: Record<string, { min: number; name: string }> = {
  'tecnocasa.es': { min: 5000, name: 'Tecnocasa' },
  'century21.es': { min: 10000, name: 'Century 21' },
  'lucasfox.com': { min: 4000, name: 'Lucas Fox' },
  'remax.es': { min: 5000, name: 'RE/MAX' },
  'engelvoelkers.com': { min: 100, name: 'Engel & Völkers' },
  'donpiso.com': { min: 200, name: 'donpiso' },
  'aproperties.es': { min: 1000, name: 'aProperties' },
};

interface DomainHealth {
  domain: string;
  name: string;
  count: number;
  threshold: number;
  status: 'ok' | 'warning' | 'critical';
  recentCount: number;  // Listings added in last 24h
  oldestListing?: string;
  newestListing?: string;
}

interface MonitorReport {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  totalListings: number;
  exportStatus: 'ok' | 'stale' | 'missing';
  exportAge?: number;  // Hours since last export
  domains: DomainHealth[];
  issues: string[];
  recommendations: string[];
}

async function getDomainCount(domain: string): Promise<number> {
  let total = 0;
  let lastKey: Record<string, any> | undefined;
  
  do {
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#d = :domain',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { ':domain': domain },
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    
    total += response.Count || 0;
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);
  
  return total;
}

async function getRecentCount(domain: string, hoursAgo: number = 24): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hoursAgo);
  const cutoffStr = cutoff.toISOString();
  
  let total = 0;
  let lastKey: Record<string, any> | undefined;
  
  do {
    const response = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#d = :domain',
      FilterExpression: 'updated_at >= :cutoff',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExpressionAttributeValues: { 
        ':domain': domain,
        ':cutoff': cutoffStr,
      },
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    
    total += response.Count || 0;
    lastKey = response.LastEvaluatedKey;
  } while (lastKey);
  
  return total;
}

async function checkExportStatus(): Promise<{ status: 'ok' | 'stale' | 'missing'; ageHours?: number; size?: number }> {
  try {
    const head = await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: EXPORT_KEY,
    }));
    
    const lastModified = head.LastModified;
    if (!lastModified) {
      return { status: 'missing' };
    }
    
    const ageMs = Date.now() - lastModified.getTime();
    const ageHours = Math.round(ageMs / (1000 * 60 * 60));
    
    // Consider stale if older than 12 hours (should export 3x daily)
    const status = ageHours > 12 ? 'stale' : 'ok';
    
    return { 
      status, 
      ageHours,
      size: head.ContentLength,
    };
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return { status: 'missing' };
    }
    throw error;
  }
}

async function getHarvesterStats(): Promise<Record<string, any>> {
  try {
    const response = await dynamoClient.send(new GetCommand({
      TableName: STATS_TABLE,
      Key: { stat_id: 'catalogue_summary' },
    }));
    return response.Item || {};
  } catch {
    return {};
  }
}

async function publishMetrics(report: MonitorReport): Promise<void> {
  const metrics = [
    {
      MetricName: 'TotalListings',
      Value: report.totalListings,
      Unit: 'Count' as const,
    },
    {
      MetricName: 'HealthStatus',
      Value: report.overall === 'healthy' ? 1 : report.overall === 'degraded' ? 0.5 : 0,
      Unit: 'None' as const,
    },
    {
      MetricName: 'IssueCount',
      Value: report.issues.length,
      Unit: 'Count' as const,
    },
  ];
  
  // Add per-domain metrics
  for (const domain of report.domains) {
    metrics.push({
      MetricName: 'DomainListings',
      Value: domain.count,
      Unit: 'Count' as const,
      // Note: Would need Dimensions for domain-specific metrics in real implementation
    });
  }
  
  await cwClient.send(new PutMetricDataCommand({
    Namespace: 'PuedoCasa/Harvesters',
    MetricData: metrics.map(m => ({
      ...m,
      Timestamp: new Date(),
    })),
  }));
}

export const handler = async (event: any): Promise<any> => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  HARVEST MONITOR - Daily Health Check');
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  const report: MonitorReport = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    totalListings: 0,
    exportStatus: 'ok',
    domains: [],
    issues: [],
    recommendations: [],
  };
  
  // 1. Check each domain
  console.log('\n--- Domain Health Check ---');
  for (const [domain, config] of Object.entries(DOMAIN_THRESHOLDS)) {
    const count = await getDomainCount(domain);
    const recentCount = await getRecentCount(domain, 24);
    
    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (count < config.min * 0.5) {
      status = 'critical';
      report.issues.push(`CRITICAL: ${config.name} has only ${count} listings (min: ${config.min})`);
    } else if (count < config.min) {
      status = 'warning';
      report.issues.push(`WARNING: ${config.name} has ${count} listings (below threshold ${config.min})`);
    }
    
    // Check for stale data (no updates in 24h)
    if (recentCount === 0 && count > 0) {
      report.issues.push(`WARNING: ${config.name} has no updates in last 24h`);
      report.recommendations.push(`Check ${domain} harvester logs for errors`);
    }
    
    const domainHealth: DomainHealth = {
      domain,
      name: config.name,
      count,
      threshold: config.min,
      status,
      recentCount,
    };
    
    report.domains.push(domainHealth);
    report.totalListings += count;
    
    const statusIcon = status === 'ok' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    console.log(`  ${statusIcon} ${config.name}: ${count.toLocaleString()} (${recentCount} recent)`);
  }
  
  // 2. Check export status
  console.log('\n--- Export Status ---');
  const exportCheck = await checkExportStatus();
  report.exportStatus = exportCheck.status;
  report.exportAge = exportCheck.ageHours;
  
  if (exportCheck.status === 'missing') {
    report.issues.push('CRITICAL: Export file is missing');
    report.recommendations.push('Run catalogue-export Lambda manually');
    console.log('  ❌ Export file MISSING');
  } else if (exportCheck.status === 'stale') {
    report.issues.push(`WARNING: Export is ${exportCheck.ageHours}h old (should be <12h)`);
    report.recommendations.push('Check catalogue-export Lambda schedule');
    console.log(`  ⚠️ Export is ${exportCheck.ageHours}h old (stale)`);
  } else {
    console.log(`  ✅ Export is ${exportCheck.ageHours}h old, ${Math.round((exportCheck.size || 0) / 1024)}KB`);
  }
  
  // 3. Determine overall health
  const criticalCount = report.issues.filter(i => i.startsWith('CRITICAL')).length;
  const warningCount = report.issues.filter(i => i.startsWith('WARNING')).length;
  
  if (criticalCount > 0) {
    report.overall = 'unhealthy';
  } else if (warningCount > 0) {
    report.overall = 'degraded';
  }
  
  // 4. Print summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  OVERALL STATUS: ${report.overall.toUpperCase()}`);
  console.log(`  Total Listings: ${report.totalListings.toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (report.issues.length > 0) {
    console.log('\n--- Issues ---');
    for (const issue of report.issues) {
      console.log(`  • ${issue}`);
    }
  }
  
  if (report.recommendations.length > 0) {
    console.log('\n--- Recommendations ---');
    for (const rec of report.recommendations) {
      console.log(`  → ${rec}`);
    }
  }
  
  // 5. Publish CloudWatch metrics
  try {
    await publishMetrics(report);
    console.log('\n✅ Metrics published to CloudWatch');
  } catch (error) {
    console.error('⚠️ Failed to publish metrics:', error);
  }
  
  // 6. Return report
  return {
    statusCode: report.overall === 'healthy' ? 200 : report.overall === 'degraded' ? 207 : 500,
    body: JSON.stringify(report, null, 2),
  };
};

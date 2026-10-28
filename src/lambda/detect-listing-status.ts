/**
 * Detect Listing Status Lambda
 * 
 * Checks if listings have been sold, rented, or removed.
 * Updates market_velocity table with status changes.
 * 
 * Schedule: Daily at 5 AM UTC (cron(0 5 * * ? *)) - 2 hours after harvest
 * Timeout: 15 minutes
 * Memory: 512 MB
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

const LISTINGS_TABLE = 'leo-listings';
const MARKET_VELOCITY_TABLE = 'leo-market-velocity';
const MAX_CHECK_PER_RUN = 1000;
const BATCH_SIZE = 20;

// Spanish patterns indicating sold/rented
const SOLD_PATTERNS = [
  /vendido/i,
  /sold/i,
  /reservado/i,
  /reserved/i,
  /no disponible/i,
  /not available/i,
];

const RENTED_PATTERNS = [
  /alquilado/i,
  /rented/i,
  /arrendado/i,
];

const REMOVED_INDICATORS = [
  404,
  410,
  'page not found',
  'página no encontrada',
  'este anuncio ya no está disponible',
  'this listing is no longer available',
];

interface Listing {
  listing_id: string;
  url: string;
  domain: string;
  price_eur?: number;
  status?: string;
  last_checked?: string;
}

interface StatusResult {
  listing_id: string;
  status: 'active' | 'sold' | 'rented' | 'removed' | 'unknown';
  confidence: number;
  indicators: string[];
}

/**
 * Check listing status by fetching the URL
 */
async function checkListingStatus(listing: Listing): Promise<StatusResult> {
  const result: StatusResult = {
    listing_id: listing.listing_id,
    status: 'unknown',
    confidence: 0,
    indicators: [],
  };
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(listing.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PuedoCasa/1.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    
    clearTimeout(timeout);
    
    // Check HTTP status
    if (response.status === 404 || response.status === 410) {
      result.status = 'removed';
      result.confidence = 0.95;
      result.indicators.push(`HTTP ${response.status}`);
      return result;
    }
    
    if (!response.ok) {
      result.status = 'unknown';
      result.confidence = 0.3;
      result.indicators.push(`HTTP ${response.status}`);
      return result;
    }
    
    // Check page content
    const html = await response.text();
    const lowerHtml = html.toLowerCase();
    
    // Check for removal indicators
    for (const indicator of REMOVED_INDICATORS) {
      if (typeof indicator === 'string' && lowerHtml.includes(indicator.toLowerCase())) {
        result.status = 'removed';
        result.confidence = 0.9;
        result.indicators.push(`Contains: "${indicator}"`);
        return result;
      }
    }
    
    // Check for sold patterns
    for (const pattern of SOLD_PATTERNS) {
      if (pattern.test(html)) {
        result.status = 'sold';
        result.confidence = 0.85;
        result.indicators.push(`Pattern: ${pattern.source}`);
        return result;
      }
    }
    
    // Check for rented patterns
    for (const pattern of RENTED_PATTERNS) {
      if (pattern.test(html)) {
        result.status = 'rented';
        result.confidence = 0.85;
        result.indicators.push(`Pattern: ${pattern.source}`);
        return result;
      }
    }
    
    // Check if price is removed (soft 404)
    const hasPriceElement = /class="[^"]*price[^"]*"/i.test(html) || /id="[^"]*price[^"]*"/i.test(html);
    const hasPriceValue = /€\s*[\d.,]+|[\d.,]+\s*€/i.test(html);
    
    if (hasPriceElement && !hasPriceValue && listing.price_eur) {
      result.status = 'removed';
      result.confidence = 0.7;
      result.indicators.push('Price element present but no value');
      return result;
    }
    
    // Looks active
    result.status = 'active';
    result.confidence = 0.8;
    result.indicators.push('Page loads normally');
    
    return result;
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      result.indicators.push('Timeout');
    } else {
      result.indicators.push(`Error: ${error.message}`);
    }
    result.status = 'unknown';
    result.confidence = 0.2;
    return result;
  }
}

/**
 * Update listing status in DynamoDB
 */
async function updateListingStatus(listing_id: string, status: string): Promise<void> {
  await dynamoClient.send(new UpdateCommand({
    TableName: LISTINGS_TABLE,
    Key: { listing_id },
    UpdateExpression: 'SET #status = :status, last_checked = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': status,
      ':now': new Date().toISOString(),
    },
  }));
}

/**
 * Record status change in market velocity table
 */
async function recordStatusChange(
  listing_id: string,
  domain: string,
  oldStatus: string | undefined,
  newStatus: string,
  confidence: number
): Promise<void> {
  if (oldStatus === newStatus) return;
  
  await dynamoClient.send(new PutCommand({
    TableName: MARKET_VELOCITY_TABLE,
    Item: {
      listing_id,
      domain,
      old_status: oldStatus || 'unknown',
      new_status: newStatus,
      confidence,
      detected_at: new Date().toISOString(),
      // For querying by domain + date
      domain_date: `${domain}#${new Date().toISOString().slice(0, 10)}`,
    },
  }));
}

/**
 * Get listings to check (prioritize recently active, not checked recently)
 */
async function getListingsToCheck(limit: number): Promise<Listing[]> {
  const listings: Listing[] = [];
  let lastEvaluatedKey: any;
  
  // Get listings not checked in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  do {
    const result = await dynamoClient.send(new ScanCommand({
      TableName: LISTINGS_TABLE,
      FilterExpression: 'attribute_not_exists(last_checked) OR last_checked < :threshold',
      ExpressionAttributeValues: {
        ':threshold': oneDayAgo,
      },
      ProjectionExpression: 'listing_id, #url, #domain, price_eur, #status, last_checked',
      ExpressionAttributeNames: {
        '#url': 'url',
        '#domain': 'domain',
        '#status': 'status',
      },
      Limit: 1000,
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    
    if (result.Items) {
      listings.push(...(result.Items as Listing[]));
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
    
  } while (lastEvaluatedKey && listings.length < limit);
  
  return listings.slice(0, limit);
}

/**
 * Main Lambda handler
 */
export async function handler(event: any): Promise<any> {
  console.log('🔍 Detect Listing Status - Starting');
  const startTime = Date.now();
  
  // Get listings to check
  const listings = await getListingsToCheck(MAX_CHECK_PER_RUN);
  console.log(`Found ${listings.length} listings to check`);
  
  const stats = {
    checked: 0,
    active: 0,
    sold: 0,
    rented: 0,
    removed: 0,
    unknown: 0,
    errors: 0,
  };
  
  // Process in batches
  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    const batch = listings.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(
      batch.map(async (listing) => {
        try {
          const result = await checkListingStatus(listing);
          
          // Update status
          await updateListingStatus(listing.listing_id, result.status);
          
          // Record change if status changed
          if (result.status !== listing.status && result.confidence > 0.5) {
            await recordStatusChange(
              listing.listing_id,
              listing.domain,
              listing.status,
              result.status,
              result.confidence
            );
          }
          
          return result;
        } catch (error) {
          console.error(`Error checking ${listing.listing_id}:`, error);
          return { status: 'error' };
        }
      })
    );
    
    // Update stats
    for (const result of results) {
      stats.checked++;
      if (result.status === 'active') stats.active++;
      else if (result.status === 'sold') stats.sold++;
      else if (result.status === 'rented') stats.rented++;
      else if (result.status === 'removed') stats.removed++;
      else if (result.status === 'error') stats.errors++;
      else stats.unknown++;
    }
    
    // Progress
    console.log(`Checked ${stats.checked}/${listings.length} (${stats.sold} sold, ${stats.rented} rented, ${stats.removed} removed)`);
    
    // Check timeout
    if (Date.now() - startTime > 14 * 60 * 1000) {
      console.log('Approaching timeout, stopping');
      break;
    }
  }
  
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Completed in ${elapsed.toFixed(1)}s`);
  console.log(`   Checked: ${stats.checked}`);
  console.log(`   Active: ${stats.active}`);
  console.log(`   Sold: ${stats.sold}`);
  console.log(`   Rented: ${stats.rented}`);
  console.log(`   Removed: ${stats.removed}`);
  console.log(`   Unknown: ${stats.unknown}`);
  console.log(`   Errors: ${stats.errors}`);
  
  return {
    statusCode: 200,
    body: JSON.stringify(stats),
  };
}


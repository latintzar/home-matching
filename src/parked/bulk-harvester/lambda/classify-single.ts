/**
 * classify-single Lambda
 * 
 * Classifies 1 HTML file from S3 using heuristics.
 * Updates DynamoDB with classification.
 * If list_page, also saves to leo-delta-sources.
 * 
 * Input: { s3Key, url, domain }
 * Output: { success, classification }
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { classifyPage, PageType } from '../harvest/page-classifier';

const REGION = 'us-east-1';
const S3_BUCKET = 'puedo-casa-html-archive';
const URLS_TABLE = 'leo-urls';
const DELTA_SOURCES_TABLE = 'leo-delta-sources';

const s3 = new S3Client({ region: REGION });
const dynamodb = new DynamoDBClient({ region: REGION });

interface Event {
  s3Key: string;
  url: string;
  domain: string;
}

// Read HTML from S3 (first 200KB only - enough for classification)
const MAX_HTML_BYTES = 200 * 1024; // 200KB

async function getHtmlFromS3(s3Key: string): Promise<string> {
  const response = await s3.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Range: `bytes=0-${MAX_HTML_BYTES - 1}`, // Only get first 200KB
  }));
  
  if (!response.Body) {
    throw new Error('Empty S3 object');
  }
  
  const chunks: Uint8Array[] = [];
  const reader = response.Body.transformToWebStream().getReader();
  let totalBytes = 0;
  
  while (totalBytes < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalBytes += value.length;
  }
  
  const buffer = Buffer.concat(chunks);
  return buffer.toString('utf-8');
}

// Update URL with classification
async function updateUrlClassification(
  url: string,
  domain: string,
  classification: any
): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: URLS_TABLE,
    Key: { url: { S: url } },
    UpdateExpression: 'SET classification = :cls, classified_at = :time, classification_failed = :failed, classification_status = :status',
    ExpressionAttributeValues: {
      ':cls': { S: JSON.stringify(classification) },
      ':time': { S: new Date().toISOString() },
      ':failed': { BOOL: false },
      ':status': { S: 'classified' },
    },
  }));
}

// Mark classification failure
async function markClassificationFailure(
  url: string,
  domain: string,
  error: string
): Promise<void> {
  await dynamodb.send(new UpdateItemCommand({
    TableName: URLS_TABLE,
    Key: { url: { S: url } },
    UpdateExpression: 'SET classification_failed = :failed, classification_error = :error, classified_at = :time, classification_status = :status',
    ExpressionAttributeValues: {
      ':failed': { BOOL: true },
      ':error': { S: error.slice(0, 500) },
      ':time': { S: new Date().toISOString() },
      ':status': { S: 'failed' },
    },
  }));
  
  // Also mark domain as having classification issues
  try {
    await dynamodb.send(new UpdateItemCommand({
      TableName: 'leo-scraping-rules',
      Key: { domain: { S: domain } },
      UpdateExpression: 'ADD classification_failures :one SET classification_issues = :true',
      ExpressionAttributeValues: {
        ':one': { N: '1' },
        ':true': { BOOL: true },
      },
    }));
  } catch (err) {
    // Ignore if domain doesn't exist
  }
}

// Save list page to delta sources
async function saveToDeltaSources(url: string, domain: string, classification: any): Promise<void> {
  await dynamodb.send(new PutItemCommand({
    TableName: DELTA_SOURCES_TABLE,
    Item: {
      url: { S: url },
      domain: { S: domain },
      page_type: { S: classification.pageType },
      transaction: classification.transaction ? { S: classification.transaction } : { NULL: true },
      asset_class: classification.assetClass ? { S: classification.assetClass } : { NULL: true },
      discovered_at: { S: new Date().toISOString() },
      last_checked_at: { S: new Date().toISOString() },
    },
  }));
}

export async function handler(event: Event) {
  const { s3Key, url, domain } = event;
  
  try {
    // Read HTML from S3
    const html = await getHtmlFromS3(s3Key);
    
    // Classify
    const classification = classifyPage(url, html);
    
    // Mark if classification is uncertain (low confidence or UNKNOWN)
    const needsReview = classification.confidence < 0.5 || 
                       classification.pageType === PageType.UNKNOWN ||
                       classification.action === 'skip';
    
    // Update URL record
    await updateUrlClassification(url, domain, classification);
    
    // Mark for review if needed
    if (needsReview) {
      await dynamodb.send(new UpdateItemCommand({
        TableName: URLS_TABLE,
        Key: { url: { S: url } },
        UpdateExpression: 'SET classification_needs_review = :review',
        ExpressionAttributeValues: {
          ':review': { BOOL: true },
        },
      }));
    }
    
    // If list page, save to delta sources
    const isListPage = [
      PageType.LIST_SALE,
      PageType.LIST_RENT,
      PageType.LIST_MIXED,
      PageType.LIST_LOCATION,
      PageType.SEARCH_PAGE,
      PageType.CATEGORY_HUB,
    ].includes(classification.pageType);
    
    if (isListPage) {
      await saveToDeltaSources(url, domain, classification);
    }
    
    return {
      success: true,
      url,
      domain,
      classification: {
        pageType: classification.pageType,
        transaction: classification.transaction,
        assetClass: classification.assetClass,
        confidence: classification.confidence,
        action: classification.action,
      },
    };
    
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error';
    console.error(`Error classifying ${url}:`, errorMsg);
    
    // Mark as failed in DynamoDB
    await markClassificationFailure(url, domain, errorMsg);
    
    return {
      success: false,
      url,
      domain,
      error: errorMsg,
    };
  }
}


/**
 * DynamoDB Data Adapter
 * 
 * Handles all DynamoDB-specific data operations for harvested listings
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  QueryCommand,
  ScanCommand 
} from '@aws-sdk/lib-dynamodb';
import { UnifiedListing, ListingQueryOptions, AnalysisResult, WPACache } from './types';

// Table names
const TABLES = {
  LISTINGS: 'puedo-casa-listings',
  ANALYSIS: 'puedo-casa-analysis',
  WPA_CACHE: 'puedo-casa-wpa-cache',
};

// Singleton DynamoDB client
let dynamoClient: DynamoDBDocumentClient | null = null;

function getDynamoDB(): DynamoDBDocumentClient {
  if (!dynamoClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      } : undefined,
    });
    dynamoClient = DynamoDBDocumentClient.from(client);
  }
  return dynamoClient;
}

/**
 * Check if a listing exists in DynamoDB
 */
export async function existsInDynamoDB(listingId: string): Promise<boolean> {
  const dynamo = getDynamoDB();
  
  try {
    const result = await dynamo.send(new GetCommand({
      TableName: TABLES.LISTINGS,
      Key: { listing_id: listingId },
      ProjectionExpression: 'listing_id',
    }));
    return !!result.Item;
  } catch {
    return false;
  }
}

/**
 * Get listing from DynamoDB
 */
export async function getListingFromDynamoDB(
  listingId: string,
  options: ListingQueryOptions = {}
): Promise<UnifiedListing | null> {
  const dynamo = getDynamoDB();
  
  try {
    const result = await dynamo.send(new GetCommand({
      TableName: TABLES.LISTINGS,
      Key: { listing_id: listingId },
    }));
    
    if (!result.Item) {
      return null;
    }
    
    const item = result.Item;
    
    return {
      id: item.listing_id,
      source: 'dynamodb',
      url: item.url || '',
      domain: item.domain || '',
      title: item.title,
      address: item.address,
      city: item.city,
      neighborhood: item.neighborhood,
      province: item.province,
      postal_code: item.postal_code,
      lat: item.lat,
      lng: item.lng,
      price_eur: item.price_eur,
      sqm: item.sqm,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      property_type: item.property_type,
      operation_type: item.operation_type,
      description: options.includeDescription ? item.description : undefined,
      features: item.features,
      photo_urls: options.includePhotos ? item.photo_urls : undefined,
      scraped_at: item.scraped_at,
      parsed_at: item.parsed_at,
      agency_name: item.agency_name,
      pipeline_status: item.pipeline_status,
      raw_data: options.includeRaw ? item : undefined,
    };
  } catch (error) {
    console.error('DynamoDB get error:', error);
    return null;
  }
}

/**
 * Save/update listing in DynamoDB
 */
export async function saveListingToDynamoDB(
  listing: Partial<UnifiedListing> & { id: string }
): Promise<boolean> {
  const dynamo = getDynamoDB();
  
  try {
    await dynamo.send(new PutCommand({
      TableName: TABLES.LISTINGS,
      Item: {
        listing_id: listing.id,
        url: listing.url,
        domain: listing.domain,
        title: listing.title,
        address: listing.address,
        city: listing.city,
        neighborhood: listing.neighborhood,
        province: listing.province,
        postal_code: listing.postal_code,
        lat: listing.lat,
        lng: listing.lng,
        price_eur: listing.price_eur,
        sqm: listing.sqm,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        property_type: listing.property_type,
        operation_type: listing.operation_type,
        description: listing.description,
        features: listing.features,
        photo_urls: listing.photo_urls,
        scraped_at: listing.scraped_at,
        parsed_at: listing.parsed_at,
        agency_name: listing.agency_name,
        pipeline_status: listing.pipeline_status,
        updated_at: new Date().toISOString(),
      },
    }));
    return true;
  } catch (error) {
    console.error('DynamoDB save error:', error);
    return false;
  }
}

/**
 * Get analysis results from DynamoDB
 */
export async function getAnalysisFromDynamoDB(
  listingId: string,
  analysisType: string
): Promise<AnalysisResult | null> {
  const dynamo = getDynamoDB();
  
  try {
    const result = await dynamo.send(new GetCommand({
      TableName: TABLES.ANALYSIS,
      Key: { 
        listing_id: listingId,
        analysis_type: analysisType,
      },
    }));
    
    if (!result.Item) {
      return null;
    }
    
    return {
      listing_id: listingId,
      analysis_type: analysisType,
      results: result.Item.results,
      created_at: result.Item.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Save analysis results to DynamoDB
 */
export async function saveAnalysisToDynamoDB(
  listingId: string,
  analysisType: string,
  results: Record<string, unknown>
): Promise<boolean> {
  const dynamo = getDynamoDB();
  
  try {
    await dynamo.send(new PutCommand({
      TableName: TABLES.ANALYSIS,
      Item: {
        listing_id: listingId,
        analysis_type: analysisType,
        results,
        created_at: new Date().toISOString(),
      },
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get WPA cache from DynamoDB
 */
export async function getWPAFromDynamoDB(
  listingId: string
): Promise<WPACache | null> {
  const dynamo = getDynamoDB();
  
  try {
    const result = await dynamo.send(new GetCommand({
      TableName: TABLES.WPA_CACHE,
      Key: { listing_id: listingId },
    }));
    
    if (!result.Item) {
      return null;
    }
    
    // Check if cache is still valid
    const cachedAt = new Date(result.Item.cached_at);
    const ttlDays = result.Item.ttl_days || 30;
    const expiresAt = new Date(cachedAt.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    
    if (new Date() > expiresAt) {
      return null; // Cache expired
    }
    
    return {
      listing_id: listingId,
      analysis: result.Item.analysis,
      model_used: result.Item.model_used,
      cached_at: result.Item.cached_at,
      ttl_days: ttlDays,
    };
  } catch {
    return null;
  }
}

/**
 * Save WPA to DynamoDB
 */
export async function saveWPAToDynamoDB(
  listingId: string,
  analysis: Record<string, unknown>,
  modelUsed: string,
  ttlDays: number = 30
): Promise<boolean> {
  const dynamo = getDynamoDB();
  
  try {
    await dynamo.send(new PutCommand({
      TableName: TABLES.WPA_CACHE,
      Item: {
        listing_id: listingId,
        analysis,
        model_used: modelUsed,
        cached_at: new Date().toISOString(),
        ttl_days: ttlDays,
      },
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Query listings by city
 */
export async function queryListingsByCity(
  city: string,
  limit: number = 100
): Promise<UnifiedListing[]> {
  const dynamo = getDynamoDB();
  
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: TABLES.LISTINGS,
      IndexName: 'city-index',
      KeyConditionExpression: 'city = :city',
      ExpressionAttributeValues: {
        ':city': city,
      },
      Limit: limit,
    }));
    
    return (result.Items || []).map(item => ({
      id: item.listing_id,
      source: 'dynamodb' as const,
      url: item.url || '',
      domain: item.domain || '',
      title: item.title,
      address: item.address,
      city: item.city,
      neighborhood: item.neighborhood,
      price_eur: item.price_eur,
      sqm: item.sqm,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      property_type: item.property_type,
      operation_type: item.operation_type,
    }));
  } catch {
    return [];
  }
}

/**
 * Query listings by domain (agency)
 */
export async function queryListingsByDomain(
  domain: string,
  limit: number = 100
): Promise<UnifiedListing[]> {
  const dynamo = getDynamoDB();
  
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: TABLES.LISTINGS,
      IndexName: 'domain-index',
      KeyConditionExpression: '#domain = :domain',
      ExpressionAttributeNames: {
        '#domain': 'domain',
      },
      ExpressionAttributeValues: {
        ':domain': domain,
      },
      Limit: limit,
    }));
    
    return (result.Items || []).map(item => ({
      id: item.listing_id,
      source: 'dynamodb' as const,
      url: item.url || '',
      domain: item.domain || '',
      title: item.title,
      price_eur: item.price_eur,
      sqm: item.sqm,
    }));
  } catch {
    return [];
  }
}


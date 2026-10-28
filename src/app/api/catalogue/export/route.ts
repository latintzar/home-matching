import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { gzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  })
);

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const TABLE_NAME = "leo-listings";
const STATS_TABLE = "leo-harvest-stats";
const BUCKET_NAME = "puedo-casa-html-archive";
const EXPORT_KEY = "catalogue/listings.json.gz";

// ALL 7 harvester domains
const DOMAINS = [
  "lucasfox.com", 
  "donpiso.com", 
  "tecnocasa.es", 
  "century21.es",
  "engelvoelkers.com",
  "remax.es",
  "aproperties.es"
];

// Query all listings from a domain
async function queryAllFromDomain(domain: string): Promise<any[]> {
  const items: any[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "#d = :domain",
      ExpressionAttributeNames: { "#d": "domain" },
      ExpressionAttributeValues: { ":domain": domain },
      ExclusiveStartKey: lastKey,
    }));

    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

// POST: Export all listings to S3 (call after harvest)
export async function POST() {
  try {
    console.log("[Export] Starting catalogue export...");
    const startTime = Date.now();

    // Query all domains in parallel
    const results = await Promise.all(
      DOMAINS.map(domain => queryAllFromDomain(domain))
    );

    const allListings = results.flat();
    
    // Compute stats
    const domains: Record<string, number> = {};
    for (const item of allListings) {
      const d = item.domain as string;
      domains[d] = (domains[d] || 0) + 1;
    }

    // Create export data
    const exportData = {
      listings: allListings,
      domains,
      total: allListings.length,
      exportedAt: new Date().toISOString(),
    };

    // Gzip and upload to S3
    const jsonStr = JSON.stringify(exportData);
    const gzipped = await gzipAsync(Buffer.from(jsonStr));

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: EXPORT_KEY,
      Body: gzipped,
      ContentType: "application/json",
      ContentEncoding: "gzip",
    }));

    // Update stats table
    await dynamoClient.send(new PutCommand({
      TableName: STATS_TABLE,
      Item: {
        stat_id: "catalogue_summary",
        domains,
        total: allListings.length,
        updated_at: new Date().toISOString(),
      },
    }));

    const elapsed = Date.now() - startTime;
    console.log(`[Export] Exported ${allListings.length} listings in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      total: allListings.length,
      domains,
      sizeKB: Math.round(gzipped.length / 1024),
      elapsed,
    });
  } catch (error: any) {
    console.error("[Export] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Get the exported data URL or stats
export async function GET() {
  try {
    // Try to get stats from DynamoDB
    const stats = await dynamoClient.send(new QueryCommand({
      TableName: STATS_TABLE,
      KeyConditionExpression: "stat_id = :id",
      ExpressionAttributeValues: { ":id": "catalogue_summary" },
    })).catch(() => null);

    const item = stats?.Items?.[0];
    
    return NextResponse.json({
      exportUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${EXPORT_KEY}`,
      stats: item ? {
        domains: item.domains,
        total: item.total,
        updatedAt: item.updated_at,
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


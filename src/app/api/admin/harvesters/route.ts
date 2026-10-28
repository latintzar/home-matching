import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  })
);

const BUCKET_NAME = "puedo-casa-html-archive";
const LISTINGS_TABLE = "leo-listings";

// Harvester configurations
const HARVESTERS = [
  { id: "lf", name: "Lucas Fox", lambda: "lf-harvest-delta", stateKey: "harvest/lf-harvest-state.json", domain: "lucasfox.com" },
  { id: "tc", name: "Tecnocasa", lambda: "tc-harvest-delta", stateKey: "harvest/tc-state.json", domain: "tecnocasa.es" },
  { id: "c21", name: "Century21", lambda: "c21-harvest-delta", stateKey: "harvest/c21-state.json", domain: "century21.es" },
  { id: "dp", name: "donpiso", lambda: "dp-harvest-delta", stateKey: "harvest/dp-state.json", domain: "donpiso.com" },
  { id: "ev", name: "Engel & Völkers", lambda: "ev-harvest-delta", stateKey: "harvest/ev-harvest-state.json", domain: "engelvoelkers.com" },
  { id: "remax", name: "RE/MAX", lambda: "remax-harvest-delta", stateKey: "harvest/remax-state.json", domain: "remax.es" },
  { id: "aproperties", name: "aProperties", lambda: "aproperties-harvest-delta", stateKey: "harvest/aproperties-state.json", domain: "aproperties.es" },
];

interface HarvesterState {
  phase?: string;
  invocationCount?: number;
  scrapedUrls?: string[];
  geocodedIds?: string[];
  allSitemapUrls?: string[];
  listingsToGeocode?: any[];
  totalNewFound?: number;
  writtenToDynamo?: number;
  newInDb?: number;
  updatedInDb?: number;
  lastProgressAt?: string;
  startedAt?: string;
  cleared?: boolean;
  // E&V specific
  visitedLocations?: string[];
  pendingLocations?: string[];
  discoveredListings?: any[];
}

async function getStateFromS3(stateKey: string): Promise<HarvesterState | null> {
  try {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: stateKey,
    }));
    const body = await result.Body?.transformToString();
    if (!body) return null;
    const parsed = JSON.parse(body);
    if (parsed.cleared) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getDbCount(domain: string): Promise<number> {
  try {
    let count = 0;
    let lastKey: Record<string, unknown> | undefined = undefined;
    
    // DynamoDB Scan paginates - we need to loop to get full count
    do {
      const result: { Count?: number; LastEvaluatedKey?: Record<string, unknown> } = await dynamoClient.send(new ScanCommand({
        TableName: LISTINGS_TABLE,
        Select: "COUNT",
        FilterExpression: "#d = :domain",
        ExpressionAttributeNames: { "#d": "domain" },
        ExpressionAttributeValues: { ":domain": domain },
        ExclusiveStartKey: lastKey,
      }));
      count += result.Count || 0;
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    
    return count;
  } catch (err) {
    console.error(`Error getting count for ${domain}:`, err);
    return 0;
  }
}

export async function GET() {
  try {
    const results = await Promise.all(
      HARVESTERS.map(async (harvester) => {
        const [state, dbCount] = await Promise.all([
          getStateFromS3(harvester.stateKey),
          getDbCount(harvester.domain),
        ]);

        // Calculate progress
        let progress = { current: 0, total: 0, percent: 0 };
        let status: "complete" | "running" | "idle" | "stale" = "idle";

        if (state) {
          const lastProgress = state.lastProgressAt ? new Date(state.lastProgressAt).getTime() : 0;
          const ageMinutes = (Date.now() - lastProgress) / (1000 * 60);

          // Determine status based on phase and age
          if (state.phase === "complete") {
            status = "complete";
          } else if (ageMinutes < 20) {
            status = "running";
          } else {
            status = "stale";
          }

          // Calculate progress based on phase
          if (state.phase === "discovery") {
            // E&V geo-recursive discovery
            const visited = state.visitedLocations?.length || 0;
            const pending = state.pendingLocations?.length || 0;
            progress = { current: visited, total: visited + pending, percent: pending > 0 ? Math.round((visited / (visited + pending)) * 100) : 0 };
          } else if (state.phase === "scraping") {
            const scraped = state.scrapedUrls?.length || 0;
            const total = state.allSitemapUrls?.length || scraped;
            progress = { current: scraped, total, percent: total > 0 ? Math.round((scraped / total) * 100) : 0 };
          } else if (state.phase === "geocoding") {
            const geocoded = state.geocodedIds?.length || 0;
            const toGeocode = state.listingsToGeocode?.length || state.scrapedUrls?.length || 0;
            progress = { current: geocoded, total: toGeocode, percent: toGeocode > 0 ? Math.round((geocoded / toGeocode) * 100) : 0 };
          }
        }

        return {
          id: harvester.id,
          name: harvester.name,
          lambda: harvester.lambda,
          domain: harvester.domain,
          status,
          phase: state?.phase || null,
          invocation: state?.invocationCount || 0,
          maxInvocations: 10,
          progress,
          dbCount,
          stats: {
            totalNewFound: state?.totalNewFound || 0,
            writtenToDynamo: state?.writtenToDynamo || 0,
            newInDb: state?.newInDb || 0,
            updatedInDb: state?.updatedInDb || 0,
          },
          lastActivity: state?.lastProgressAt || null,
        };
      })
    );

    // Get total DB count
    const totalDbCount = results.reduce((sum, r) => sum + r.dbCount, 0);

    return NextResponse.json({
      harvesters: results,
      totalDbCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Harvester status API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch harvester status" },
      { status: 500 }
    );
  }
}

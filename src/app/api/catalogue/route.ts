import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { gunzipSync } from "zlib";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = "puedo-casa-html-archive";
const EXPORT_KEY = "catalogue/listings.json.gz";

// In-memory cache (loads from S3 once, then instant forever)
let catalogueCache: {
  listings: any[];
  domains: Record<string, number>;
  total: number;
  exportedAt: string;
} | null = null;
let cacheLoadedAt: number | null = null;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (matches harvest frequency)

async function loadFromS3() {
  console.log("[Catalogue] Loading from S3...");
  const startTime = Date.now();

  const result = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: EXPORT_KEY,
  }));

  const compressed = await result.Body?.transformToByteArray();
  if (!compressed) throw new Error("Empty S3 response");

  const jsonStr = gunzipSync(Buffer.from(compressed)).toString("utf-8");
  const data = JSON.parse(jsonStr);

  console.log(`[Catalogue] Loaded ${data.total} listings in ${Date.now() - startTime}ms`);
  return data;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    
    // Check if cache is valid (skip if force refresh)
    const now = Date.now();
    if (!forceRefresh && catalogueCache && cacheLoadedAt && (now - cacheLoadedAt) < CACHE_TTL_MS) {
      // INSTANT: Return from cache
      return NextResponse.json({
        listings: catalogueCache.listings,
        domains: catalogueCache.domains,
        total: catalogueCache.total,
        exportedAt: catalogueCache.exportedAt,
        cached: true,
        cacheAge: Math.round((now - cacheLoadedAt) / 1000),
      });
    }

    // Load from S3 (first request or cache expired)
    const data = await loadFromS3();
    
    // Update cache
    catalogueCache = data;
    cacheLoadedAt = now;

    return NextResponse.json({
      listings: data.listings,
      domains: data.domains,
      total: data.total,
      exportedAt: data.exportedAt,
      cached: false,
    });
  } catch (error: any) {
    console.error("Catalogue API error:", error);
    
    // If S3 fails but we have stale cache, use it
    if (catalogueCache) {
      return NextResponse.json({
        listings: catalogueCache.listings,
        domains: catalogueCache.domains,
        total: catalogueCache.total,
        exportedAt: catalogueCache.exportedAt,
        cached: true,
        stale: true,
      });
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch listings" },
      { status: 500 }
    );
  }
}

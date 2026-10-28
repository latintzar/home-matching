/**
 * Update catalogue stats after a harvest completes.
 * Call this at the end of each harvester Lambda.
 * 
 * Usage:
 *   await updateCatalogueStats('lucasfox.com', 4193);
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" })
);

const STATS_TABLE = "leo-harvest-stats";

export async function updateCatalogueStats(domain: string, count: number): Promise<void> {
  try {
    // Update the domain count atomically
    await client.send(new UpdateCommand({
      TableName: STATS_TABLE,
      Key: { stat_id: "catalogue_summary" },
      UpdateExpression: "SET #domains.#domain = :count, #updated = :now",
      ExpressionAttributeNames: {
        "#domains": "domains",
        "#domain": domain,
        "#updated": "updated_at",
      },
      ExpressionAttributeValues: {
        ":count": count,
        ":now": new Date().toISOString(),
      },
    }));

    // Recalculate total
    const result = await client.send(new GetCommand({
      TableName: STATS_TABLE,
      Key: { stat_id: "catalogue_summary" },
    }));

    if (result.Item?.domains) {
      const total = Object.values(result.Item.domains as Record<string, number>)
        .reduce((sum, n) => sum + n, 0);

      await client.send(new UpdateCommand({
        TableName: STATS_TABLE,
        Key: { stat_id: "catalogue_summary" },
        UpdateExpression: "SET #total = :total",
        ExpressionAttributeNames: { "#total": "total" },
        ExpressionAttributeValues: { ":total": total },
      }));
    }

    console.log(`[Stats] Updated ${domain}: ${count} listings`);
  } catch (error) {
    console.error(`[Stats] Failed to update stats for ${domain}:`, error);
    // Don't throw - stats update failure shouldn't break harvest
  }
}

/**
 * Get current catalogue stats (instant!)
 */
export async function getCatalogueStats(): Promise<{
  domains: Record<string, number>;
  total: number;
  updatedAt: string;
} | null> {
  try {
    const result = await client.send(new GetCommand({
      TableName: STATS_TABLE,
      Key: { stat_id: "catalogue_summary" },
    }));

    if (result.Item) {
      return {
        domains: result.Item.domains || {},
        total: result.Item.total || 0,
        updatedAt: result.Item.updated_at || "",
      };
    }
  } catch (error) {
    console.error("[Stats] Failed to get stats:", error);
  }
  return null;
}


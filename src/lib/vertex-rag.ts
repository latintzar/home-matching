
import { GoogleAuth } from 'google-auth-library';
import * as cheerio from 'cheerio';

// Types for Vertex AI Search response
interface SearchResponse {
  results: Array<{
    document: {
      name: string;
      id: string;
      derivedStructData?: any;
      structData?: any;
    };
    snippets?: Array<{
      snippet: string;
      snippetStatus: string;
    }>;
  }>;
  summary?: {
    summaryText: string;
    summaryWithMetadata?: {
      summary: string;
    };
  };
  totalSize: number;
  attributionToken?: string;
  nextPageToken?: string;
}

export interface RAGResult {
  title?: string;
  content: string;
  source: string;
  score?: number;
  metadata?: any;
}

export type DataStoreType = 'pricing' | 'legal' | 'forms' | 'catalog';

/**
 * Client for Google Cloud Vertex AI Search (Discovery Engine)
 */
export class VertexRAGClient {
  private projectId: string;
  private location: string;
  private auth: GoogleAuth;
  
  // Map store types to env var names for their IDs
  private storeIdMap: Record<DataStoreType, string | undefined> = {
    pricing: process.env.VERTEX_SEARCH_DATA_STORE_ID_PRICING || '', // Fallback to known good store
    legal: process.env.VERTEX_SEARCH_DATA_STORE_ID_LEGAL,
    forms: process.env.VERTEX_SEARCH_DATA_STORE_ID_FORMS,
    catalog: process.env.VERTEX_SEARCH_DATA_STORE_ID_CATALOG
  };

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    this.location = 'global'; // Discovery Engine is often global, or specific region
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    if (!this.projectId) {
      console.warn('⚠️ GOOGLE_CLOUD_PROJECT_ID not set. Vertex RAG will not work.');
    }
  }

  /**
   * Fetch content from Google Cloud Storage and clean it
   */
  private async fetchGCSContent(gsUri: string, accessToken: string): Promise<string | null> {
    try {
      // Parse gs://bucket/path/to/file
      const match = gsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!match) return null;

      const [, bucket, objectName] = match;
      const encodedObject = encodeURIComponent(objectName);
      
      const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedObject}?alt=media`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) return null;
      
      const html = await response.text();
      
      // Use Cheerio to extract text and remove scripts/styles
      const $ = cheerio.load(html);
      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('footer').remove();
      
      // Extract main content if possible, or just body
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      
      // Limit to 50k chars (approx 10k tokens) to stay within Lite limits
      return text.substring(0, 50000); 
    } catch (error) {
      console.warn(`⚠️ Failed to fetch GCS content for ${gsUri}:`, error);
      return null;
    }
  }

  /**
   * Search a specific Data Store
   */
  async search(
    storeType: DataStoreType, 
    query: string, 
    limit: number = 5
  ): Promise<RAGResult[]> {
    const dataStoreId = this.storeIdMap[storeType];
    
    if (!dataStoreId) {
      console.warn(`⚠️ Data Store ID for '${storeType}' not configured. Returning empty results.`);
      return [];
    }

    if (!this.projectId) {
      return [];
    }

    try {
      console.log(`🔍 VertexRAG: Searching '${storeType}' for "${query}"...`);
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      const token = accessToken.token || '';
      
      // API Endpoint for Discovery Engine (Vertex AI Search)
      const url = `https://discoveryengine.googleapis.com/v1alpha/projects/${this.projectId}/locations/${this.location}/collections/default_collection/dataStores/${dataStoreId}/servingConfigs/default_search:search`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          pageSize: limit,
          contentSearchSpec: {
            snippetSpec: { returnSnippet: true },
            // extractiveContentSpec is Enterprise only, removed to avoid 400 error
            summarySpec: { summaryResultCount: 3, includeCitations: true }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ VertexRAG API Error: ${response.status} - ${errorText}`);
        throw new Error(`Vertex AI Search API failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as SearchResponse;
      console.log(`✅ VertexRAG: Found ${data.results?.length || 0} results.`);
      
      const results: RAGResult[] = [];

      // 1. Add Summary as the FIRST result if available (High Value)
      if (data.summary?.summaryText) {
        results.push({
            title: "AI Generated Summary",
            content: data.summary.summaryText,
            source: "Vertex AI Summary",
            metadata: { type: 'summary' }
        });
      }

      // 2. Add Document Results
      if (data.results) {
        // Process in parallel to fetch GCS content if needed
        const promises = data.results.map(async (result) => {
            const snippet = result.snippets?.[0]?.snippet || '';
            const document = result.document;
            const structData = document.derivedStructData || document.structData || {};
            const link = structData.link || structData.uri || '';
            
            let content = snippet || JSON.stringify(structData);

            // ENRICHMENT: If content is short (< 500 chars) and we have a GCS link, fetch full content
            if (content.length < 500 && link.startsWith('gs://')) {
                console.log(`📥 VertexRAG: Fetching full content for ${link}...`);
                const fullContent = await this.fetchGCSContent(link, token);
                if (fullContent && fullContent.length > 50) {
                    console.log(`✅ VertexRAG: Enriched ${link} (${fullContent.length} chars)`);
                    content = fullContent;
                } else {
                    console.warn(`⚠️ VertexRAG: Failed to enrich ${link}`);
                }
            }
            
            return {
              title: structData.title || document.id,
              content: content,
              source: link || document.name,
              metadata: structData
            };
        });

        const docResults = await Promise.all(promises);
        results.push(...docResults);
      }

      return results;

    } catch (error) {
      console.error(`❌ Vertex RAG Search failed for '${storeType}':`, error);
      // Fallback to empty array so pipeline doesn't crash
      return [];
    }
  }

  /**
   * Check if a store is configured
   */
  isConfigured(storeType: DataStoreType): boolean {
    return !!this.storeIdMap[storeType] && !!this.projectId;
  }
}

// Singleton instance
export const vertexRAG = new VertexRAGClient();

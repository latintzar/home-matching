
import { GoogleAuth } from 'google-auth-library';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
// Recipient configuration is supplied by tools/runtime-env.py.
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
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();
      
      // API Endpoint for Discovery Engine (Vertex AI Search)
      const url = `https://discoveryengine.googleapis.com/v1alpha/projects/${this.projectId}/locations/${this.location}/collections/default_collection/dataStores/${dataStoreId}/servingConfigs/default_search:search`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          pageSize: limit,
          contentSearchSpec: {
            snippetSpec: { returnSnippet: true },
            summarySpec: { summaryResultCount: 1, includeCitations: true }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vertex AI Search API failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as SearchResponse;
      
      if (!data.results) {
        return [];
      }

      return data.results.map(result => {
        const snippet = result.snippets?.[0]?.snippet || '';
        const document = result.document;
        const structData = document.derivedStructData || document.structData || {};
        
        return {
          title: structData.title || document.id,
          content: snippet || JSON.stringify(structData),
          source: structData.link || structData.uri || document.name,
          metadata: structData
        };
      });

    } catch (error) {
      console.error(`❌ Vertex RAG Search failed for '${storeType}':`, error);
      // Fallback to empty array so pipeline doesn't crash
      return [];
    }
  }
}

async function probeRAG() {
  const rag = new VertexRAGClient();
  
  const queries = [
    "precio reforma integral cocina m2",
    "cuanto cuesta reformar un baño completo",
    "precio alisado paredes",
    "precio instalacion electrica piso",
    "precio reforma integral piso 100m2"
  ];

  console.log("🔍 Probing Pricing RAG Store...\n");

  for (const query of queries) {
    console.log(`\n--- Query: "${query}" ---`);
    try {
      const results = await rag.search('pricing', query, 3);
      if (results.length === 0) {
        console.log("❌ No results found.");
      } else {
        results.forEach((r, i) => {
          console.log(`\nResult ${i + 1}:`);
          console.log(`Title: ${r.title}`);
          console.log(`Snippet: ${r.content.substring(0, 150)}...`);
          console.log(`URL: ${r.source}`);
        });
      }
    } catch (error) {
      console.error("Error querying RAG:", error);
    }
  }
}

probeRAG();
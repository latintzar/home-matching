// src/lib/google-custom-search.ts

const GOOGLE_CSE_BASE_URL = 'https://www.googleapis.com/customsearch/v1';

export interface GoogleCustomSearchResult {
  kind: string;
  title: string;
  htmlTitle: string;
  link: string;
  displayLink: string;
  snippet: string;
  htmlSnippet: string;
  cacheId?: string;
  formattedUrl: string;
  htmlFormattedUrl: string;
  pagemap?: any;
}

export interface GoogleCustomSearchResponse {
  kind: string;
  url: {
    type: string;
    template: string;
  };
  queries: {
    request: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
    nextPage?: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
  };
  context: {
    title: string;
  };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items?: GoogleCustomSearchResult[];
}

/**
 * Searches Google Custom Search Engine.
 * Requires either apiKey OR accessToken (for Service Account).
 */
export async function searchGoogleCustom(
  query: string,
  cseId: string,
  auth: { apiKey?: string; accessToken?: string } | string,
  startIndex: number = 1 // 1-based index (1, 11, 21...)
): Promise<GoogleCustomSearchResponse> {
  const params = new URLSearchParams({
    cx: cseId,
    q: query,
    start: startIndex.toString(),
    num: '10', // Max results per page
    gl: 'es',
    lr: 'lang_es'
  });

  if (typeof auth === 'string') {
    params.append('key', auth);
  } else if (auth.apiKey) {
    params.append('key', auth.apiKey);
  }

  const headers: HeadersInit = {};
  if (typeof auth !== 'string' && auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  }

  try {
    const response = await fetch(`${GOOGLE_CSE_BASE_URL}?${params.toString()}`, {
      headers
    });
    
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Custom Search API failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = await response.json();
    return data as GoogleCustomSearchResponse;
  } catch (error) {
    console.error('Error fetching from Google Custom Search:', error);
    throw error;
  }
}

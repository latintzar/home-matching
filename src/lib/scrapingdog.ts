const SCRAPINGDOG_BASE_URL = 'https://api.scrapingdog.com/google';

interface ScrapingDogParams {
  api_key: string;
  query: string;
  results?: number;
  country?: string;
  page?: number;
  [key: string]: any;
}

export interface GoogleResult {
  title: string;
  link: string;
  snippet: string;
  rank: number;
}

export interface ScrapingDogResponse {
  organic_data: GoogleResult[];
  people_also_ask?: any[];
  ads?: any[];
}

export async function searchGoogle(
  query: string,
  apiKey: string,
  page: number = 0
): Promise<ScrapingDogResponse> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query: query,
    results: '10', // Max per page
    country: 'es', // Spain
    page: page.toString(),
    advance_search: 'false',
  });

  try {
    const response = await fetch(`${SCRAPINGDOG_BASE_URL}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Scrapingdog API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as ScrapingDogResponse;
  } catch (error) {
    console.error('Error fetching from Scrapingdog:', error);
    throw error;
  }
}


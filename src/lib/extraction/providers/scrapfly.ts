import { normalizeScrapedData } from '@/lib/scraper-normalizer';

/**
 * Fetches HTML from a URL using Scrapfly API with anti-bot bypass.
 */
export async function fetchWithScrapfly(url: string): Promise<string> {
  let retryCount = 0;
  const maxRetries = 3;
  let scrapflyRes: Response | null = null;
  let scrapflyJson: any = null;

  while (retryCount <= maxRetries) {
    try {
      console.log(`📡 Calling Scrapfly API...${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}`);
      
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), 45000); // 45 second timeout
      
      const params = new URLSearchParams({
        key: process.env.SCRAPFLY_KEY || '',
        url: url,
        country: 'ES',
        asp: 'true',
        render_js: 'true',
        wait: '3000'
      });
      
      scrapflyRes = await fetch(`https://api.scrapfly.io/scrape?${params}`, {
        signal: ac.signal
      });
      
      clearTimeout(timeoutId);
      
      if (scrapflyRes.ok) {
        const scrapflyData = await scrapflyRes.json();
        if (scrapflyData.result && scrapflyData.result.error) {
          const error = scrapflyData.result.error;
          if (error.code === 'ERR::SCRAPE::OPERATION_TIMEOUT' && retryCount < maxRetries) {
            retryCount++;
            console.log(`⚠️ Scrapfly operation timeout, retrying in 3 seconds... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          } else {
            throw new Error(`Scrapfly error: ${error.message || error.description}`);
          }
        }
        console.log('✅ Scrapfly response received');
        scrapflyJson = scrapflyData;
        break;
      } else if (scrapflyRes.status === 504 && retryCount < maxRetries) {
        retryCount++;
        console.log(`⚠️ Scrapfly timeout (504), retrying in 3 seconds... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      } else {
        throw new Error(`Scrapfly error ${scrapflyRes.status}`);
      }
    } catch (error) {
      const err = error as any;
      if (err?.name === 'AbortError' && retryCount < maxRetries) {
        retryCount++;
        console.log(`⚠️ Scrapfly timeout, retrying in 2 seconds... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      } else {
        throw new Error(`Scrapfly connection failed: ${(err && err.message) || 'unknown error'}`);
      }
    }
  }

  if (!scrapflyRes || !scrapflyRes.ok) {
    throw new Error('Failed to get response from Scrapfly after retries');
  }

  const scrapflyData = scrapflyJson || await scrapflyRes.json();
  return scrapflyData?.result?.content || '';
}


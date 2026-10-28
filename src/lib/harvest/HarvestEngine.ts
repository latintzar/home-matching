
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { callGeminiRest } from '@/lib/gemini-rest-client';

/**
 * THE HARVEST ENGINE (Self-Healing Scraper Logic)
 * 
 * UPGRADES:
 * 1. Observation Mode: Defaults to NOT saving listings to DB.
 * 2. Smart Discovery: Finds "Search Page" from Homepage.
 * 3. Selector Learning: Learns how to extract listings.
 */
export class HarvestEngine {
  private supabase: any;
  private dryRun: boolean;
  
  constructor(options: { dryRun?: boolean } = {}) {
    // Service role client for admin access
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (url && key) {
        this.supabase = createClient(url, key);
    } else {
        console.warn('HarvestEngine initialized without keys. DB operations will fail.');
        this.supabase = null;
    }
    
    // Default to TRUE (Observation Mode) to save money/storage
    this.dryRun = options.dryRun !== false; 
  }

  /**
   * Main Entry Point: Process a single domain
   */
  async processDomain(domain: string, seedUrl: string): Promise<{ success: boolean; count?: number; usedAI?: boolean; selectors?: any; error?: string }> {
    console.log(`🚜 Processing ${domain} (${seedUrl})... [Mode: ${this.dryRun ? 'OBSERVATION' : 'HARVEST'}]`);

    if (!this.supabase) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    // 1. Fetch Rules
    const { data: rule } = await this.supabase
      .from('scraping_rules')
      .select('*')
      .eq('domain', domain)
      .maybeSingle();

    const ruleData = rule as any;

    // 2. Smart Discovery: If seed is homepage, find the real search page
    let targetUrl = seedUrl;
    
    // If target is root (e.g. savills.com/) we might need to find the search page
    // We can add a check: if (isHomepage(targetUrl)) { ... }
    // For now, let's assume Teacher Mode can handle navigation if we tell it to.
    // UPDATE: We add a dedicated prompt to find the search page if the initial fetch is a homepage.
    
    // 3. Fetch HTML
    let html = '';
    try {
      const res = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      html = await res.text();
    } catch (e: any) {
      console.error(`❌ Fetch failed for ${domain}:`, e.message);
      await this.logFailure(domain, e.message);
      return { success: false, error: e.message };
    }

    // 4. Decide Mode: Student (Cheerio) vs Teacher (Gemini)
    let listings: any[] = [];
    let usedAI = false;
    let learnedSelectors = null;

    if (ruleData?.selectors && ruleData.status === 'active') {
      // STUDENT MODE
      console.log(`🎓 Student Mode: Using cached selectors for ${domain}`);
      try {
        listings = this.extractWithCheerio(html, ruleData.selectors);
        
        if (listings.length === 0) {
          console.warn(`⚠️ Student Mode failed (0 listings). Promoting to Teacher Mode.`);
          usedAI = true; 
        } else {
          console.log(`✅ Student Mode Success: Found ${listings.length} listings.`);
          await this.logSuccess(domain, listings.length);
        }
      } catch (e) {
        console.warn(`⚠️ Student Mode crash. Promoting to Teacher Mode.`);
        usedAI = true;
      }
    } else {
      usedAI = true;
    }

    // TEACHER MODE
    if (usedAI) {
      console.log(`👨‍🏫 Teacher Mode: Analyzing ${domain} with Gemini 3 Pro...`);
      
      // Check if we are on a homepage vs search page
      // Heuristic: Homepages usually have <nav> but no "list of properties"
      // We'll ask Gemini to decide if it needs to navigate.
      
      const result = await this.extractWithGemini(html, targetUrl);
      
      if (result.success) {
        // If Gemini found a better URL (Search Page), update the queue!
        if (result.searchPageUrl && result.searchPageUrl !== seedUrl) {
            console.log(`📍 Discovered Search Page: ${result.searchPageUrl}`);
            await this.supabase.from('harvest_queue').update({
                seed_url: result.searchPageUrl
            }).eq('domain', domain);
            
            // RECURSE: Process the new URL immediately
            return this.processDomain(domain, result.searchPageUrl);
        }

        listings = result.listings || [];
        learnedSelectors = result.selectors;
        
        // Save the learned rules!
        if (result.selectors) {
          console.log(`🧠 Learned new selectors for ${domain}`);
          await this.supabase.from('scraping_rules').upsert({
            domain: domain,
            selectors: result.selectors,
            status: 'active',
            confidence_score: 0.9,
            last_success: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'domain' });
        }
      } else {
        await this.logFailure(domain, "Teacher Mode Failed: " + result.error);
        return { success: false, error: result.error };
      }
    }

    // 5. Ingest Listings (Or Just Count them in Observation Mode)
    if (listings.length > 0) {
        if (this.dryRun) {
            console.log(`🔭 OBSERVATION: Found ${listings.length} listings on ${domain}. Saving to Listing Map...`);
            
            // In Observation Mode, we save to listing_map instead of ingest
            const mapItems = listings.map(l => ({
                url: l.url,
                domain: domain,
                price_signal: l.price ? parseFloat(l.price.replace(/[^0-9.]/g, '')) : null,
                title_signal: l.title,
                last_seen: new Date().toISOString(),
                status: 'discovered'
            }));
            
            // Upsert to map (Update last_seen if exists)
            const { error } = await this.supabase.from('listing_map').upsert(mapItems, { onConflict: 'url' });
            
            if (error) {
                console.error('Failed to update listing_map:', error.message);
            } else {
                console.log(`🗺️ Updated map with ${listings.length} URLs`);
            }

        } else {
            console.log(`💾 HARVEST: Ingesting ${listings.length} listings...`);
            // Call Ingest API logic here
        }
    }

    return { success: true, count: listings.length, usedAI, selectors: learnedSelectors };
  }

  /**
   * Student Mode: Fast Regex/Cheerio extraction
   */
  private extractWithCheerio(html: string, selectors: any): any[] {
    const $ = cheerio.load(html);
    const listings: any[] = [];
    
    try {
        const itemSelector = selectors.item_selector || selectors.list_item; // Support legacy keys
        if (!itemSelector) return [];

        $(itemSelector).each((_, el) => {
          const $el = $(el);
          const linkSelector = selectors.link_selector || 'a';
          const link = $el.find(linkSelector).attr('href');
          if (!link) return;

          const item: any = { url: link };
          
          // Extract fields
          if (selectors.fields) {
              for (const [field, selector] of Object.entries(selectors.fields)) {
                item[field] = $el.find(selector as string).text().trim();
              }
          }
          
          listings.push(item);
        });
    } catch (e) {
        console.warn('Cheerio extraction error:', e);
    }

    return listings;
  }

  /**
   * Teacher Mode: AI Extraction + Rule Generation
   */
  private async extractWithGemini(html: string, url: string) {
    // Clean HTML to save tokens
    const $ = cheerio.load(html);
    $('script, style, svg, path, noscript, iframe').remove();
    // More aggressive cleaning: remove huge blocks of text
    $('p').each((_, el) => { if ($(el).text().length > 500) $(el).remove(); });
    
    const cleanHtml = $('body').html()?.substring(0, 40000) || ''; // Limit to 40k chars

    const prompt = `
    I am scraping a real estate website: ${url}
    
    HTML CONTENT:
    ${cleanHtml}
    
    TASK 1: Identify if this is a "Homepage" or a "Property List Page".
    - If Homepage: Find the best link to "Buy Properties" (Search/Listings page).
    - If List Page: Extract the first 5 listings.

    TASK 2: Reverse-engineer the CSS Selectors I can use to extract ALL listings deterministically next time.
    
    OUTPUT JSON:
    {
      "page_type": "homepage" | "list",
      "search_page_url": "absolute url if found (only for homepage)",
      "listings": [
        { "title": "...", "price": "...", "url": "..." }
      ],
      "selectors": {
        "item_selector": "css selector for the card container (e.g. .property-card)",
        "link_selector": "css selector for the detail link relative to card (e.g. a.link)",
        "fields": {
           "price": "css selector for price",
           "title": "css selector for title"
        }
      }
    }
    `;

    const res = await callGeminiRest(prompt, {
      model: 'gemini-3-pro-preview',
      responseMimeType: 'application/json',
      temperature: 0
    });

    if (!res.success || !res.text) {
      return { success: false, error: res.error };
    }

    try {
      // Clean Markdown
      const jsonStr = res.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const data = JSON.parse(jsonStr);
      
      // Smart Discovery: Handle Homepage Redirection
      if (data.page_type === 'homepage' && data.search_page_url) {
          // Validate URL (ensure absolute)
          let nextUrl = data.search_page_url;
          if (!nextUrl.startsWith('http')) {
              const baseUrl = new URL(url).origin;
              nextUrl = new URL(nextUrl, baseUrl).toString();
          }
          return { success: true, searchPageUrl: nextUrl };
      }

      return { success: true, listings: data.listings, selectors: data.selectors };
    } catch (e: any) {
      return { success: false, error: "JSON Parse Error: " + e.message };
    }
  }

  private async logSuccess(domain: string, count: number) {
    await this.supabase.from('harvest_queue').update({
      last_run: new Date().toISOString(),
      status: 'completed',
      next_run: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // +24h
    }).eq('domain', domain);

    // Only update stats if not dry run? No, update stats so we know it works.
    await this.supabase.from('scraping_rules').update({
      successful_runs: 1, // Need RPC for increment, this just sets to 1
      last_success: new Date().toISOString()
    }).eq('domain', domain);
  }

  private async logFailure(domain: string, error: string) {
    await this.supabase.from('harvest_queue').update({
      status: 'failed',
      // retry_count: 1 
    }).eq('domain', domain);
    
    await this.supabase.from('scraping_rules').update({
        last_error: error,
        last_failure: new Date().toISOString()
    }).eq('domain', domain);
  }
}

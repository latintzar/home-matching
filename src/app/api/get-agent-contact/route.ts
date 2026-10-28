/**
 * API Route: Get Agent Contact
 * 
 * For domains that require JS rendering (E&V, RE/MAX), this endpoint
 * fetches the page with ScrapFly JS rendering and extracts agent contact.
 */

import { NextRequest, NextResponse } from 'next/server';

const SCRAPFLY_KEY = process.env.SCRAPFLY_KEY;

interface AgentContact {
  phone: string | null;
  name: string | null;
  email: string | null;
}

// Extract agent contact from E&V rendered HTML
function extractEVContact(html: string): AgentContact {
  let phone: string | null = null;
  let name: string | null = null;
  let email: string | null = null;
  
  // Phone: <a href="tel:+34 93 515 44 44">
  const phoneMatch = html.match(/href="tel:([^"]+)"/);
  if (phoneMatch) {
    phone = phoneMatch[1].trim();
  }
  
  // Advisor name: Your advisor: Francesc Garcia
  const advisorMatch = html.match(/Your advisor:\s*([^<]+)/i);
  if (advisorMatch) {
    name = advisorMatch[1].trim();
  }
  
  // Try Spanish version too
  if (!name) {
    const asesorMatch = html.match(/Tu asesor:\s*([^<]+)/i);
    if (asesorMatch) {
      name = asesorMatch[1].trim();
    }
  }
  
  return { phone, name, email };
}

// Extract agent contact from RE/MAX rendered HTML
function extractREMAXContact(html: string): AgentContact {
  let phone: string | null = null;
  let name: string | null = null;
  let email: string | null = null;
  
  // RE/MAX typically has phone in tel: links
  const phoneMatch = html.match(/href="tel:([^"]+)"/);
  if (phoneMatch) {
    phone = phoneMatch[1].trim();
  }
  
  // Try to find agent name in common patterns
  const agentMatch = html.match(/data-agent-name="([^"]+)"/i) ||
                     html.match(/class="agent[^"]*name[^"]*"[^>]*>([^<]+)/i) ||
                     html.match(/"agentName"\s*:\s*"([^"]+)"/);
  if (agentMatch) {
    name = agentMatch[1].trim();
  }
  
  // Try email
  const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@remax[a-zA-Z0-9.-]+)/i);
  if (emailMatch) {
    email = emailMatch[1];
  }
  
  return { phone, name, email };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const domain = searchParams.get('domain');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }
  
  if (!SCRAPFLY_KEY) {
    return NextResponse.json({ error: 'ScrapFly not configured' }, { status: 500 });
  }
  
  try {
    // Fetch with ScrapFly JS rendering
    const scrapflyUrl = new URL('https://api.scrapfly.io/scrape');
    scrapflyUrl.searchParams.set('key', SCRAPFLY_KEY);
    scrapflyUrl.searchParams.set('url', url);
    scrapflyUrl.searchParams.set('country', 'ES');
    scrapflyUrl.searchParams.set('render_js', 'true');
    scrapflyUrl.searchParams.set('wait', '3000'); // Wait for JS to render
    scrapflyUrl.searchParams.set('asp', 'true'); // Anti-bot protection
    
    const response = await fetch(scrapflyUrl.toString(), {
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      throw new Error(`ScrapFly returned ${response.status}`);
    }
    
    const data = await response.json();
    const html = data.result?.content || '';
    
    if (!html) {
      return NextResponse.json({ error: 'No content returned' }, { status: 500 });
    }
    
    // Extract contact based on domain
    let contact: AgentContact;
    
    if (domain === 'engelvoelkers.com') {
      contact = extractEVContact(html);
    } else if (domain === 'remax.es') {
      contact = extractREMAXContact(html);
    } else {
      // Generic extraction
      const phoneMatch = html.match(/href="tel:([^"]+)"/);
      contact = {
        phone: phoneMatch ? phoneMatch[1].trim() : null,
        name: null,
        email: null,
      };
    }
    
    return NextResponse.json(contact);
    
  } catch (error: any) {
    console.error('Error fetching agent contact:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}


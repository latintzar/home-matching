/**
 * Photo Proxy API Endpoint
 * 
 * Proxies photo requests to avoid CORS issues.
 * Part of the Fetch-and-Dump pattern - we don't store photos,
 * we fetch them on-demand from agency CDNs.
 * 
 * Usage: GET /api/photo-proxy?url=<encoded-url>
 */

import { NextRequest, NextResponse } from 'next/server';

// Allowed domains (only proxy photos from known real estate sites)
const ALLOWED_DOMAINS = [
  'img3.idealista.com',
  'img4.idealista.com',
  'imgmediagallery.idealista.com',
  'st.cdn-inmobiliaria.com',
  'cdn.resales-online.com',
  'static.inmofactory.com',
  'fotos.pisos.com',
  'images.habcdn.com',
  'cdn.inmuebles24.com',
  // Add more as needed - or allow all for now
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { error: 'Missing url parameter' },
      { status: 400 }
    );
  }
  
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(url);
    new URL(decodedUrl); // Validate URL format
  } catch {
    return NextResponse.json(
      { error: 'Invalid URL' },
      { status: 400 }
    );
  }
  
  // For now, allow all domains (can restrict later)
  // const hostname = new URL(decodedUrl).hostname;
  // if (!ALLOWED_DOMAINS.some(d => hostname.includes(d))) {
  //   return NextResponse.json(
  //     { error: 'Domain not allowed' },
  //     { status: 403 }
  //   );
  // }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(decodedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'image/*',
        'Referer': new URL(decodedUrl).origin,
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      );
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const data = await response.arrayBuffer();
    
    // Return the image with appropriate headers
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }
    
    console.error('Photo proxy error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}


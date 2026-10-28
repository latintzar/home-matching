import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`🔍 Debug: Fetching HTML for ${url}`);

    // Use Scrapfly to get the HTML (same format as robust scraper)
    const params = new URLSearchParams({
      key: '',
      url: url,
      country: 'ES',
      asp: 'true',
      render_js: 'true',
      wait: '3000'
    });
    
    const scrapflyResponse = await fetch(`https://api.scrapfly.io/scrape?${params}`);

    if (!scrapflyResponse.ok) {
      throw new Error(`Scrapfly error: ${scrapflyResponse.status}`);
    }

    const scrapflyData = await scrapflyResponse.json();
    const htmlContent = scrapflyData?.result?.content || '';

    // Check for photo-related content
    const hasFullScreenGallery = htmlContent.includes('fullScreenGalleryPics');
    const hasAdMultimediasInfo = htmlContent.includes('adMultimediasInfo');
    
    // Find the line with fullScreenGalleryPics
    const lines = htmlContent.split('\n');
    const galleryLine = lines.find((line: string) => line.includes('fullScreenGalleryPics'));
    
    // Try to extract the photos array
    let photosArray = null;
    if (galleryLine) {
      try {
        // The galleryLine contains the full array, so we need to extract it properly
        // Look for the opening bracket and find the matching closing bracket
        const startIndex = galleryLine.indexOf('[');
        if (startIndex !== -1) {
          let bracketCount = 0;
          let endIndex = startIndex;
          
          for (let i = startIndex; i < galleryLine.length; i++) {
            if (galleryLine[i] === '[') bracketCount++;
            if (galleryLine[i] === ']') bracketCount--;
            if (bracketCount === 0) {
              endIndex = i;
              break;
            }
          }
          
          const arrayString = galleryLine.substring(startIndex, endIndex + 1);
          photosArray = JSON.parse(arrayString);
        }
      } catch (e) {
        console.log('Failed to parse photos array:', e);
        console.log('Gallery line preview:', galleryLine.substring(0, 200));
      }
    }

    return NextResponse.json({
      success: true,
      htmlLength: htmlContent.length,
      hasFullScreenGallery,
      hasAdMultimediasInfo,
      galleryLine: galleryLine ? galleryLine.substring(0, 500) : null,
      photosCount: photosArray ? photosArray.length : 0,
      photosPreview: photosArray ? photosArray.slice(0, 3).map((p: any) => ({
        url: p.imageDataService,
        tag: p.tag,
        title: p.title
      })) : null
    });

  } catch (error) {
    console.error('Debug HTML error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

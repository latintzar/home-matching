import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';

// Lazy initialization to avoid build-time errors
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  return createClient(url, key);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const supabase = getSupabase();

    // 1. Fetch agent's current logo
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, logo_url')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.logo_url) {
      return NextResponse.json({ success: false, error: 'Agent has no logo to upscale' }, { status: 400 });
    }

    console.log(`🖼️ Upscaling logo for agent ${agent.name} (ID: ${agentId})`);
    console.log(`📥 Original logo URL: ${agent.logo_url}`);

    // 2. Download the original logo and convert to base64
    const logoResponse = await fetch(agent.logo_url);
    if (!logoResponse.ok) {
      throw new Error(`Failed to download logo: HTTP ${logoResponse.status}`);
    }

    const logoBuffer = await logoResponse.arrayBuffer();
    const base64Logo = Buffer.from(logoBuffer).toString('base64');
    
    // Determine content type from URL or response headers, default to jpeg
    let contentType = logoResponse.headers.get('content-type') || 'image/jpeg';
    const urlLower = agent.logo_url.toLowerCase();
    if (urlLower.includes('.gif')) contentType = 'image/gif';
    else if (urlLower.includes('.png')) contentType = 'image/png';
    else if (urlLower.includes('.webp')) contentType = 'image/webp';
    else if (urlLower.includes('.jpeg') || urlLower.includes('.jpg')) contentType = 'image/jpeg';
    
    // For Gemini, convert GIF/WebP to PNG/jpeg - use image/png as safe default for upscaling
    const geminiMimeType = contentType.includes('gif') || contentType.includes('webp') 
      ? 'image/png' 
      : (contentType.includes('png') ? 'image/png' : 'image/jpeg');

    console.log(`✅ Downloaded logo (${contentType}, ${logoBuffer.byteLength} bytes)`);

    // 3. Initialize Vertex AI
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    if (!projectId) throw new Error('Missing GOOGLE_CLOUD_PROJECT_ID');
    
    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-3-pro-image-preview',
      generationConfig: {
        temperature: 0,
        topP: 0.95,
        maxOutputTokens: 32768,
        responseModalities: ['IMAGE'],
      } as any,
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
      ] as any,
    });

    // 4. Generate upscaled image with 21:9 aspect ratio
    // Match Python example: image part first, then text
    const prompt = 'upscale this image';
    const contents = [{
      role: 'user' as const,
      parts: [
        { inlineData: { mimeType: geminiMimeType as 'image/jpeg' | 'image/png', data: base64Logo } },
        { text: prompt },
      ],
    }];

    console.log('🤖 Calling Gemini to upscale logo...');
    const result = await model.generateContent({ contents });

    // 5. Extract the generated image
    const generatedImage = (result as any)?.response?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p?.inlineData
    )?.inlineData;

    if (!generatedImage?.data) {
      return NextResponse.json({ success: false, error: 'Failed to generate upscaled image' }, { status: 500 });
    }

    console.log('✅ Generated upscaled image');

    // 6. Save to Supabase Storage
    const pngBuffer = Buffer.from(generatedImage.data, 'base64');
    const storagePath = `agents/${agentId}/logo_upscaled.png`;

    const { error: uploadError } = await supabase.storage
      .from('property-images')
      .upload(storagePath, pngBuffer, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return NextResponse.json({ success: false, error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // 7. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('property-images')
      .getPublicUrl(storagePath);

    const upscaledLogoUrl = publicUrlData.publicUrl;

    console.log(`✅ Upscaled logo saved: ${upscaledLogoUrl}`);

    // 8. Update agents table with the upscaled logo URL
    const { error: updateError } = await supabase
      .from('agents')
      .update({ logo_url: upscaledLogoUrl })
      .eq('id', agentId);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json({ success: false, error: `Database update failed: ${updateError.message}` }, { status: 500 });
    }

    console.log(`✅ Agent logo updated in database`);

    return NextResponse.json({
      success: true,
      agentId: agentId,
      originalLogoUrl: agent.logo_url,
      upscaledLogoUrl,
    });

  } catch (error: any) {
    console.error('❌ Error upscaling agent logo:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}


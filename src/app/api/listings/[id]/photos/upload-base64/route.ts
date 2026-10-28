import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { storeFileInSupabase } from '@/lib/photo-storage';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;

  try {
    const body = await request.json();
    const { image, index, label } = body;

    if (!image || typeof image !== 'string') {
        return NextResponse.json({ success: false, error: 'No image data provided' }, { status: 400, headers: corsHeaders() });
    }

    console.log(`📸 Uploading background photo ${index} for listing ${listingId}`);

    // Strip header
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    // Get extension
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mimeType.split('/')[1] || 'jpg';
    const filename = `extension_${index}_${Date.now()}.${ext}`;

    // Upload
    const result = await storeFileInSupabase(
        arrayBuffer,
        mimeType,
        listingId,
        filename
    );

    if (!result.success || !result.supabaseUrl) {
        throw new Error(result.error || 'Upload failed');
    }

    // Link
    const { error: dbError } = await supabaseAdmin
      .from('listing_photos')
      .insert({
        listing_id: listingId,
        url: result.supabaseUrl,
        display_order: index || 0,
        photo_type: 'general',
        filename: filename,
        tag: label || null
      });

    if (dbError) {
        console.error('Failed to link photo:', dbError);
        // Don't fail the request if just linking failed, but log it
    } else {
        console.log(`✅ Background photo ${index} uploaded and linked`);
    }

    return NextResponse.json({ success: true, url: result.supabaseUrl }, { headers: corsHeaders() });

  } catch (error: any) {
    console.error('❌ Background Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders() });
  }
}


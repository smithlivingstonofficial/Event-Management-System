import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text') || '';
  
  if (!text) {
    return NextResponse.json({ error: 'Text query parameter is required' }, { status: 400 });
  }

  try {
    const svg = await QRCode.toString(text, { type: 'svg', margin: 2 });
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (err) {
    console.error('QR code generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

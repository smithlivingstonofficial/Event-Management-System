import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestor = searchParams.get('requestor');
    
    if (!requestor) {
      return NextResponse.json({ error: "Missing identity profile." }, { status: 400 });
    }

    const admins = getBcaDb('admins.json');
    return NextResponse.json(admins.map(u => ({ username: u.username })));
  } catch (error) {
    console.error('API Error listing admins:', error);
    return NextResponse.json({ error: 'Failed to retrieve admin accounts list' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function GET() {
  try {
    const masterList = getBcaDb('students_master.json');
    return NextResponse.json(masterList);
  } catch (error) {
    console.error('API Error master student list:', error);
    return NextResponse.json({ error: 'Failed to load master student list' }, { status: 500 });
  }
}

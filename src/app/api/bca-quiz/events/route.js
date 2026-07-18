import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function GET() {
  try {
    const eventsConfig = getBcaDb('events.json', { events: [] });
    return NextResponse.json(eventsConfig);
  } catch (error) {
    console.error('API Error fetching events list:', error);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}

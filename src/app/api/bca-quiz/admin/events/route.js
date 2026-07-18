import { NextResponse } from 'next/server';
import { getBcaDb, saveBcaDb } from '@/lib/bca-quiz/db';

export async function POST(request) {
  try {
    const updatedEventsObj = await request.json();
    if (!updatedEventsObj || !Array.isArray(updatedEventsObj.events)) {
      return NextResponse.json({ success: false, message: "Invalid setup schema formatting parameters." }, { status: 400 });
    }

    saveBcaDb('events.json', updatedEventsObj);
    return NextResponse.json({ success: true, message: "Competition systems maps configured successfully!" });
  } catch (error) {
    console.error('API Error saving events config:', error);
    return NextResponse.json({ success: false, error: 'Disk storage file synchronization collapsed.' }, { status: 500 });
  }
}

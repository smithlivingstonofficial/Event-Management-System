import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const regNo = searchParams.get('regNo');
    
    const students = getBcaDb('students.json');
    
    if (regNo) {
      const filtered = students.filter(s => s.regNo === regNo);
      return NextResponse.json(filtered);
    }
    
    return NextResponse.json(students);
  } catch (error) {
    console.error('API Error submitted students:', error);
    return NextResponse.json({ error: 'Failed to load submitted students ledger' }, { status: 500 });
  }
}

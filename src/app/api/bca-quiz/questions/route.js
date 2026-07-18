import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function GET() {
  try {
    const questions = getBcaDb('questions.json');
    const safeQuestions = questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options
    }));
    return NextResponse.json(safeQuestions);
  } catch (error) {
    console.error('API Error questions list:', error);
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
  }
}

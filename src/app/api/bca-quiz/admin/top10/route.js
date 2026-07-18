import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function GET() {
  try {
    const submissions = getBcaDb('students.json');
    const eventsConfig = getBcaDb('events.json', { events: [] });
    
    const top10Result = {};

    eventsConfig.events.forEach(evt => {
      const eventName = evt.name;
      const eventSubmissions = submissions.filter(s => s.eventName === eventName);

      // Sort by score (descending), then by submittedAt (ascending)
      eventSubmissions.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });

      top10Result[eventName] = eventSubmissions.slice(0, 10).map((s, index) => ({
        rank: index + 1,
        name: s.name,
        regNo: s.regNo,
        dept: s.dept,
        teamName: s.teamName,
        score: s.score,
        totalQuestions: s.totalQuestions || 10,
        timeSpent: s.submittedAt
      }));
    });

    return NextResponse.json(top10Result);
  } catch (error) {
    console.error('API Error compiling top10:', error);
    return NextResponse.json({ error: 'Failed compiling top leaderboard matrices.' }, { status: 500 });
  }
}

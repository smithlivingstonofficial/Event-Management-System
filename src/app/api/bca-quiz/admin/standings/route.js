import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function GET() {
  try {
    const submissions = getBcaDb('students.json');
    const eventsConfig = getBcaDb('events.json', { events: [] });
    
    const standingsResult = {};

    eventsConfig.events.forEach(evt => {
      const eventName = evt.name;
      const eventSubmissions = submissions.filter(s => s.eventName === eventName);

      // Sort by score (descending), then by submittedAt (ascending - faster completion is better)
      eventSubmissions.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });

      const winner = eventSubmissions[0] ? {
        name: eventSubmissions[0].name,
        regNo: eventSubmissions[0].regNo,
        collegeName: eventSubmissions[0].collegeName || "N/A",
        teamName: eventSubmissions[0].teamName,
        score: eventSubmissions[0].score
      } : null;

      const runner = eventSubmissions[1] ? {
        name: eventSubmissions[1].name,
        regNo: eventSubmissions[1].regNo,
        collegeName: eventSubmissions[1].collegeName || "N/A",
        teamName: eventSubmissions[1].teamName,
        score: eventSubmissions[1].score
      } : null;

      standingsResult[eventName] = { winner, runner };
    });

    return NextResponse.json(standingsResult);
  } catch (error) {
    console.error('API Error compiling standings:', error);
    return NextResponse.json({ error: 'Failed compiling standing standings tables dashboards.' }, { status: 500 });
  }
}

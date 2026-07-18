import { NextResponse } from 'next/server';
import { getBcaDb, saveBcaDb } from '@/lib/bca-quiz/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestor, regNo, score, eventName, name, dept, participantType, teamName } = body;

    if (!requestor) {
      return NextResponse.json({ success: false, message: "Tracking token missing: Action rejected." }, { status: 401 });
    }

    const submissions = getBcaDb('students.json');
    let record = submissions.find(s => s.regNo === regNo);

    if (record) {
      record.score = parseInt(score, 10);
      record.awardedBy = requestor;
      record.modifiedAt = new Date().toISOString();
    } else {
      submissions.push({
        eventName: eventName || "Manual Entry",
        name: name || "Unknown Student",
        regNo,
        dept: dept || "BCA",
        participantType: participantType || "Solo",
        teamName: teamName || null,
        score: parseInt(score, 10),
        totalQuestions: 10,
        submittedAt: new Date().toISOString(),
        awardedBy: requestor
      });
    }

    saveBcaDb('students.json', submissions);
    return NextResponse.json({ success: true, message: `Score updated to ${score} by admin "${requestor}" successfully!` });
  } catch (error) {
    console.error('API Error manually updating score:', error);
    return NextResponse.json({ success: false, error: 'Internal database writing process collapsed.' }, { status: 500 });
  }
}

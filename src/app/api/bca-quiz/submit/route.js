import { NextResponse } from 'next/server';
import { getBcaDb, saveBcaDb } from '@/lib/bca-quiz/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventName, name, regNo, dept, participantType, teamName, answers } = body;

    if (!eventName || !name || !regNo || !dept || !participantType) {
      return NextResponse.json({
        success: false,
        message: "All fields are required"
      }, { status: 400 });
    }

    if (participantType === "Team" && !teamName) {
      return NextResponse.json({
        success: false,
        message: "Team name is required"
      }, { status: 400 });
    }

    const students = getBcaDb('students.json');
    const alreadySubmitted = students.find(s => s.regNo === regNo);
    
    if (alreadySubmitted) {
      return NextResponse.json({
        success: false,
        message: "You have already submitted the quiz"
      }, { status: 400 });
    }

    const questions = getBcaDb('questions.json');
    let score = 0;
    questions.forEach(q => {
      if (answers[`q${q.id}`] === q.answer) {
        score++;
      }
    });

    const newStudent = {
      eventName,
      name,
      regNo,
      dept,
      participantType,
      teamName: participantType === "Team" ? teamName : null,
      score,
      totalQuestions: questions.length,
      submittedAt: new Date().toISOString()
    };

    students.push(newStudent);
    saveBcaDb('students.json', students);

    return NextResponse.json({
      success: true,
      score,
      total: questions.length,
      message: `Quiz submitted successfully!`
    });
  } catch (error) {
    console.error('API Error submitting quiz:', error);
    return NextResponse.json({ success: false, message: 'Internal server error submitting quiz' }, { status: 500 });
  }
}

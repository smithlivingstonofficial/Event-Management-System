import { NextResponse } from 'next/server';
import { getBcaDb, saveBcaDb } from '@/lib/bca-quiz/db';

export async function POST(request) {
  try {
    const { requestor, studentsData } = await request.json();

    if (!requestor) {
      return NextResponse.json({ success: false, message: "Missing administrator tracking identity profile." }, { status: 400 });
    }
    if (!Array.isArray(studentsData)) {
      return NextResponse.json({ success: false, message: "Invalid data format layout." }, { status: 400 });
    }

    // Read current submissions ledger
    const liveSubmissions = getBcaDb('students.json');

    // Sync or award manual scores from Excel grid
    studentsData.forEach(excelStudent => {
      if (!excelStudent.regNo) return;

      let existingSubmission = liveSubmissions.find(s => s.regNo === excelStudent.regNo);

      if (excelStudent.score !== null && excelStudent.score !== undefined && excelStudent.score !== "") {
        const manualScore = parseInt(excelStudent.score, 10);
        
        if (existingSubmission) {
          if (existingSubmission.score !== manualScore) {
            existingSubmission.score = manualScore;
            existingSubmission.awardedBy = requestor;
            existingSubmission.modifiedAt = new Date().toISOString();
          }
        } else {
          liveSubmissions.push({
            eventName: excelStudent.events && excelStudent.events[0] ? excelStudent.events[0].eventName : "Manual Entry",
            name: excelStudent.name,
            regNo: excelStudent.regNo,
            dept: excelStudent.dept || "BCA",
            participantType: excelStudent.events && excelStudent.events[0] ? excelStudent.events[0].participantType : "Solo",
            teamName: excelStudent.events && excelStudent.events[0] ? excelStudent.events[0].teamName : null,
            score: manualScore,
            totalQuestions: 10,
            submittedAt: new Date().toISOString(),
            awardedBy: requestor
          });
        }
      }
    });

    // Write to both data pools
    saveBcaDb('students_master.json', studentsData);
    saveBcaDb('students.json', liveSubmissions);

    return NextResponse.json({ success: true, message: `Master student records and score ledgers updated by "${requestor}" successfully!` });
  } catch (error) {
    console.error('API Error saving students spreadsheet:', error);
    return NextResponse.json({ success: false, error: 'Disk workspace sync execution failed.' }, { status: 500 });
  }
}

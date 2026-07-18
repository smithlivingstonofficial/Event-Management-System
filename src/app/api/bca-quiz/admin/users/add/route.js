import { NextResponse } from 'next/server';
import { getBcaDb, saveBcaDb } from '@/lib/bca-quiz/db';

export async function POST(request) {
  try {
    const { requestor, username, password } = await request.json();

    if (!requestor || requestor.toLowerCase() !== "durai") {
      return NextResponse.json({ success: false, message: "❌ Security Violation: Only DuraiKumaran can add Admin Users!" }, { status: 403 });
    }

    if (!username || !password) {
      return NextResponse.json({ success: false, message: "Fields cannot be empty." }, { status: 400 });
    }

    const admins = getBcaDb('admins.json');
    const lowerUser = username.trim().toLowerCase();
    
    if (admins.some(u => u.username.toLowerCase() === lowerUser)) {
      return NextResponse.json({ success: false, message: "User already exists." }, { status: 400 });
    }

    admins.push({ username: lowerUser, password });
    saveBcaDb('admins.json', admins);

    return NextResponse.json({ success: true, message: `Successfully added admin user: "${lowerUser}"` });
  } catch (error) {
    console.error('API Error adding admin user:', error);
    return NextResponse.json({ success: false, message: 'Internal server error creating admin account' }, { status: 500 });
  }
}

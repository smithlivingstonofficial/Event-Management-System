import { NextResponse } from 'next/server';
import { getBcaDb, saveBcaDb } from '@/lib/bca-quiz/db';

export async function POST(request) {
  try {
    const { requestor, username } = await request.json();

    if (!requestor || requestor.toLowerCase() !== "durai") {
      return NextResponse.json({ success: false, message: "❌ Security Violation: Only DuraiKumaran can remove Admin Users!" }, { status: 403 });
    }

    const targetUser = username.trim().toLowerCase();
    if (targetUser === "durai") {
      return NextResponse.json({ success: false, message: "❌ Cannot remove the primary super-admin account!" }, { status: 400 });
    }

    const admins = getBcaDb('admins.json');
    const index = admins.findIndex(u => u.username.toLowerCase() === targetUser);
    
    if (index === -1) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    admins.splice(index, 1);
    saveBcaDb('admins.json', admins);

    return NextResponse.json({ success: true, message: `Successfully removed admin user: "${targetUser}"` });
  } catch (error) {
    console.error('API Error removing admin user:', error);
    return NextResponse.json({ success: false, message: 'Internal server error deleting admin account' }, { status: 500 });
  }
}

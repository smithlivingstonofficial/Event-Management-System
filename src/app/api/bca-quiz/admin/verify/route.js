import { NextResponse } from 'next/server';
import { getBcaDb } from '@/lib/bca-quiz/db';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: "Username and password fields are required." }, { status: 400 });
    }

    const admins = getBcaDb('admins.json');
    const matchedUser = admins.find(user => 
      user.username.toLowerCase() === username.trim().toLowerCase() && 
      user.password === password
    );

    if (matchedUser) {
      return NextResponse.json({ 
        success: true, 
        message: "Authentication successful.",
        userProfileName: matchedUser.username 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Access Denied: Invalid Username or Password!" 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('API Error admin verification:', error);
    return NextResponse.json({ success: false, message: 'Internal server error verifying credentials' }, { status: 500 });
  }
}

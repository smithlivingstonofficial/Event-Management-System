import { NextResponse } from 'next/server';
import { getBackupList, restoreBackup } from '@/lib/db';

// GET: Returns list of available backup files
export async function GET() {
  const backups = getBackupList();
  return NextResponse.json({ backups });
}

// POST: Restores database to a specific backup file
export async function POST(request) {
  try {
    const { filename } = await request.json();
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }
    const success = restoreBackup(filename);
    if (success) {
      return NextResponse.json({ success: true, message: `Successfully restored backup from ${filename}` });
    } else {
      return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

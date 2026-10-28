import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs/tests');

async function ensureLogsDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

export async function POST(request: Request) {
  try {
    const log = await request.json();
    
    await ensureLogsDir();
    
    // Create filename from run ID and test ID
    const filename = `${log.runId}-test-${log.testId.replace('.', '-')}.json`;
    const filepath = path.join(LOGS_DIR, filename);
    
    // Save with pretty formatting for readability
    await fs.writeFile(filepath, JSON.stringify(log, null, 2));
    
    console.log(`[TestLogger] Saved log: ${filename}`);
    
    return NextResponse.json({ 
      success: true, 
      runId: log.runId,
      file: filename,
      path: filepath 
    });
  } catch (error) {
    console.error('Failed to save test log:', error);
    return NextResponse.json({ 
      error: 'Failed to save log',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


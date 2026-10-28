import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs/tests');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    // Find the log file matching this run ID
    const files = await fs.readdir(LOGS_DIR);
    const logFile = files.find(f => f.startsWith(runId) && f.endsWith('.json') && f !== 'index.json');
    
    if (!logFile) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    }
    
    const filepath = path.join(LOGS_DIR, logFile);
    const data = await fs.readFile(filepath, 'utf-8');
    const log = JSON.parse(data);
    
    return NextResponse.json(log);
  } catch (error) {
    console.error('Failed to load test log:', error);
    return NextResponse.json({ 
      error: 'Failed to load log',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


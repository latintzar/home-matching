import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs/tests');
const INDEX_FILE = path.join(LOGS_DIR, 'index.json');

interface TestRunEntry {
  runId: string;
  runNumber: number;
  testId: string;
  testName: string;
  timestamp: string;
  duration?: number;
  success: boolean;
  verdict?: string;
  logFile: string;
}

interface TestIndex {
  lastRunNumber: number;
  runs: TestRunEntry[];
}

async function ensureLogsDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

async function loadIndex(): Promise<TestIndex> {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { lastRunNumber: 0, runs: [] };
  }
}

async function saveIndex(index: TestIndex): Promise<void> {
  await ensureLogsDir();
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

export async function GET() {
  try {
    const index = await loadIndex();
    return NextResponse.json(index);
  } catch (error) {
    console.error('Failed to load test index:', error);
    return NextResponse.json({ lastRunNumber: 0, runs: [] });
  }
}

export async function POST(request: Request) {
  try {
    const newRun = await request.json();
    const index = await loadIndex();
    
    // Update last run number
    if (newRun.runNumber > index.lastRunNumber) {
      index.lastRunNumber = newRun.runNumber;
    }
    
    // Add log file reference
    const logFile = `${newRun.runId}-test-${newRun.testId.replace('.', '-')}.json`;
    
    // Check if run already exists and update, or add new
    const existingIndex = index.runs.findIndex(r => r.runId === newRun.runId);
    const entry: TestRunEntry = {
      runId: newRun.runId,
      runNumber: newRun.runNumber,
      testId: newRun.testId,
      testName: newRun.testName,
      timestamp: newRun.timestamp,
      duration: newRun.duration,
      success: newRun.success,
      verdict: newRun.verdict,
      logFile,
    };
    
    if (existingIndex >= 0) {
      index.runs[existingIndex] = entry;
    } else {
      index.runs.push(entry);
    }
    
    await saveIndex(index);
    
    return NextResponse.json({ success: true, runId: newRun.runId });
  } catch (error) {
    console.error('Failed to update test index:', error);
    return NextResponse.json({ error: 'Failed to update index' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs', 'tests');
const INDEX_FILE = path.join(LOGS_DIR, 'index.json');

type VerdictType = 'passed' | 'failed' | 'needs-evolution' | 'pending';

interface FollowUp {
  timestamp: string;
  comment: string;
  changesImplemented?: boolean;
  implementedTimestamp?: string;
}

interface TestRun {
  runId: string;
  runNumber: number;
  testId: string;
  testName: string;
  timestamp: string;
  duration: number;
  success: boolean;
  verdict?: VerdictType;
  verdictTimestamp?: string;
  followUps?: FollowUp[];
  logFile: string;
}

interface TestIndex {
  lastRunNumber: number;
  runs: TestRun[];
}

// POST /api/test-logs/verdict - Mark a test run as passed/failed/needs-evolution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, verdict, comment } = body as { 
      runId: string; 
      verdict: VerdictType;
      comment?: string;
    };

    if (!runId || !verdict) {
      return NextResponse.json(
        { error: 'runId and verdict are required' },
        { status: 400 }
      );
    }

    if (!['passed', 'failed', 'needs-evolution'].includes(verdict)) {
      return NextResponse.json(
        { error: 'verdict must be "passed", "failed", or "needs-evolution"' },
        { status: 400 }
      );
    }

    // For needs-evolution, comment is required
    if (verdict === 'needs-evolution' && !comment) {
      return NextResponse.json(
        { error: 'comment is required for needs-evolution verdict' },
        { status: 400 }
      );
    }

    // Load index
    let index: TestIndex;
    try {
      const content = await fs.readFile(INDEX_FILE, 'utf-8');
      index = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Index file not found' },
        { status: 404 }
      );
    }

    // Find the run
    const runIndex = index.runs.findIndex(r => r.runId === runId);
    if (runIndex === -1) {
      return NextResponse.json(
        { error: `Run ${runId} not found` },
        { status: 404 }
      );
    }

    // Update verdict
    const previousVerdict = index.runs[runIndex].verdict;
    index.runs[runIndex].verdict = verdict;
    index.runs[runIndex].verdictTimestamp = new Date().toISOString();

    // Add follow-up comment if provided
    if (comment) {
      if (!index.runs[runIndex].followUps) {
        index.runs[runIndex].followUps = [];
      }
      index.runs[runIndex].followUps.push({
        timestamp: new Date().toISOString(),
        comment
      });
    }

    // Save index
    await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

    // Also update the individual log file
    const logFile = path.join(LOGS_DIR, index.runs[runIndex].logFile);
    try {
      const logContent = await fs.readFile(logFile, 'utf-8');
      const log = JSON.parse(logContent);
      log.verdict = verdict;
      log.verdictTimestamp = index.runs[runIndex].verdictTimestamp;
      
      // Add follow-up to log file too (like Google review response)
      if (comment) {
        if (!log.followUps) {
          log.followUps = [];
        }
        log.followUps.push({
          timestamp: new Date().toISOString(),
          comment,
          // This will be updated when changes are implemented
          changesImplemented: false
        });
      }
      
      await fs.writeFile(logFile, JSON.stringify(log, null, 2));
    } catch (err) {
      console.error('Failed to update log file:', err);
    }

    const verdictDisplay = verdict === 'needs-evolution' ? 'NEEDS EVOLUTION' : verdict.toUpperCase();
    console.log(`✅ Test Run #${runId} marked as ${verdictDisplay}${comment ? ' (with follow-up)' : ''}`);

    return NextResponse.json({
      success: true,
      runId,
      testId: index.runs[runIndex].testId,
      testName: index.runs[runIndex].testName,
      verdict,
      previousVerdict,
      hasFollowUp: !!comment,
      message: `Run #${runId} (${index.runs[runIndex].testId}) marked as ${verdictDisplay}`
    });

  } catch (error) {
    console.error('Error updating verdict:', error);
    return NextResponse.json(
      { error: 'Failed to update verdict' },
      { status: 500 }
    );
  }
}

// PATCH /api/test-logs/verdict - Add follow-up comment to existing run (after changes implemented)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, implementationNote } = body as { 
      runId: string; 
      implementationNote: string;
    };

    if (!runId || !implementationNote) {
      return NextResponse.json(
        { error: 'runId and implementationNote are required' },
        { status: 400 }
      );
    }

    // Load index
    let index: TestIndex;
    try {
      const content = await fs.readFile(INDEX_FILE, 'utf-8');
      index = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Index file not found' },
        { status: 404 }
      );
    }

    // Find the run
    const runIndex = index.runs.findIndex(r => r.runId === runId);
    if (runIndex === -1) {
      return NextResponse.json(
        { error: `Run ${runId} not found` },
        { status: 404 }
      );
    }

    // Mark latest follow-up as implemented and add response
    if (index.runs[runIndex].followUps && index.runs[runIndex].followUps.length > 0) {
      const lastFollowUp = index.runs[runIndex].followUps[index.runs[runIndex].followUps.length - 1];
      lastFollowUp.changesImplemented = true;
      lastFollowUp.implementedTimestamp = new Date().toISOString();
    }

    // Add implementation response (like venue responding to Google review)
    if (!index.runs[runIndex].followUps) {
      index.runs[runIndex].followUps = [];
    }
    index.runs[runIndex].followUps.push({
      timestamp: new Date().toISOString(),
      comment: `📝 CHANGES IMPLEMENTED: ${implementationNote}`,
      changesImplemented: true,
      implementedTimestamp: new Date().toISOString()
    });

    // Save index
    await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));

    // Also update the individual log file
    const logFile = path.join(LOGS_DIR, index.runs[runIndex].logFile);
    try {
      const logContent = await fs.readFile(logFile, 'utf-8');
      const log = JSON.parse(logContent);
      
      if (!log.followUps) {
        log.followUps = [];
      }
      
      // Mark previous follow-up as implemented
      if (log.followUps.length > 0) {
        log.followUps[log.followUps.length - 1].changesImplemented = true;
        log.followUps[log.followUps.length - 1].implementedTimestamp = new Date().toISOString();
      }
      
      // Add the implementation note
      log.followUps.push({
        timestamp: new Date().toISOString(),
        comment: `📝 CHANGES IMPLEMENTED: ${implementationNote}`,
        changesImplemented: true,
        implementedTimestamp: new Date().toISOString()
      });
      
      await fs.writeFile(logFile, JSON.stringify(log, null, 2));
    } catch (err) {
      console.error('Failed to update log file:', err);
    }

    console.log(`✅ Implementation note added to Run #${runId}`);

    return NextResponse.json({
      success: true,
      runId,
      message: `Implementation note added to Run #${runId}`
    });

  } catch (error) {
    console.error('Error adding implementation note:', error);
    return NextResponse.json(
      { error: 'Failed to add implementation note' },
      { status: 500 }
    );
  }
}

// GET /api/test-logs/verdict?runId=XXX - Get verdict for a specific run
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const runId = searchParams.get('runId');

  try {
    const content = await fs.readFile(INDEX_FILE, 'utf-8');
    const index: TestIndex = JSON.parse(content);

    if (runId) {
      // Get specific run
      const run = index.runs.find(r => r.runId === runId);
      if (!run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }
      return NextResponse.json(run);
    }

    // Return all runs with verdicts
    const runsWithVerdicts = index.runs.map(r => ({
      runId: r.runId,
      testId: r.testId,
      testName: r.testName,
      verdict: r.verdict || 'pending',
      verdictTimestamp: r.verdictTimestamp,
      timestamp: r.timestamp,
      hasFollowUps: r.followUps && r.followUps.length > 0
    }));

    return NextResponse.json({
      runs: runsWithVerdicts,
      summary: {
        total: runsWithVerdicts.length,
        passed: runsWithVerdicts.filter(r => r.verdict === 'passed').length,
        failed: runsWithVerdicts.filter(r => r.verdict === 'failed').length,
        needsEvolution: runsWithVerdicts.filter(r => r.verdict === 'needs-evolution').length,
        pending: runsWithVerdicts.filter(r => r.verdict === 'pending').length
      }
    });

  } catch {
    return NextResponse.json({ runs: [], summary: { total: 0, passed: 0, failed: 0, needsEvolution: 0, pending: 0 } });
  }
}


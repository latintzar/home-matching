/**
 * Test Logger for Vibe Maps Building Block Tests
 * Auto-saves detailed logs for debugging. Each run gets unique ID.
 */

export interface APICall {
  id: string;
  api: string;
  endpoint: string;
  timestamp: string;
  duration: number;
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    prompt?: string;
  };
  response: {
    status: number;
    statusText?: string;
    body?: unknown;
    rawText?: string;
  };
  error?: { message: string; stack?: string };
  success: boolean;
}

export type VerdictType = 'passed' | 'failed' | 'needs-evolution' | 'pending';

export interface FollowUp {
  timestamp: string;
  comment: string;
  changesImplemented?: boolean;
  implementedTimestamp?: string;
}

export interface TestLog {
  runId: string;
  runNumber: number;
  testId: string;
  testName: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  input: { raw: string; parsed?: unknown; type: 'text' | 'json' };
  apiCalls: APICall[];
  steps: { step: number; description: string; timestamp: string; data?: unknown; error?: string }[];
  output?: { success: boolean; data?: unknown; error?: string };
  verdict?: VerdictType;
  followUps?: FollowUp[];
}

class TestLogger {
  private currentLog: TestLog | null = null;
  private apiCallCounter = 0;
  private stepCounter = 0;

  async startTest(testId: string, testName: string, input: string): Promise<string> {
    const index = await this.loadIndex();
    const runNumber = index.lastRunNumber + 1;
    const runId = String(runNumber).padStart(3, '0');
    
    let parsedInput: unknown;
    let inputType: 'text' | 'json' = 'text';
    try { parsedInput = JSON.parse(input); inputType = 'json'; } catch { parsedInput = undefined; }
    
    this.currentLog = {
      runId, runNumber, testId, testName,
      startTime: new Date().toISOString(),
      input: { raw: input, parsed: parsedInput, type: inputType },
      apiCalls: [], steps: [],
    };
    this.apiCallCounter = 0;
    this.stepCounter = 0;
    this.logStep('Test started', { testId, testName });
    return runId;
  }

  logStep(description: string, data?: unknown): void {
    if (!this.currentLog) return;
    this.stepCounter++;
    this.currentLog.steps.push({ step: this.stepCounter, description, timestamp: new Date().toISOString(), data });
  }

  startAPICall(api: string, endpoint: string, request: APICall['request']): string {
    if (!this.currentLog) return '';
    this.apiCallCounter++;
    const callId = `api-${this.apiCallCounter}`;
    this.currentLog.apiCalls.push({
      id: callId, api, endpoint, timestamp: new Date().toISOString(),
      duration: 0, request, response: { status: 0 }, success: false,
    });
    return callId;
  }

  completeAPICall(callId: string, response: APICall['response'], success: boolean, error?: APICall['error']): void {
    if (!this.currentLog) return;
    const call = this.currentLog.apiCalls.find(c => c.id === callId);
    if (!call) return;
    call.duration = Date.now() - new Date(call.timestamp).getTime();
    call.response = response;
    call.success = success;
    if (error) call.error = error;
  }

  async endTest(success: boolean, output?: unknown, error?: string): Promise<TestLog> {
    if (!this.currentLog) throw new Error('No test in progress');
    this.currentLog.endTime = new Date().toISOString();
    this.currentLog.duration = new Date(this.currentLog.endTime).getTime() - new Date(this.currentLog.startTime).getTime();
    this.currentLog.output = { success, data: output, error };
    this.logStep('Test completed', { success, duration: this.currentLog.duration });
    await this.saveLog(this.currentLog);
    await this.updateIndex(this.currentLog);
    const log = this.currentLog;
    this.currentLog = null;
    return log;
  }

  getCurrentLog(): TestLog | null { return this.currentLog; }

  private async loadIndex(): Promise<{ lastRunNumber: number; runs: unknown[] }> {
    try {
      const response = await fetch('/api/test-logs/index');
      if (response.ok) return await response.json();
    } catch { /* ignore */ }
    return { lastRunNumber: 0, runs: [] };
  }

  private async saveLog(log: TestLog): Promise<void> {
    try {
      await fetch('/api/test-logs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
    } catch (err) {
      console.error('Failed to save log:', err);
      console.log('=== TEST LOG ===\n', JSON.stringify(log, null, 2));
    }
  }

  private async updateIndex(log: TestLog): Promise<void> {
    try {
      await fetch('/api/test-logs/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: log.runId, runNumber: log.runNumber, testId: log.testId,
          testName: log.testName, timestamp: log.startTime, duration: log.duration,
          success: log.output?.success ?? false,
        }),
      });
    } catch (err) { console.error('Failed to update index:', err); }
  }
}

export const testLogger = new TestLogger();

export function formatLogForDisplay(log: TestLog): string {
  const lines: string[] = [
    '='.repeat(60),
    `TEST RUN #${log.runId}`,
    '='.repeat(60),
    '',
    `Test: ${log.testId} - ${log.testName}`,
    `Time: ${log.startTime}`,
    `Duration: ${log.duration}ms`,
    `Status: ${log.output?.success ? 'SUCCESS' : 'FAILED'}`,
    '',
    '--- INPUT ' + '-'.repeat(50),
    log.input.raw,
    '',
    '--- STEPS ' + '-'.repeat(50),
  ];
  
  for (const step of log.steps) {
    lines.push(`${step.step}. ${step.description}`);
    if (step.data) lines.push(`   ${JSON.stringify(step.data).substring(0, 200)}`);
  }
  
  lines.push('', '--- API CALLS ' + '-'.repeat(46));
  for (const call of log.apiCalls) {
    lines.push(`[${call.id}] ${call.api} - ${call.endpoint}`);
    lines.push(`   Duration: ${call.duration}ms | Status: ${call.response.status}`);
    if (call.request.prompt) {
      lines.push('   PROMPT:', call.request.prompt.substring(0, 500));
    }
    if (call.response.body) {
      const respStr = JSON.stringify(call.response.body, null, 2);
      lines.push('   RESPONSE:', respStr.substring(0, 1000));
    }
    if (call.error) lines.push(`   ERROR: ${call.error.message}`);
  }
  
  lines.push('', '--- OUTPUT ' + '-'.repeat(49));
  if (log.output?.data) lines.push(JSON.stringify(log.output.data, null, 2));
  if (log.output?.error) lines.push(`Error: ${log.output.error}`);
  
  return lines.join('\n');
}

export function getFullLogJSON(log: TestLog): string {
  return JSON.stringify(log, null, 2);
}


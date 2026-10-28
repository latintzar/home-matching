/**
 * Budget Tracker for Parsing Pipeline
 * 
 * Tracks LLM spend in real-time and stops execution if budget is exceeded.
 * HARD LIMIT: $250
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const BUDGET_TABLE = 'leo-budget-tracker';
const BUDGET_ID = 'parsing-v2';
const HARD_LIMIT = 250.00;

// Gemini pricing (per 1M tokens)
const PRICING = {
  'gemini-3-pro': {
    input: 1.25,    // $1.25 per 1M input tokens
    output: 10.00,  // $10.00 per 1M output tokens
  },
  'gemini-2.5-flash': {
    input: 0.075,   // $0.075 per 1M input tokens
    output: 0.30,   // $0.30 per 1M output tokens
  },
};

export interface BudgetState {
  spent: number;
  budgetLimit: number;
  domainsProcessed: number;
  domainsGraduated: number;
  domainsParked: number;
  lastUpdated: string;
}

export interface LLMUsage {
  model: 'gemini-3-pro' | 'gemini-2.5-flash';
  inputTokens: number;
  outputTokens: number;
}

let dynamodb: DynamoDBClient | null = null;

function getClient(): DynamoDBClient {
  if (!dynamodb) {
    dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return dynamodb;
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(usage: LLMUsage): number {
  const pricing = PRICING[usage.model];
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Initialize budget tracker (run once at start)
 */
export async function initBudgetTracker(): Promise<BudgetState> {
  const client = getClient();
  
  // Check if exists
  const getResult = await client.send(new GetItemCommand({
    TableName: BUDGET_TABLE,
    Key: { id: { S: BUDGET_ID } },
  }));

  if (getResult.Item) {
    return {
      spent: parseFloat(getResult.Item.spent?.N || '0'),
      budgetLimit: parseFloat(getResult.Item.budget_limit?.N || String(HARD_LIMIT)),
      domainsProcessed: parseInt(getResult.Item.domains_processed?.N || '0'),
      domainsGraduated: parseInt(getResult.Item.domains_graduated?.N || '0'),
      domainsParked: parseInt(getResult.Item.domains_parked?.N || '0'),
      lastUpdated: getResult.Item.last_updated?.S || new Date().toISOString(),
    };
  }

  // Create new tracker
  const initialState: BudgetState = {
    spent: 0,
    budgetLimit: HARD_LIMIT,
    domainsProcessed: 0,
    domainsGraduated: 0,
    domainsParked: 0,
    lastUpdated: new Date().toISOString(),
  };

  await client.send(new PutItemCommand({
    TableName: BUDGET_TABLE,
    Item: {
      id: { S: BUDGET_ID },
      spent: { N: '0' },
      budget_limit: { N: String(HARD_LIMIT) },
      domains_processed: { N: '0' },
      domains_graduated: { N: '0' },
      domains_parked: { N: '0' },
      last_updated: { S: initialState.lastUpdated },
    },
  }));

  console.log(`💰 Budget tracker initialized. Limit: $${HARD_LIMIT}`);
  return initialState;
}

/**
 * Get current budget state
 */
export async function getBudgetState(): Promise<BudgetState> {
  const client = getClient();
  
  const result = await client.send(new GetItemCommand({
    TableName: BUDGET_TABLE,
    Key: { id: { S: BUDGET_ID } },
  }));

  if (!result.Item) {
    return initBudgetTracker();
  }

  return {
    spent: parseFloat(result.Item.spent?.N || '0'),
    budgetLimit: parseFloat(result.Item.budget_limit?.N || String(HARD_LIMIT)),
    domainsProcessed: parseInt(result.Item.domains_processed?.N || '0'),
    domainsGraduated: parseInt(result.Item.domains_graduated?.N || '0'),
    domainsParked: parseInt(result.Item.domains_parked?.N || '0'),
    lastUpdated: result.Item.last_updated?.S || new Date().toISOString(),
  };
}

/**
 * Check if we can afford to process another domain
 * Returns false if we'd exceed budget
 */
export async function canAffordDomain(estimatedCost: number = 0.10): Promise<boolean> {
  const state = await getBudgetState();
  const wouldSpend = state.spent + estimatedCost;
  
  if (wouldSpend > state.budgetLimit) {
    console.log(`⛔ BUDGET LIMIT WOULD BE EXCEEDED`);
    console.log(`   Current spent: $${state.spent.toFixed(2)}`);
    console.log(`   Estimated cost: $${estimatedCost.toFixed(2)}`);
    console.log(`   Would be: $${wouldSpend.toFixed(2)}`);
    console.log(`   Limit: $${state.budgetLimit.toFixed(2)}`);
    return false;
  }
  
  return true;
}

/**
 * Record LLM usage and update budget
 */
export async function recordUsage(usage: LLMUsage): Promise<{ cost: number; totalSpent: number; remaining: number }> {
  const cost = calculateCost(usage);
  const client = getClient();

  const result = await client.send(new UpdateItemCommand({
    TableName: BUDGET_TABLE,
    Key: { id: { S: BUDGET_ID } },
    UpdateExpression: 'SET spent = spent + :cost, last_updated = :now',
    ExpressionAttributeValues: {
      ':cost': { N: String(cost) },
      ':now': { S: new Date().toISOString() },
    },
    ReturnValues: 'ALL_NEW',
  }));

  const totalSpent = parseFloat(result.Attributes?.spent?.N || '0');
  const remaining = HARD_LIMIT - totalSpent;

  // Check if we've hit the limit
  if (totalSpent >= HARD_LIMIT) {
    console.log(`🛑 BUDGET LIMIT REACHED!`);
    console.log(`   Total spent: $${totalSpent.toFixed(2)}`);
    console.log(`   Limit: $${HARD_LIMIT.toFixed(2)}`);
  }

  return { cost, totalSpent, remaining };
}

/**
 * Record domain completion
 */
export async function recordDomainComplete(graduated: boolean): Promise<void> {
  const client = getClient();
  
  const updateExpr = graduated
    ? 'SET domains_processed = domains_processed + :one, domains_graduated = domains_graduated + :one, last_updated = :now'
    : 'SET domains_processed = domains_processed + :one, domains_parked = domains_parked + :one, last_updated = :now';

  await client.send(new UpdateItemCommand({
    TableName: BUDGET_TABLE,
    Key: { id: { S: BUDGET_ID } },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: {
      ':one': { N: '1' },
      ':now': { S: new Date().toISOString() },
    },
  }));
}

/**
 * Print budget summary
 */
export async function printBudgetSummary(): Promise<void> {
  const state = await getBudgetState();
  const remaining = state.budgetLimit - state.spent;
  const percentUsed = (state.spent / state.budgetLimit) * 100;

  console.log(`\n💰 BUDGET SUMMARY`);
  console.log(`══════════════════════════════════════`);
  console.log(`   Spent:     $${state.spent.toFixed(2)} / $${state.budgetLimit.toFixed(2)} (${percentUsed.toFixed(1)}%)`);
  console.log(`   Remaining: $${remaining.toFixed(2)}`);
  console.log(`   Domains:   ${state.domainsProcessed} processed`);
  console.log(`   ├── ✅ ${state.domainsGraduated} graduated`);
  console.log(`   └── 🅿️  ${state.domainsParked} parked`);
  console.log(`══════════════════════════════════════\n`);
}

/**
 * Reset budget tracker (for testing)
 */
export async function resetBudgetTracker(): Promise<void> {
  const client = getClient();
  
  await client.send(new PutItemCommand({
    TableName: BUDGET_TABLE,
    Item: {
      id: { S: BUDGET_ID },
      spent: { N: '0' },
      budget_limit: { N: String(HARD_LIMIT) },
      domains_processed: { N: '0' },
      domains_graduated: { N: '0' },
      domains_parked: { N: '0' },
      last_updated: { S: new Date().toISOString() },
    },
  }));

  console.log(`🔄 Budget tracker reset. Limit: $${HARD_LIMIT}`);
}


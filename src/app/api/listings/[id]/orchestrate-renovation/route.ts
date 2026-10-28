import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Agent, setGlobalDispatcher, fetch as undiciFetch } from 'undici';
import { setProgressCallback, setCurrentStepName, getProgressCallback } from '@/lib/orchestrator-progress';
import {lazySupabaseClient} from '@/lib/lazy-supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = lazySupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://127.0.0.1:3000';

// Configure undici dispatcher with very high timeouts for fetch calls
const MAX_TIMEOUT = 86400000; // 24 hours
const dispatcher = new Agent({
  bodyTimeout: MAX_TIMEOUT,
  headersTimeout: 600000,
  connectTimeout: 30000,
});
setGlobalDispatcher(dispatcher);

const noTimeoutDispatcher = new Agent({
  bodyTimeout: MAX_TIMEOUT,
  headersTimeout: 600000,
  connectTimeout: 30000,
});

const fetchWithNoTimeout = async (url: string, options?: RequestInit): Promise<Response> => {
  try {
    const response = await undiciFetch(url, {
      ...options,
      dispatcher: noTimeoutDispatcher,
      bodyTimeout: MAX_TIMEOUT,
      headersTimeout: 600000,
    } as any);
    return response as unknown as Response;
  } catch (error) {
    console.error('fetchWithNoTimeout error:', error);
    throw error;
  }
};

/**
 * Renovation Orchestrator (Unified Engine)
 * 
 * Runs Phases 6-8:
 * - Phase 6: Baseline Check (Smart M2 + Pricing RAG)
 * - Phase 7: Unified Engine (Strategy -> Search -> Scope)
 * - Phase 8: Visual Execution (R1 -> R3)
 * 
 * Supports:
 * - Auto-Pilot: Default inputs
 * - Co-Pilot: User inputs (via body)
 * - Resume: startFrom
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json().catch(() => ({}));
    const { force, startFrom, userDirectives } = body; // userDirectives: { budget, style, wishes }

    console.log(`🚀 Starting Renovation Orchestrator for listing ${listingId}${startFrom ? ` from ${startFrom}` : ''}`);

    const stream = new ReadableStream({
      start(controller) {
        const sendUpdate = (message: string, data?: any, step?: string) => {
          try {
            const update = JSON.stringify({ 
              message, 
              data, 
              step, 
              timestamp: new Date().toISOString() 
            });
            const encoded = new TextEncoder().encode(`data: ${update}\n\n`);
            controller.enqueue(encoded);
          } catch (e) {
            // Ignore if controller closed
          }
        };

        const runPipeline = async () => {
          let currentStepName: string | null = null;

          const progressCallback = (event: { step?: string | null; level: 'log' | 'error' | 'warn'; message: string }) => {
            const step = event.step || currentStepName || 'endpoint-log';
            const icon = event.level === 'error' ? '❌' : event.level === 'warn' ? '⚠️' : '📝';
            sendUpdate(`  ${icon} [${step}] ${event.message}`, undefined, 'endpoint-log');
          };

          setProgressCallback(progressCallback);
          
          // Force module init
          let verifyCallback = getProgressCallback();
          if (!verifyCallback) {
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setImmediate(resolve));
              if (getProgressCallback()) break;
            }
          }
          
          sendUpdate('✅ Renovation Orchestrator initialized', {}, 'init');

          const results: any[] = [];
          let currentStep = 0;
          const totalSteps = 9; // SmartM2, Baseline, Strategy, Search, Scope, R1, R1.5, F0, R2, R3

          const shouldSkip = (stepName: string) => {
            if (!startFrom) return false;
            const stepOrder = ['SmartM2', 'Baseline', 'Strategy', 'Search', 'Scope', 'R1', 'R1.5', 'F0', 'R2', 'R3'];
            const startIndex = stepOrder.indexOf(startFrom);
            const currentIndex = stepOrder.indexOf(stepName);
            return startIndex >= 0 && currentIndex < startIndex;
          };

          const callEndpoint = async (step: string, url: string, options: RequestInit = {}, useLongTimeout = false) => {
            if (shouldSkip(step)) {
              sendUpdate(`⏭️ Skipping ${step}`, {}, step);
              return;
            }

            currentStep++;
            sendUpdate(`Step ${currentStep}: ${step}...`, {}, step);
            currentStepName = step;
            setCurrentStepName(step);

            const headers = {
              'Content-Type': 'application/json',
              'X-Orchestrator-Context': 'true',
              'X-Step-Name': step,
              ...options.headers,
            };

            const fetchFn = useLongTimeout ? fetchWithNoTimeout : fetch;
            const response = await fetchFn(url, { ...options, headers });
            
            let responseData: any = {};
            try {
                if (response.headers.get('content-type')?.includes('application/json')) {
                    responseData = await response.json();
                } else {
                    responseData = { message: await response.text() };
                }
            } catch (e) {
                sendUpdate(`⚠️ Failed to parse response for ${step}`, {}, step);
            }

            if (!response.ok) {
              const err = responseData.error || response.statusText;
              sendUpdate(`❌ ${step} Failed: ${err}`, { error: err }, step);
              throw new Error(`${step} Failed: ${err}`);
            }

            sendUpdate(`✅ ${step} Completed`, {}, step);
            results.push({ step, success: true });
            return responseData;
          };

          try {
            // === Phase 6: Setup ===
            // Step 1: Smart M2 Inference (Node D+)
            await callEndpoint('SmartM2', `${BASE_URL}/api/listings/${listingId}/renovation/smart-m2`, { method: 'POST' });
            
            // Step 2: Baseline Check (Pre-Computation)
            await callEndpoint('Baseline', `${BASE_URL}/api/listings/${listingId}/renovation/baseline-check`, { method: 'POST' });

            // === Phase 7: Unified Engine ===
            // Node 1: Strategy
            // Unpack userDirectives to match unified-strategy expectations
            const strategyBody = userDirectives ? {
              user_budget: userDirectives.budget,
              scope_directives: userDirectives.directives,
              // For now, we don't have a text style preference, so we default or use directives
              style_preferences: userDirectives.style || (userDirectives.styleImageUrl ? 'Custom Style Image Provided' : 'User Custom Style'),
              strategy_mode: 'stick_to_budget' // When user gives a budget, we stick to it
            } : {};

            console.log('Calling Unified Strategy with user inputs:', strategyBody);

            await callEndpoint('Strategy', `${BASE_URL}/api/listings/${listingId}/renovation/unified-strategy`, { 
              method: 'POST',
              body: JSON.stringify(strategyBody)
            });

            // Node 2: Search (Long Running)
            await callEndpoint('Search', `${BASE_URL}/api/listings/${listingId}/renovation/search`, { method: 'POST' }, true);

            // Node 3: Scope
            await callEndpoint('Scope', `${BASE_URL}/api/listings/${listingId}/renovation/unified-scope`, { method: 'POST' });

            // === Phase 8: Visuals ===
            await callEndpoint('R1', `${BASE_URL}/api/listings/${listingId}/visuals/r1-select`, { method: 'POST' });
            
            await callEndpoint('R1.5', `${BASE_URL}/api/listings/${listingId}/visuals/r1-5-omsria`, { method: 'POST' });
            
            // F0 (Long Running)
            await callEndpoint('F0', `${BASE_URL}/api/listings/${listingId}/photos/remove-furniture`, { method: 'POST' }, true);

            // R2 (Prompts)
            await callEndpoint('R2', `${BASE_URL}/api/listings/${listingId}/visuals/r2-prompt`, { method: 'POST' });

            // R3 (Render - Long Running)
            await callEndpoint('R3', `${BASE_URL}/api/listings/${listingId}/visuals/r3-render`, { method: 'POST' }, true);

            sendUpdate('🎉 Renovation Pipeline Complete!', { results }, 'complete');
            controller.close();

          } catch (error: any) {
            console.error('Orchestrator Failed:', error);
            sendUpdate(`❌ Fatal Error: ${error.message}`, { error: error.message }, 'fatal-error');
            controller.close();
          }
        };

        runPipeline();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
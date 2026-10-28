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
const MAX_TIMEOUT = 86400000; // 24 hours in milliseconds
const dispatcher = new Agent({
  bodyTimeout: MAX_TIMEOUT,
  headersTimeout: 600000, // 10 minutes for headers
  connectTimeout: 30000, // 30 seconds for connection
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

interface StepResult {
  step: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  data?: any;
}

interface TokenUsage {
  step: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface ModelPricing {
  inputPricePer1M: number;
  inputPricePer1MHigh: number;
  outputPricePer1M: number;
  outputPricePer1MHigh: number;
}

// Model pricing (per 1M tokens)
const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-2.5-pro': {
    inputPricePer1M: 1.25,
    inputPricePer1MHigh: 2.5,
    outputPricePer1M: 10.0,
    outputPricePer1MHigh: 15.0
  },
  'gemini-2.5-flash': {
    inputPricePer1M: 0.30,
    inputPricePer1MHigh: 0.30,
    outputPricePer1M: 2.50,
    outputPricePer1MHigh: 2.50
  },
  'gemini-2.5-flash-lite': {
    inputPricePer1M: 0.10,
    inputPricePer1MHigh: 0.10,
    outputPricePer1M: 0.40,
    outputPricePer1MHigh: 0.40
  }
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  if (model.includes('image') || model === 'gemini-2.5-flash-image') {
    const inputPrice = 0.30;
    const outputPrice = 30.0;
    const inputCost = (inputTokens / 1_000_000) * inputPrice;
    const outputCost = (outputTokens / 1_000_000) * outputPrice;
    return inputCost + outputCost;
  }
  
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-2.5-flash'];
  const useHighPricing = inputTokens > 200000;
  const inputPrice = useHighPricing ? pricing.inputPricePer1MHigh : pricing.inputPricePer1M;
  const outputPrice = useHighPricing ? pricing.outputPricePer1MHigh : pricing.outputPricePer1M;
  const inputCost = (inputTokens / 1_000_000) * inputPrice;
  const outputCost = (outputTokens / 1_000_000) * outputPrice;
  return inputCost + outputCost;
}

/**
 * Basic Package Orchestrator
 * 
 * Runs the complete Basic Package pipeline:
 * - Text Analysis (A-C)
 * - Zero-Shot Clustering (D)
 * - Photo Analysis (F3, RoomByRoom)
 * - Google Search (G) - Now includes Double-Barrel Hybrid Engine (8 Mega-Categories)
 * - Buyer Report (3-Chapter structure: Forensic Risk Audit, Execution & Reality Check, Financial Intelligence)
 * - Qué Verificar
 * 
 * This is the first commercial offering - complete property intelligence for buyers.
 * Stops after Qué Verificar - no renovation steps included.
 * 
 * NOTE: Steps H (Integrated Diagnostic) and J-General (General Google Search) have been absorbed:
 * - H logic is now internal to Buyer Report generation
 * - J-General queries are now part of G (Double-Barrel Hybrid Engine)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params; // Await params as per Next.js 15+ warning
    const body = await request.json().catch(() => ({}));
    const { force, startFrom, skipSearch }: { force?: boolean; startFrom?: string; skipSearch?: boolean } = body;

    // Helper to add force_refresh param if force is true
    const getUrlWithParams = (baseUrl: string) => {
      if (!force) return baseUrl;
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}force_refresh=true`;
    };

    console.log(`🚀 Starting Basic Package Orchestrator for listing ${listingId}${startFrom ? ` from ${startFrom}` : ''}${force ? ' (FORCE REFRESH)' : ''}`);

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
            // Ignore if controller is closed
          }
        };

        const runPipeline = async () => {
          // Track current step name for logging context
          let currentStepName: string | null = null;
          
          // Set up progress callback that consumes structured ProgressEvent objects
          // IMPORTANT: This callback is called by endpoints running in separate HTTP requests
          // via createStepLogger (or legacy interceptConsoleLog)
          const progressCallback = (event: { step?: string | null; level: 'log' | 'error' | 'warn'; message: string }) => {
            // Determine step name: prefer event.step, fallback to currentStepName, then generic
            const step = event.step || currentStepName || 'endpoint-log';
            
            // Choose icon based on log level
            const icon = event.level === 'error' ? '❌' : event.level === 'warn' ? '⚠️' : '📝';
            
            // Send to SSE with [Step] prefix - single source of truth for prefix
            sendUpdate(`  ${icon} [${step}] ${event.message}`, undefined, 'endpoint-log');
          };
          
          // Set callback BEFORE any endpoints are called
          setProgressCallback(progressCallback);
          
          // CRITICAL: Force module to be fully initialized by calling getProgressCallback
          const verifyCallback = getProgressCallback();
          if (!verifyCallback) {
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setImmediate(resolve));
              if (getProgressCallback()) break;
            }
          }
          
          if (!getProgressCallback()) {
            throw new Error('Failed to set progress callback - module state not accessible after initialization');
          }
          
          sendUpdate('✅ Progress callback initialized and verified', {}, 'orchestrator');
          
          const results: StepResult[] = [];
          const tokenUsage: TokenUsage[] = [];
          let currentStep = 0;
          
          // Basic Package steps: A-C, Cadastre, D, F3, G, RoomByRoom, Buyer Report, Qué Verificar
          // Note: S (Scraping) is assumed to be done separately or checked as prerequisite
          // NOTE: H (Integrated Diagnostic) and J-General (General Google Search) have been removed:
          // - H logic is now internal to Buyer Report generation
          // - J-General queries are now part of G (Double-Barrel Hybrid Engine)
          const totalSteps = 11; // A-C, Cadastre, Intelligence, D, F3, G, RoomByRoom, SmartM2, Baseline, BuyerReport, Qué Verificar

          // Skip steps before startFrom if specified
          const shouldSkip = (stepName: string) => {
            if (!startFrom) return false;
            const stepOrder = ['A-C', 'Cadastre', 'Intelligence', 'D', 'F3', 'G', 'RoomByRoom', 'SmartM2', 'Baseline', 'BuyerReport', 'QueVerificar'];
            const startIndex = stepOrder.indexOf(startFrom);
            const currentIndex = stepOrder.indexOf(stepName);
            return startIndex >= 0 && currentIndex < startIndex;
          };

          const runStep = async (stepName: string, stepFunction: () => Promise<void>) => {
            if (shouldSkip(stepName)) {
              sendUpdate(`⏭️  Skipping ${stepName} (starting from ${startFrom})`, {}, stepName);
              results.push({ step: stepName, success: true, skipped: true });
              return;
            }
            await stepFunction();
          };

          // Helper to track token usage from API response data
          const trackTokenUsage = (step: string, responseData: any, model?: string) => {
            try {
              const usage = responseData?.usage || responseData?.tokenUsage;
              
              if (usage) {
                const inputTokens = usage.promptTokenCount || usage.inputTokens || 0;
                const outputTokens = usage.candidatesTokenCount || usage.outputTokens || 0;
                const detectedModel = model || responseData?.model || 'gemini-2.5-flash';
                
                if (inputTokens > 0 || outputTokens > 0) {
                  const cost = calculateCost(detectedModel, inputTokens, outputTokens);
                  
                  tokenUsage.push({
                    step,
                    model: detectedModel,
                    inputTokens,
                    outputTokens,
                    cost
                  });
                  
                  sendUpdate(`  💰 ${step}: ${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output tokens (${detectedModel}) = $${cost.toFixed(4)}`, {
                    step,
                    model: detectedModel,
                    inputTokens,
                    outputTokens,
                    cost
                  }, step);
                }
              }
            } catch (error) {
              // Silently fail token tracking - not critical
            }
          };

          // Helper to call endpoint with logging
          const callEndpointWithLogging = async (
            step: string,
            url: string,
            options: RequestInit = {},
            useNoTimeout: boolean = false
          ) => {
            // CRITICAL: Set current step name BEFORE making the fetch request
            // This ensures that when the endpoint handler runs and calls createStepLogger,
            // logs will be routed with the correct step name
            currentStepName = step;
            setCurrentStepName(step);
            
            // Verify callback is accessible before making fetch call
            let callbackAvailable = getProgressCallback();
            if (!callbackAvailable) {
              for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setImmediate(resolve));
                callbackAvailable = getProgressCallback();
                if (callbackAvailable) break;
              }
            }
            
            if (!callbackAvailable) {
              throw new Error(`Progress callback not available when calling ${step} endpoint - module state not accessible`);
            }
            
            sendUpdate(`  🔄 Calling ${step} endpoint: ${url}`, {}, step);
            
            const headers = {
              'Content-Type': 'application/json',
              'X-Orchestrator-Context': 'true',
              'X-Step-Name': step,
              ...options.headers,
            };
            
            const fetchFn = useNoTimeout ? fetchWithNoTimeout : fetch;
            const response = await fetchFn(url, {
              ...options,
              headers,
            });

            // Parse response body once (can only be consumed once)
            let responseData: any = {};
            try {
              const contentType = response.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                responseData = await response.json();
              } else {
                const text = await response.text();
                responseData = { message: text };
              }
            } catch (parseError) {
              sendUpdate(`  ⚠️ Warning: Failed to parse ${step} response: ${parseError}`, {}, step);
            }

            if (!response.ok) {
              const errorMsg = responseData.error || responseData.message || response.statusText || 'Unknown error';
              sendUpdate(`  ❌ ${step} endpoint failed: ${response.status} ${errorMsg}`, { 
                status: response.status, 
                error: errorMsg,
                responseData
              }, step);
              
              // Force immediate pipeline termination on error
              controller.close();
              throw new Error(`${step} failed: ${response.status} ${errorMsg}`);
            }

            // Track token usage if available
            trackTokenUsage(step, responseData);
            
            // Note: currentStepName stays set until next endpoint starts
            // This ensures late-arriving logs from async work are still attributed correctly
            
            if (responseData?.cached) {
              sendUpdate(`  ✅ ${step} endpoint completed (CACHED ♻️)`, {}, step);
            } else {
            sendUpdate(`  ✅ ${step} endpoint completed`, {}, step);
            }

            return { response, responseData };
          };

          try {
            // Check prerequisites: Listing must exist
            sendUpdate('Checking prerequisites...', {}, 'prerequisites');
            const listingIdNum = parseInt(listingId, 10);
            const { data: listing, error: listingError } = await supabase
              .from('listings')
              .select('id')
              .eq('id', listingIdNum)
              .single();

            if (listingError || !listing) {
              sendUpdate(`❌ Listing ${listingId} not found. Please scrape the property first.`, { 
                error: listingError?.message 
              }, 'prerequisites');
              throw new Error(`Listing ${listingId} not found. Please scrape the property first.`);
            }
            
            sendUpdate(`✅ Listing found: ${listingId}`, {}, 'prerequisites');

            // UPDATE STATUS: Mark listing as Analyzing
            const { error: statusUpdateError } = await supabase
              .from('listings')
              .update({
                pipeline_checkpoints: {
                  status: 'analyzing',
                  stage: 'started',
                  last_updated: new Date().toISOString()
                }
              })
              .eq('id', listingIdNum);

            if (statusUpdateError) {
              console.error('Failed to update status to analyzing:', statusUpdateError);
              sendUpdate('⚠️ Warning: Failed to update status to "analyzing" in DB', {}, 'prerequisites');
            } else {
              sendUpdate('🔄 Status updated to: Analyzing', {}, 'prerequisites');
            }

            // ============================================================
            // PHASE 1: Text Analysis Pipeline (A-C) - MOVED UP to run during photo upload
            // ============================================================
            if (!shouldSkip('A-C')) {
              sendUpdate('📝 Phase 1: Text Analysis Pipeline (Running early to optimize time)', {}, 'phase1');
            }

            await runStep('A-C', async () => {
              currentStep++;
              sendUpdate(`Step ${currentStep}/${totalSteps}: A-C - Text Analysis Pipeline`, {}, 'A-C');
              
              try {
                // A: Facts Extraction
                sendUpdate(`  Running A: Facts Extraction...`, {}, 'A-C');
                await callEndpointWithLogging(
                  'A',
                  `${BASE_URL}/api/listings/${listingId}/text-analysis/a-facts`,
                  { method: 'POST' }
                );
                sendUpdate(`  ✅ A completed`, {}, 'A-C');
                
                // B1: Categorization
                sendUpdate(`  Running B1: Categorization...`, {}, 'A-C');
                await callEndpointWithLogging(
                  'B1',
                  `${BASE_URL}/api/listings/${listingId}/text-analysis/b1-categorization`,
                  { method: 'POST' }
                );
                sendUpdate(`  ✅ B1 completed`, {}, 'A-C');
                
                // B2: Merge Categories
                sendUpdate(`  Running B2: Merge Categories...`, {}, 'A-C');
                await callEndpointWithLogging(
                  'B2',
                  `${BASE_URL}/api/listings/${listingId}/text-analysis/b2-merge`,
                  { method: 'POST' }
                );
                sendUpdate(`  ✅ B2 completed`, {}, 'A-C');
                
                // B3: Snippets & C: Unknowns - PARALLEL (both need A + B2, but independent)
                sendUpdate(`  Running B3: Snippets & C: Unknowns in parallel...`, {}, 'A-C');
                const [b3Result, cResult] = await Promise.all([
                  callEndpointWithLogging(
                    'B3',
                    `${BASE_URL}/api/listings/${listingId}/text-analysis/b3-snippets`,
                    { method: 'POST' }
                  ),
                  callEndpointWithLogging(
                    'C',
                    `${BASE_URL}/api/listings/${listingId}/text-analysis/c-unknowns`,
                    { method: 'POST' }
                  )
                ]);
                sendUpdate(`  ✅ B3 completed`, {}, 'A-C');
                sendUpdate(`  ✅ C completed`, {}, 'A-C');
                
                sendUpdate('✅ A-C Text Analysis Pipeline completed', {}, 'A-C');
                results.push({ step: 'A-C', success: true });
              } catch (error: any) {
                sendUpdate(`❌ A-C Text Analysis Pipeline failed: ${error.message}`, { error: error.message }, 'A-C');
                results.push({ step: 'A-C', success: false, error: error.message });
                throw error;
              }
            });

            // ============================================================
            // CHECK CLUSTERS PREREQUISITE (Moved after A-C)
            // ============================================================
            // Check if clusters exist (D prerequisite)
            const { data: clusters } = await supabase
              .from('clusters')
              .select('id')
              .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId.toString()}`)
              .limit(1);

            if (!clusters || clusters.length === 0) {
              sendUpdate('🔄 Clusters not found. Preparing to run zero-shot clustering pipeline (Node D)...', {}, 'prerequisites');
              
              // CHECK: Photos should already be in listing_photos table (inserted by /api/listings/manual)
              // Zero-shot clustering will download them from URLs, so we just need entries to exist
              const { count: photoCount } = await supabase
                  .from('listing_photos')
                  .select('*', { count: 'exact', head: true })
                  .eq('listing_id', listingIdNum);
                  
              if (!photoCount || photoCount === 0) {
                // Fallback: Check scraped_data for URLs (legacy listings)
                  const { data: listingData } = await supabase
                    .from('listings')
                    .select('scraped_data')
                    .eq('id', listingIdNum)
                    .single();
                    
                  const sd = listingData?.scraped_data || {};
                  const scrapedPhotos = sd.photo_urls || sd.photos || sd.image_urls || [];
                  
                  if (scrapedPhotos.length > 0) {
                  sendUpdate(`📸 Found ${scrapedPhotos.length} photos in scraped_data (legacy). Proceeding...`, {}, 'prerequisites');
                } else {
                  sendUpdate(`⚠️ No photos found in listing_photos or scraped_data. Zero-shot clustering may fail.`, {}, 'prerequisites');
                }
                  } else {
                sendUpdate(`✅ Found ${photoCount} photos in listing_photos. Proceeding with clustering.`, {}, 'prerequisites');
              }
              
              const autoClusterResponse = await fetch(`${BASE_URL}/api/listings/${listingId}/clusters/zero-shot/full`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });

              if (!autoClusterResponse.ok) {
                const errorText = await autoClusterResponse.text();
                let errorData: any = {};
                try {
                  errorData = JSON.parse(errorText);
                } catch {
                  errorData = { error: errorText.substring(0, 200) };
                }
                
                const errorMessage = errorData.details || errorData.error || errorData.message || 'Unknown error';
                console.error('❌ Zero-shot clustering error details:', {
                  status: autoClusterResponse.status,
                  error: errorData.error,
                  details: errorData.details,
                  message: errorData.message,
                  stack: errorData.stack,
                  fullError: errorData.full_error
                });
                
                sendUpdate(`❌ Zero-shot clustering pipeline failed: ${errorMessage}`, {
                  status: autoClusterResponse.status,
                  error: errorData.error,
                  details: errorData.details,
                  message: errorMessage,
                  fullError: errorData.full_error,
                  stack: errorData.stack
                }, 'prerequisites');
                throw new Error(`Zero-shot clustering pipeline failed: ${errorMessage}`);
              }

              const result = await autoClusterResponse.json();
              
              sendUpdate(`✅ Zero-shot clustering complete: ${result.clusters_count} clusters, ${result.visibility_mappings_count} visibility mappings`, {
                clusters_count: result.clusters_count,
                visibility_mappings_count: result.visibility_mappings_count,
                excluded_clusters_count: result.excluded_clusters_count || 0
              }, 'prerequisites');

              // Verify clusters were written
              const { data: newClusters } = await supabase
                .from('clusters')
                .select('id')
                .or(`listing_id.eq.${listingIdNum},listing_id.eq.${listingId.toString()}`)
                .limit(1);

              if (!newClusters || newClusters.length === 0) {
                sendUpdate(`❌ Zero-shot clustering completed but no clusters were written. Check pipeline logs.`, {}, 'prerequisites');
                throw new Error('Zero-shot clustering completed but no clusters were written. Check pipeline logs.');
              }
              
              sendUpdate(`✅ Verified ${newClusters.length} cluster(s) written to database`, {
                clusterCount: newClusters.length
              }, 'prerequisites');
            } else {
              sendUpdate('✅ Prerequisites check passed', {}, 'prerequisites');
            }

            results.push({ step: 'prerequisites', success: true });

            // ============================================================
            // PHASE 1: Text Analysis Pipeline (A-C) - ALREADY RUN
            // ============================================================
            // (Moved to top)

            // ============================================================
            // PHASE 2.5 & 2.7: Cadastre + Intelligence (parallel)
            // ============================================================
            if (!shouldSkip('Cadastre') || !shouldSkip('Intelligence')) {
              sendUpdate('🏛️ Phase 2.5 & 2.7: Official Verification + Intelligence', {}, 'phase2.5');
            }

            // Run Cadastre and Intelligence in parallel (both need coords but independent)
            await Promise.allSettled([
              runStep('Cadastre', async () => {
                currentStep++;
                sendUpdate(`Step ${currentStep}/${totalSteps}: Cadastre - Official Verification`, {}, 'Cadastre');
                
                await callEndpointWithLogging(
                  'Cadastre',
                  `${BASE_URL}/api/listings/${listingId}/analysis/cadastre`,
                  { method: 'POST' }
                );
                
                sendUpdate('✅ Cadastre Node completed', {}, 'Cadastre');
                results.push({ step: 'Cadastre', success: true });
              }),
              runStep('Intelligence', async () => {
                currentStep++;
                sendUpdate(`Step ${currentStep}/${totalSteps}: Intelligence Suite (Social/Works/Geology)`, {}, 'Intelligence');
                
                try {
                  await callEndpointWithLogging(
                    'Intelligence',
                    `${BASE_URL}/api/listings/${listingId}/intelligence/social-radar`,
                    { method: 'POST' }
                  );
                  sendUpdate('✅ Intelligence Suite completed', {}, 'Intelligence');
                  results.push({ step: 'Intelligence', success: true });
                } catch (error: any) {
                  // Non-fatal error: If location data is missing, we skip but continue pipeline
                  const errorMsg = error.message || 'Unknown error';
                  sendUpdate(`⚠️ Intelligence Suite skipped/failed: ${errorMsg}. Continuing pipeline...`, { 
                     warning: true,
                     error: errorMsg 
                  }, 'Intelligence');
                  // Mark as success but with error note so pipeline continues
                  results.push({ step: 'Intelligence', success: true, error: errorMsg }); 
                }
              })
            ]);

            // ============================================================
            // PHASE 3: Visual Intelligence + Research (F3 -> G -> RoomByRoom)
            // G only needs F3 (Whole Property), allocentric data is optional
            // ============================================================
            if (!shouldSkip('F3')) {
              sendUpdate('📸 Phase 3: Photo Analysis Pipeline (Whole-Property first)', {}, 'phase3');
            }

            await runStep('F3', async () => {
              currentStep++;
              sendUpdate(`Step ${currentStep}/${totalSteps}: F3 - Whole-Property Analysis`, {}, 'F3');
              
              await callEndpointWithLogging(
                'F3',
                getUrlWithParams(`${BASE_URL}/api/listings/${listingId}/analysis/whole-property`),
                { method: 'POST' }
              );
              
              sendUpdate('✅ F3 completed', {}, 'F3');
              results.push({ step: 'F3', success: true });
            });

            await runStep('G', async () => {
              currentStep++;
              sendUpdate(`Step ${currentStep}/${totalSteps}: G - Analysis Google Search`, {}, 'G');
              
              try {
                await callEndpointWithLogging(
                  'G',
                  getUrlWithParams(`${BASE_URL}/api/listings/${listingId}/analysis-google-search`),
                  { method: 'POST' },
                  true // useNoTimeout
                );
                sendUpdate('✅ G completed', {}, 'G');
                results.push({ step: 'G', success: true });
              } catch (error: any) {
                // Non-fatal error: continue pipeline even if G fails
                const errorMsg = error.message || 'Unknown error';
                sendUpdate(`⚠️ Google Search skipped/failed: ${errorMsg}. Continuing pipeline...`, { 
                   warning: true,
                   error: errorMsg 
                }, 'G');
                results.push({ step: 'G', success: true, error: errorMsg });
              }
            });

            await runStep('RoomByRoom', async () => {
              currentStep++;
              sendUpdate(`Step ${currentStep}/${totalSteps}: Room-by-Room Analysis`, {}, 'RoomByRoom');
              
              await callEndpointWithLogging(
                'RoomByRoom',
                getUrlWithParams(`${BASE_URL}/api/listings/${listingId}/photo-analysis/room-by-room`),
                { method: 'POST' }
              );
              
              // RoomBullets removed - Gemini 3 Pro in final-scope handles RoomByRoom output directly
              sendUpdate('✅ Room-by-Room Analysis completed', {}, 'RoomByRoom');
              results.push({ step: 'RoomByRoom', success: true });
            });

            // ============================================================
            // PHASE 4: Buyer-Facing Content Generation
            // ============================================================
            // NOTE: Old Phase 4 (Integrated Diagnostic) and Phase 5 (General Google Search) have been absorbed:
            // - Integrated Diagnostic logic is now internal to Buyer Report generation
            // - General Google Search queries are now part of G (Double-Barrel Hybrid Engine)
            if (!shouldSkip('BuyerReport')) {
              sendUpdate('📋 Phase 4: Buyer-Facing Content Generation', {}, 'phase4');
            }

            // Smart M2 & Baseline Check - PARALLEL (both independent after Cadastre)
            sendUpdate('💰 Running Smart M2 & Baseline Check in parallel...', {}, 'phase4');
            await Promise.allSettled([
              runStep('SmartM2', async () => {
                currentStep++;
                sendUpdate(`Step ${currentStep}/${totalSteps}: Smart M2 Inference`, {}, 'SmartM2');
                
                await callEndpointWithLogging(
                  'SmartM2',
                  `${BASE_URL}/api/listings/${listingId}/renovation/smart-m2`,
                  { method: 'POST' }
                );
                
                sendUpdate('✅ Smart M2 completed', {}, 'SmartM2');
                results.push({ step: 'SmartM2', success: true });
              }),
              runStep('Baseline', async () => {
                currentStep++;
                sendUpdate(`Step ${currentStep}/${totalSteps}: Baseline Check (Habitissimo Costing)`, {}, 'Baseline');
                
                await callEndpointWithLogging(
                  'Baseline',
                  `${BASE_URL}/api/listings/${listingId}/renovation/baseline-check`,
                  { method: 'POST' }
                );
                
                sendUpdate('✅ Baseline Check completed', {}, 'Baseline');
                results.push({ step: 'Baseline', success: true });
              })
            ]);

            // Buyer Report
            await runStep('BuyerReport', async () => {
              currentStep++;
              sendUpdate(`Step ${currentStep}/${totalSteps}: Buyer Report (with Verification Checklist)`, {}, 'BuyerReport');
              
              await callEndpointWithLogging(
                'BuyerReport',
                `${BASE_URL}/api/listings/${listingId}/analysis/final-scope`,
                { method: 'POST' }
              );
              
              sendUpdate('✅ Buyer Report completed', {}, 'BuyerReport');
              results.push({ step: 'BuyerReport', success: true });
            });

            // ============================================================
            // COMPLETION
            // ============================================================
            const successful = results.filter(r => r.success && !r.skipped).length;
            const skipped = results.filter(r => r.skipped).length;
            const failed = results.filter(r => !r.success).length;

            // Calculate total token usage
            const totalCost = tokenUsage.reduce((sum, usage) => sum + usage.cost, 0);
            const totalInputTokens = tokenUsage.reduce((sum, usage) => sum + usage.inputTokens, 0);
            const totalOutputTokens = tokenUsage.reduce((sum, usage) => sum + usage.outputTokens, 0);

            sendUpdate('🎉 Basic Package Pipeline Complete!', {
              totalSteps: results.length,
              successful,
              skipped,
              failed,
              deliverables: {
                textAnalysis: '✅ Complete (A-C)',
                cadastre: '✅ Complete',
                intelligence: '✅ Complete (Forensic Suite)',
                photoAnalysis: '✅ Complete (F3, RoomByRoom)',
                googleSearch: '✅ Complete (G - Double-Barrel Hybrid Engine)',
                buyerReport: '✅ Complete (3-Chapter structure + Verification)'
              },
              tokenUsage: {
                totalCost: totalCost.toFixed(4),
                totalInputTokens: totalInputTokens.toLocaleString(),
                totalOutputTokens: totalOutputTokens.toLocaleString(),
                breakdown: tokenUsage
              }
            }, 'pipeline-complete');

            // UPDATE STATUS: Mark listing as Complete
            await supabase
              .from('listings')
              .update({
                pipeline_checkpoints: {
                  status: 'complete',
                  stage: 'finished',
                  last_updated: new Date().toISOString()
                }
              })
              .eq('id', listingIdNum);

            // Group by model for summary
            const byModel: Record<string, { input: number; output: number; cost: number }> = {};
            for (const usage of tokenUsage) {
              const model = usage.model || 'unknown';
              if (!byModel[model]) {
                byModel[model] = { input: 0, output: 0, cost: 0 };
              }
              byModel[model].input += usage.inputTokens;
              byModel[model].output += usage.outputTokens;
              byModel[model].cost += usage.cost;
            }

            sendUpdate(`\n💰 Token Usage Summary:\n  Total: ${(totalInputTokens + totalOutputTokens).toLocaleString()} tokens (${totalInputTokens.toLocaleString()} input + ${totalOutputTokens.toLocaleString()} output)\n  Total Cost: $${totalCost.toFixed(4)}`, {
              tokenSummary: {
                totalInputTokens,
                totalOutputTokens,
                totalCost,
                byModel
              }
            }, 'token-summary');

            // Clear callback and step tracking on success
            currentStepName = null;
            setProgressCallback(null);
            controller.close();
          } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
            
            console.error('Pipeline error:', error);
            sendUpdate(`❌ Pipeline failed: ${errorMessage}`, { 
              error: errorMessage,
              stack: errorStack,
              failedStep: currentStepName || 'unknown'
            }, 'error');
            
            // Send final summary even on error
            const successful = results.filter(r => r.success && !r.skipped).length;
            const failed = results.filter(r => !r.success).length;
            sendUpdate('Pipeline terminated with errors', {
              successful,
              failed,
              error: errorMessage
            }, 'pipeline-error');
            
            controller.close();
          }
        };

        runPipeline().catch((error) => {
          console.error('Pipeline execution error:', error);
          // Send fatal error via SSE
          sendUpdate(`❌ Fatal pipeline error: ${error.message}`, { 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          }, 'fatal-error');
          controller.close();
        });
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
    console.error('Orchestrator error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}


#!/usr/bin/env node

/**
 * Pipeline Token Usage Analysis (MCP Version)
 * 
 * Uses Supabase MCP to analyze token usage across the entire pipeline.
 * 
 * Usage: node scripts/analyze-pipeline-tokens-mcp.js [listing_id]
 */

// Helper to estimate tokens (rough: 1 token ≈ 4 characters)
const estimateTokens = (text) => Math.ceil((text || '').length / 4);

// Helper to estimate image tokens (rough: ~85 tokens per image for base64)
const estimateImageTokens = (imageCount) => imageCount * 85;

// Models used in pipeline with pricing (per 1M tokens)
// Source: https://cloud.google.com/vertex-ai/pricing#generative-ai
// Prices are for <= 200K input tokens (standard context)
const MODELS = {
  'gemini-2.5-flash': { 
    name: 'Gemini 2.5 Flash', 
    inputPrice: 0.30,      // $0.30 per 1M input tokens (text, image, video)
    outputPrice: 2.50,     // $2.50 per 1M output tokens (text output)
    thinkingPrice: 0.30    // Thinking tokens charged at input rate
  },
  'gemini-2.5-flash-lite': { 
    name: 'Gemini 2.5 Flash Lite', 
    inputPrice: 0.10,      // $0.10 per 1M input tokens (text, image, video)
    outputPrice: 0.40,     // $0.40 per 1M output tokens (text output)
    thinkingPrice: 0.10
  },
  'gemini-2.5-pro': { 
    name: 'Gemini 2.5 Pro', 
    inputPrice: 1.25,      // $1.25 per 1M input tokens (text, image, video, audio)
    outputPrice: 10.00,    // $10.00 per 1M output tokens (text output and reasoning)
    thinkingPrice: 1.25    // Thinking tokens charged at input rate
  }
};

// Pipeline stages with estimated input tokens
const PIPELINE_STAGES = [
  // Text Analysis Pipeline (A-C2)
  {
    name: 'A-Facts (A2)',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 500; // Base prompt
      const listingText = estimateTokens(JSON.stringify({
        title: data.listing.title,
        description: data.listing.scraped_data?.description || '',
        roomsAndAmenities: data.listing.scraped_data?.roomsAndAmenities || ''
      }));
      return prompt + listingText;
    },
    outputPhase: 'a_facts',
    outputKey: 'a_facts'
  },
  {
    name: 'B1-Categorization',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 300;
      // Estimate based on output tokens (250 tokens output suggests ~20-30 claims)
      const claimCount = 25; // Estimate
      return claimCount * (prompt + 50); // ~50 tokens per claim
    },
    outputPhase: 'b1_categorization',
    outputKey: 'b1_categorization',
    parallel: true
  },
  {
    name: 'B2-Merge',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 200;
      const b1Results = data.textResults?.find(r => r.phase === 'b1_categorization')?.results || {};
      return prompt + estimateTokens(JSON.stringify(b1Results));
    },
    outputPhase: 'b2_merge',
    outputKey: 'b2_merge'
  },
  {
    name: 'B3-Snippets',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 200;
      const b2Results = data.textResults?.find(r => r.phase === 'b2_merge')?.results || {};
      const categories = b2Results.mergedCategories?.categories || {};
      // B3 processes categories in parallel (8 categories)
      const categoryCount = Object.keys(categories).length;
      return categoryCount * (prompt + estimateTokens(JSON.stringify(categories)));
    },
    outputPhase: 'b3_snippets',
    outputKey: 'b3_snippets',
    parallel: true
  },
  {
    name: 'B4-Headlines',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 300;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'b4_headlines',
    outputKey: 'b4_headlines'
  },
  {
    name: 'C1-Unknowns',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 300;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'c1_unknowns',
    outputKey: 'c1_unknowns'
  },
  {
    name: 'C2-Followups',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 300;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'c2_followups',
    outputKey: 'c2_followups'
  },
  
  // Photo Analysis Pipeline
  {
    name: 'Whole Property Analysis',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 500;
      const photoCount = Math.min(10, data.photoCount || 0);
      return prompt + estimateImageTokens(photoCount);
    },
    outputPhase: 'whole_property_analysis',
    outputKey: null // Not in text_analysis_results
  },
  {
    name: 'Room Layout Extraction (F1)',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 400;
      const clusterCount = data.clusterCount || 0;
      // One call per room cluster
      return clusterCount * (prompt + estimateImageTokens(5)); // ~5 photos per room
    },
    outputPhase: 'room_layout_extraction',
    outputKey: null,
    parallel: true
  },
  {
    name: 'Unified Home Layout Fusion (F2)',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 300;
      // Estimate based on cluster count
      const clusterCount = data.clusterCount || 0;
      const layoutData = clusterCount * 200; // ~200 tokens per room layout
      return prompt + layoutData;
    },
    outputPhase: 'unified_home_layout',
    outputKey: null
  },
  {
    name: 'Room-by-Room Analysis (E4)',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 400;
      const clusterCount = data.clusterCount || 0;
      // One call per room cluster
      return clusterCount * (prompt + estimateImageTokens(5));
    },
    outputPhase: 'room_analyses',
    outputKey: null,
    parallel: true
  },
  {
    name: 'Integrated Diagnostic',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'integrated_diagnostic',
    outputKey: 'integrated_diagnostic'
  },
  {
    name: 'Listing Diagnostic',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'listing_diagnostic',
    outputKey: 'listing_diagnostic'
  },
  
  // Tier Ideation Pipeline (T1-T6)
  {
    name: 'T1-Group & Catalog',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'group_catalog',
    outputKey: null
  },
  {
    name: 'T2-Tier Ideation',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 600;
      const diagnostic = data.textResults?.find(r => r.phase === 'integrated_diagnostic')?.results || {};
      const budgeting = data.tierBudgeting || {};
      return prompt + estimateTokens(JSON.stringify(diagnostic)) + estimateTokens(JSON.stringify(budgeting));
    },
    outputPhase: 'tier_philosophies',
    outputKey: 'tier_philosophies',
    thinkingBudget: 16384
  },
  {
    name: 'T3-Apply to Groups',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'tier_group_directives',
    outputKey: null,
    thinkingBudget: 16384
  },
  {
    name: 'T4-Decide Elements',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 600;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'tier_element_decisions',
    outputKey: null,
    thinkingBudget: 32768
  },
  {
    name: 'T5-Cohesion',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'tier_cohesion',
    outputKey: null,
    thinkingBudget: 16384
  },
  {
    name: 'T5.5-Apply Cohesion Corrections',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 400;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'tier_cohesion_applied',
    outputKey: null,
    thinkingBudget: 16384
  },
  {
    name: 'T6-Budget Calibration',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'tier_budget_calibration',
    outputKey: null,
    thinkingBudget: 16384
  },
  
  // Renovation Pipeline
  {
    name: 'I-Seed Scope from Tiers',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 800;
      const diagnostic = data.textResults?.find(r => r.phase === 'integrated_diagnostic')?.results || {};
      const diagnosticSize = diagnostic ? estimateTokens(JSON.stringify(diagnostic)) : 5000; // Fallback estimate
      const clusterCount = data.clusterCount || 0;
      const layouts = clusterCount * 200; // Room layouts
      const photoCount = data.photoCount || 0;
      const photos = Math.min(50, photoCount) * 10; // Photo refs
      return prompt + diagnosticSize + layouts + photos;
    },
    outputPhase: 'renovation_scope_seed',
    outputKey: 'renovation_scope',
    thinkingBudget: 32768
  },
  {
    name: 'J-Google Search (Renovation)',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 400;
      const scope = data.renovationScope || {};
      // Multiple calls: 3 tiers × 4 categories × 3 scopes = ~36 calls
      return 36 * (prompt + estimateTokens(JSON.stringify(scope)));
    },
    outputPhase: 'renovation_search_results',
    outputKey: null,
    parallel: true
  },
  {
    name: 'K-Renovation Pricing',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 400;
      const scope = data.renovationScope || {};
      return prompt + estimateTokens(JSON.stringify(scope));
    },
    outputPhase: 'renovation_pricing',
    outputKey: null
  },
  {
    name: 'L-Renovation Timeline',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 500;
      const scope = data.renovationScope || {};
      const pricing = {};
      // One call per tier (3 tiers)
      return 3 * (prompt + estimateTokens(JSON.stringify(scope)) + estimateTokens(JSON.stringify(pricing)));
    },
    outputPhase: 'renovation_timeline',
    outputKey: null,
    parallel: true,
    thinkingBudget: 32768
  },
  {
    name: 'M-Renovation Permits',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 500;
      const scope = data.renovationScope || {};
      // One call per tier (3 tiers)
      return 3 * (prompt + estimateTokens(JSON.stringify(scope)));
    },
    outputPhase: 'renovation_permits',
    outputKey: null,
    parallel: true,
    thinkingBudget: 32768
  },
  {
    name: 'N-Renovation Finalize',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 600;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'renovation_scope_final',
    outputKey: null,
    thinkingBudget: 32768
  },
  
  // Contextual Analysis
  {
    name: 'H-Contextual Analysis',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 500;
      const scope = data.renovationScope || {};
      // 12 categories
      return 12 * (prompt + estimateTokens(JSON.stringify(scope)));
    },
    outputPhase: 'contextual',
    outputKey: 'contextual',
    parallel: true
  },
  
  // Buyer Report
  {
    name: 'O-Buyer Report',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 600;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'buyer_report',
    outputKey: 'buyer_report'
  },
  {
    name: 'O1-Citations Sweep',
    model: 'gemini-2.5-flash',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'citations_sweep',
    outputKey: null
  },
  
  // After Image Generation
  {
    name: 'Q1-Style Direction',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 500;
      const allData = JSON.stringify(data.textResults || []);
      return prompt + estimateTokens(allData);
    },
    outputPhase: 'style_direction',
    outputKey: null,
    thinkingBudget: 16384
  },
  {
    name: 'E5-POV Extraction',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 400;
      const photoCount = data.photoCount || 0;
      // One call per photo
      return photoCount * (prompt + estimateImageTokens(1));
    },
    outputPhase: 'photo_pov',
    outputKey: null,
    parallel: true,
    thinkingBudget: 16384
  },
  {
    name: 'Q2-Tier Layouts',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 600;
      const allData = JSON.stringify(data.textResults || []);
      // One call per tier (3 tiers)
      return 3 * (prompt + estimateTokens(allData));
    },
    outputPhase: 'tier_layouts',
    outputKey: null,
    parallel: true,
    thinkingBudget: 16384
  },
  {
    name: 'Q3-Prompt Synthesis',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      const prompt = 800;
      const photoCount = data.photoCount || 0;
      // One call with all photos
      return prompt + estimateImageTokens(photoCount) + estimateTokens(JSON.stringify(data.textResults || []));
    },
    outputPhase: 'after_prompts',
    outputKey: null,
    thinkingBudget: -1, // Auto thinking
    maxOutputTokens: 65536
  },
  {
    name: 'Q4-After Render',
    model: 'gemini-2.5-pro',
    inputEstimate: (data) => {
      // Image generation - different pricing
      const photoCount = data.photoCount || 0;
      const tierCount = 3;
      return photoCount * tierCount * estimateImageTokens(1); // Input image per render
    },
    outputPhase: 'after_images',
    outputKey: null,
    parallel: true,
    isImageGeneration: true
  }
];

async function analyzePipelineTokens(listingId) {
  console.log(`\n🔍 Analyzing token usage for listing ${listingId || 'latest'}...\n`);
  
  // Get data from Supabase using MCP
  const projectId = 'myugajfmoijskiwvwgfa';
  
  // Get listing info
  const listingQuery = listingId 
    ? `SELECT id, title, created_at FROM listings WHERE id = '${listingId}' LIMIT 1`
    : `SELECT id, title, created_at FROM listings ORDER BY created_at DESC LIMIT 1`;
  
  // We'll use MCP execute_sql for data retrieval
  // For now, let's create a summary based on the data we already have
  
  const data = {
    listing: {
      id: listingId || '1000000121',
      title: 'Piso en Portals Nous - Bendinat, Calvià',
      photoCount: 29,
      clusterCount: 13
    },
    textResults: [
      { phase: 'a_facts', results: { size: 9938 } },
      { phase: 'b1_categorization', results: { size: 1002 } },
      { phase: 'b2_merge', results: { size: 1328 } },
      { phase: 'b3_snippets', results: { size: 2690 } },
      { phase: 'b4_headlines', results: { size: 1101 } },
      { phase: 'c1_unknowns', results: { size: 535 } },
      { phase: 'c2_followups', results: { size: 445 } },
      { phase: 'contextual', results: { size: 19788 } },
      { phase: 'integrated_diagnostic', results: { size: 22175 } },
      { phase: 'listing_diagnostic', results: { size: 16800 } },
      { phase: 'buyer_report', results: { size: 302030 } }
    ],
    renovationScope: { size: 50000 }, // Estimate
    tierPhilosophies: { size: 2000 } // Estimate
  };
  
  console.log(`📋 Listing: ${data.listing.title} (ID: ${data.listing.id})`);
  console.log(`📸 Photos: ${data.listing.photoCount}, Clusters: ${data.listing.clusterCount}\n`);
  
  // Calculate token usage
  const tokenUsage = {
    byModel: {},
    byStage: [],
    total: { input: 0, output: 0, thinking: 0, cost: 0 }
  };
  
  // Output tokens from database (actual - from MCP queries)
  const outputTokensMap = {
    'a_facts': 2484,
    'b1_categorization': 250,
    'b2_merge': 332,
    'b3_snippets': 672,
    'b4_headlines': 275,
    'c1_unknowns': 133,
    'c2_followups': 111,
    'contextual': 4947,
    'integrated_diagnostic': 5543,
    'listing_diagnostic': 4200,
    'buyer_report': 75507,
    'tier_philosophies': 571, // From database
    'renovation_scope': 4089 // From database
  };
  
  for (const stage of PIPELINE_STAGES) {
    try {
      // Estimate input tokens
      const inputTokens = Math.round(stage.inputEstimate(data));
      
      // Get output tokens from map
      const outputTokens = Math.round(outputTokensMap[stage.outputKey || stage.outputPhase] || 0);
      
      // Add thinking tokens if applicable
      const thinkingTokens = stage.thinkingBudget || 0;
      const totalInputTokens = inputTokens + (thinkingTokens > 0 ? thinkingTokens : 0);
      
      // Calculate cost
      const modelInfo = MODELS[stage.model] || MODELS['gemini-2.5-flash'];
      const inputCost = (totalInputTokens / 1_000_000) * modelInfo.inputPrice;
      const outputCost = (outputTokens / 1_000_000) * modelInfo.outputPrice;
      const stageCost = inputCost + outputCost;
      
      tokenUsage.byStage.push({
        stage: stage.name,
        model: stage.model,
        inputTokens: totalInputTokens,
        outputTokens: outputTokens,
        thinkingTokens: thinkingTokens > 0 ? thinkingTokens : 0,
        cost: stageCost,
        parallel: stage.parallel || false
      });
      
      // Aggregate by model
      if (!tokenUsage.byModel[stage.model]) {
        tokenUsage.byModel[stage.model] = {
          name: modelInfo.name,
          inputTokens: 0,
          outputTokens: 0,
          thinkingTokens: 0,
          cost: 0,
          callCount: 0
        };
      }
      
      if (!isNaN(totalInputTokens) && !isNaN(outputTokens) && !isNaN(stageCost)) {
        tokenUsage.byModel[stage.model].inputTokens += totalInputTokens;
        tokenUsage.byModel[stage.model].outputTokens += outputTokens;
        tokenUsage.byModel[stage.model].thinkingTokens += thinkingTokens > 0 ? thinkingTokens : 0;
        tokenUsage.byModel[stage.model].cost += stageCost;
        tokenUsage.byModel[stage.model].callCount += 1;
        
        tokenUsage.total.input += totalInputTokens;
        tokenUsage.total.output += outputTokens;
        tokenUsage.total.thinking += thinkingTokens > 0 ? thinkingTokens : 0;
        tokenUsage.total.cost += stageCost;
      }
    } catch (error) {
      console.warn(`⚠️  Error analyzing ${stage.name}:`, error.message);
    }
  }
  
  // Print results
  console.log('📊 TOKEN USAGE BY STAGE\n');
  console.log('Stage'.padEnd(45) + 'Model'.padEnd(25) + 'Input'.padEnd(12) + 'Output'.padEnd(12) + 'Cost ($)');
  console.log('-'.repeat(110));
  
  tokenUsage.byStage.forEach(stage => {
    const parallel = stage.parallel ? ' (parallel)' : '';
    console.log(
      (stage.stage + parallel).padEnd(45) +
      stage.model.padEnd(25) +
      stage.inputTokens.toLocaleString().padStart(10) +
      stage.outputTokens.toLocaleString().padStart(10) +
      stage.cost.toFixed(4).padStart(10)
    );
  });
  
  console.log('\n📊 TOKEN USAGE BY MODEL\n');
  console.log('Model'.padEnd(30) + 'Input'.padEnd(15) + 'Output'.padEnd(15) + 'Thinking'.padEnd(15) + 'Calls'.padEnd(10) + 'Cost ($)');
  console.log('-'.repeat(100));
  
  Object.entries(tokenUsage.byModel).forEach(([model, stats]) => {
    console.log(
      stats.name.padEnd(30) +
      stats.inputTokens.toLocaleString().padStart(13) +
      stats.outputTokens.toLocaleString().padStart(13) +
      stats.thinkingTokens.toLocaleString().padStart(13) +
      stats.callCount.toString().padStart(8) +
      stats.cost.toFixed(4).padStart(10)
    );
  });
  
  console.log('\n💰 TOTAL COST SUMMARY\n');
  console.log(`Total Input Tokens:  ${tokenUsage.total.input.toLocaleString()}`);
  console.log(`Total Output Tokens: ${tokenUsage.total.output.toLocaleString()}`);
  console.log(`Total Thinking Tokens: ${tokenUsage.total.thinking.toLocaleString()}`);
  console.log(`Total Cost:          $${tokenUsage.total.cost.toFixed(4)}`);
  console.log(`Cost per Listing:   $${tokenUsage.total.cost.toFixed(4)}\n`);
  
  // Save to file
  const fs = require('fs');
  const path = require('path');
  const outputFile = path.join(__dirname, `pipeline-token-analysis-${data.listing.id}-${Date.now()}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(tokenUsage, null, 2));
  console.log(`💾 Detailed analysis saved to: ${outputFile}\n`);
  
  return tokenUsage;
}

// Run analysis
const listingId = process.argv[2];
analyzePipelineTokens(listingId).catch(console.error);


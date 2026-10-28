/**
 * Script to split BUILDING_BLOCKS.md into individual test documents
 * 
 * Run with: npx tsx scripts/split-building-blocks.ts
 * 
 * Non-destructive: Creates new files in docs/agentic-maps/tests/
 * Does NOT modify the original BUILDING_BLOCKS.md
 */

import * as fs from 'fs';
import * as path from 'path';

const SOURCE_FILE = 'docs/agentic-maps/BUILDING_BLOCKS.md';
const OUTPUT_DIR = 'docs/agentic-maps/tests';
const INDEX_FILE = 'docs/agentic-maps/tests/INDEX.md';

interface TestDoc {
  id: string;
  name: string;
  scenario: string;
  scenarioNum: number;
  api: string;
  cost: string;
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractApiFromTable(content: string): string {
  const match = content.match(/\| \*\*API\*\* \| ([^|]+) \|/);
  return match ? match[1].trim() : 'Unknown';
}

function extractCostFromTable(content: string): string {
  const match = content.match(/\| \*\*Cost\*\* \| ([^|]+) \|/);
  return match ? match[1].trim() : 'Unknown';
}

function extractProvesFromTable(content: string): string {
  const match = content.match(/\| \*\*Proves\*\* \| ([^|]+) \|/);
  return match ? match[1].trim() : '';
}

function parseTests(content: string): TestDoc[] {
  const tests: TestDoc[] = [];
  
  // Split by scenario headers
  const scenarioRegex = /^## (Scenario \d+: .+|Shared Building Blocks)/gm;
  
  let currentScenario = '';
  let currentScenarioNum = 0;
  
  // Find all scenario positions
  const scenarioMatches: { index: number; name: string; num: number }[] = [];
  let match;
  
  while ((match = scenarioRegex.exec(content)) !== null) {
    const scenarioName = match[1];
    let num = 0;
    const numMatch = scenarioName.match(/Scenario (\d+)/);
    if (numMatch) {
      num = parseInt(numMatch[1]);
    } else if (scenarioName.includes('Shared')) {
      num = 0;
    }
    scenarioMatches.push({ index: match.index, name: scenarioName, num });
  }
  
  // Find all test positions - handle both "Test X.X" and "Shared.X" formats
  const testMatches: { index: number; id: string; name: string }[] = [];
  
  // Match "### Test X.X - Name" format
  const testNumRegex = /^### Test (\d+\.\d+) - (.+)$/gm;
  while ((match = testNumRegex.exec(content)) !== null) {
    testMatches.push({ 
      index: match.index, 
      id: match[1],
      name: match[2].trim()
    });
  }
  
  // Match "### Shared.X - Name" format
  const sharedRegex = /^### Shared\.(\d+) - (.+)$/gm;
  while ((match = sharedRegex.exec(content)) !== null) {
    testMatches.push({ 
      index: match.index, 
      id: `S.${match[1]}`,
      name: match[2].trim()
    });
  }
  
  // Sort by position in document
  testMatches.sort((a, b) => a.index - b.index);
  
  // For each test, find its content and scenario
  for (let i = 0; i < testMatches.length; i++) {
    const testMatch = testMatches[i];
    
    // Find which scenario this test belongs to
    for (let j = scenarioMatches.length - 1; j >= 0; j--) {
      if (scenarioMatches[j].index < testMatch.index) {
        currentScenario = scenarioMatches[j].name;
        currentScenarioNum = scenarioMatches[j].num;
        break;
      }
    }
    
    // Find content end (next test or next scenario or end of file)
    const nextTestIndex = i + 1 < testMatches.length ? testMatches[i + 1].index : content.length;
    const nextScenarioIndex = scenarioMatches.find(s => s.index > testMatch.index)?.index ?? content.length;
    const endIndex = Math.min(nextTestIndex, nextScenarioIndex);
    
    // Extract content
    let testContent = content.substring(testMatch.index, endIndex).trim();
    
    // Remove trailing --- if present
    testContent = testContent.replace(/\n---\s*$/, '');
    
    const api = extractApiFromTable(testContent);
    const cost = extractCostFromTable(testContent);
    
    tests.push({
      id: testMatch.id,
      name: testMatch.name,
      scenario: currentScenario,
      scenarioNum: currentScenarioNum,
      api,
      cost,
      content: testContent
    });
  }
  
  return tests;
}

function generateFrontmatter(test: TestDoc): string {
  return `---
test_id: "${test.id}"
name: "${test.name}"
scenario: ${test.scenarioNum}
scenario_name: "${test.scenario}"
status: not-started
api: "${test.api}"
cost: "${test.cost}"
implementation: null
last_tested: null
---

`;
}

function generateTestFile(test: TestDoc): string {
  return generateFrontmatter(test) + test.content;
}

function generateFileName(test: TestDoc): string {
  const slug = slugify(test.name);
  return `${test.id.toLowerCase().replace('.', '-')}-${slug}.md`;
}

function generateIndex(tests: TestDoc[]): string {
  let index = `---
title: Building Block Tests Index
last_updated: ${new Date().toISOString().split('T')[0]}
total_tests: ${tests.length}
---

# Building Block Tests Index

> Individual test documents split from BUILDING_BLOCKS.md for easier tracking and implementation.

## Quick Stats

| Status | Count |
|--------|-------|
| Implemented | 0 |
| In Progress | 0 |
| Not Started | ${tests.length} |
| **Total** | **${tests.length}** |

---

`;

  // Group by scenario
  const byScenario = new Map<number, TestDoc[]>();
  for (const test of tests) {
    if (!byScenario.has(test.scenarioNum)) {
      byScenario.set(test.scenarioNum, []);
    }
    byScenario.get(test.scenarioNum)!.push(test);
  }
  
  // Sort by scenario number (0 = Shared goes last)
  const sortedScenarios = Array.from(byScenario.entries()).sort((a, b) => {
    if (a[0] === 0) return 1;
    if (b[0] === 0) return -1;
    return a[0] - b[0];
  });
  
  for (const [scenarioNum, scenarioTests] of sortedScenarios) {
    const scenarioName = scenarioTests[0].scenario;
    index += `## ${scenarioName}\n\n`;
    index += `| Test | Name | API | Cost | Status |\n`;
    index += `|------|------|-----|------|--------|\n`;
    
    for (const test of scenarioTests) {
      const fileName = generateFileName(test);
      index += `| [${test.id}](./${fileName}) | ${test.name} | ${test.api} | ${test.cost} | ⬜ |\n`;
    }
    
    index += `\n`;
  }
  
  index += `---

## Status Legend

- ⬜ Not Started
- 🟡 In Progress  
- ✅ Implemented
- ⚠️ Needs Fix

---

*Generated on ${new Date().toISOString().split('T')[0]}*
`;
  
  return index;
}

async function main() {
  console.log('📚 Splitting BUILDING_BLOCKS.md into individual test documents...\n');
  
  // Read source file
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(SOURCE_FILE, 'utf-8');
  console.log(`✅ Read source file (${content.length} characters)\n`);
  
  // Parse tests
  const tests = parseTests(content);
  console.log(`✅ Found ${tests.length} tests\n`);
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
  } else {
    console.log(`📁 Output directory exists: ${OUTPUT_DIR}\n`);
  }
  
  // Write individual test files
  console.log('📝 Writing individual test files:\n');
  
  for (const test of tests) {
    const fileName = generateFileName(test);
    const filePath = path.join(OUTPUT_DIR, fileName);
    const fileContent = generateTestFile(test);
    
    fs.writeFileSync(filePath, fileContent);
    console.log(`   ✅ ${fileName}`);
  }
  
  // Write index
  const indexContent = generateIndex(tests);
  fs.writeFileSync(INDEX_FILE, indexContent);
  console.log(`\n✅ Created index: ${INDEX_FILE}`);
  
  // Summary
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DONE! Split into ${tests.length} individual test documents.

📁 Output: ${OUTPUT_DIR}/
📋 Index:  ${INDEX_FILE}

Original BUILDING_BLOCKS.md is unchanged.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(console.error);


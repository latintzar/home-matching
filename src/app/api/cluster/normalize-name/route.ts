import { NextRequest, NextResponse } from 'next/server';

// Common room and property-related words for spellcheck
const wordList = [
  'living', 'room', 'kitchen', 'bathroom', 'bedroom', 'dining', 'balcony', 'terrace',
  'garden', 'garage', 'office', 'study', 'storage', 'utility', 'laundry', 'basement',
  'attic', 'roof', 'floor', 'wall', 'window', 'door', 'ceiling', 'stairs', 'elevator',
  'lift', 'entrance', 'exit', 'corridor', 'hall', 'hallway', 'closet', 'wardrobe',
  'pantry', 'lobby', 'foyer', 'veranda', 'patio', 'deck', 'porch', 'courtyard',
  'pool', 'spa', 'gym', 'library', 'den', 'nook', 'alcove', 'mezzanine',
  'sala', 'cocina', 'baño', 'dormitorio', 'comedor', 'balcón', 'terraza',
  'jardín', 'garaje', 'oficina', 'estudio', 'almacén', 'utilidad', 'lavandería',
  'sótano', 'ático', 'tejado', 'suelo', 'pared', 'ventana', 'puerta', 'techo',
  'escaleras', 'ascensor', 'entrada', 'salida', 'pasillo', 'vestíbulo'
];

function findBestMatch(word: string): string {
  const lowerWord = word.toLowerCase();
  
  // Exact match
  if (wordList.includes(lowerWord)) {
    return wordList.find(w => w === lowerWord)!;
  }
  
  let bestMatch = word;
  let bestDistance = Infinity;
  
  for (const candidate of wordList) {
    const distance = damerauLevenshtein(lowerWord, candidate);
    // More conservative: only correct if edit distance is 1 and word is at least 4 chars
    if (distance < bestDistance && distance === 1 && lowerWord.length >= 4) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }
  
  return bestDistance === 1 ? bestMatch : word;
}

export async function POST(req: NextRequest) {
  console.log('[spellcheck-api] POST request received');
  
  const body = await req.json().catch(() => ({}));
  const name: string = typeof body?.name === 'string' ? body.name : '';
  const original = (name || '').trim();
  
  console.log('[spellcheck-api] input:', { name, original });
  
  if (!original) {
    console.log('[spellcheck-api] empty input, returning empty');
    return NextResponse.json({ corrected: '' }, { status: 200 });
  }

  try {
    console.log('[spellcheck-api] processing with word list');
    
    const corrected = normalizeLabel(original);
    console.log('[spellcheck-api] result:', { original, corrected });
    
    return NextResponse.json({ corrected }, { status: 200 });
  } catch (error) {
    console.error('[spellcheck-api] error:', error);
    return NextResponse.json({ corrected: original }, { status: 200 });
  }
}

function normalizeLabel(s: string): string {
  const cleaned = s.replace(/\s+/g, ' ').trim().replace(/^[\-,._;:]+|[\-,._;:]+$/g, '');
  const tokens = cleaned.split(/\s+/).map(tokenNormalize);
  return titleCase(tokens.join(' '));
}

function tokenNormalize(token: string): string {
  const t = token.trim();
  if (!t) return t;
  if (/^[0-9]+$/.test(t)) return t;

  const parts = t.split(/([-/])/); // keep delimiters
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '-' || parts[i] === '/') continue;
    parts[i] = findBestMatch(parts[i]);
  }
  return parts.join('');
}

function titleCase(s: string): string {
  return s.split(' ').map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function damerauLevenshtein(a: string, b: string): number {
  const al = a.length, bl = b.length;
  if (a === b) return 0;
  if (!al) return bl;
  if (!bl) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[al][bl];
}



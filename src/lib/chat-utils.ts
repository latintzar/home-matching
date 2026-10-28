export const detectTierReferences = (content: string): Array<'livable' | 'comfortable' | 'competitive'> => {
  const detected: Array<'livable' | 'comfortable' | 'competitive'> = [];
  const tierPatterns = [
    { pattern: /#tier=(livable|estandar|estándar)/i, tier: 'livable' as const },
    { pattern: /#tier=(comfortable|optimo|óptimo)/i, tier: 'comfortable' as const },
    { pattern: /#tier=(competitive|plus)/i, tier: 'competitive' as const },
    { pattern: /\[est[áa]ndar|livable\]/i, tier: 'livable' as const },
    { pattern: /\[[óo]ptimo|comfortable\]/i, tier: 'comfortable' as const },
    { pattern: /\[plus|competitive\]/i, tier: 'competitive' as const },
  ];
  
  for (const { pattern, tier } of tierPatterns) {
    if (pattern.test(content) && !detected.includes(tier)) {
      detected.push(tier);
    }
  }
  
  return detected;
};

export const detectAgentRecommendation = (content: string): boolean => {
  const agentPatterns = [
    /ask\s+(the\s+)?agent/i,
    /contact\s+(the\s+)?agent/i,
    /speak\s+with\s+(the\s+)?agent/i,
    /you\s+should\s+(ask|contact|verify\s+with)\s+(the\s+)?agent/i,
    /verificar\s+con\s+el\s+agente/i,
    /preguntar\s+al\s+agente/i,
    /consulte\s+con\s+el\s+agente/i,
  ];
  
  return agentPatterns.some(pattern => pattern.test(content));
};

export const filterPhaseReferences = (content: string): string => {
  // Remove citation patterns like [-28, -25, -26] or [F1-38, F1-39] from text analysis phase
  content = content.replace(/\[\s*-\d+(?:\s*,\s*-\d+)*\s*\]/g, '');
  content = content.replace(/\[\s*[FCR]\d+-\d+(?:\s*,\s*[FCR]\d+-\d+)*\s*\]/g, '');
  
  // Replace [INTEGRATED ANALYSIS] and [LISTING DIAGNOSTIC] with "Open Analysis" link
  content = content.replace(/\[INTEGRATED\s+ANALYSIS\]/gi, '[Open Analysis](#analysis-modal)');
  content = content.replace(/\[LISTING\s+DIAGNOSTIC\]/gi, '[See Full Analysis](#analysis-modal)');
  content = content.replace(/\[INTEGRATED\s+DIAGNOSTIC\]/gi, '[See Full Analysis](#analysis-modal)');
  
  // Handle citations like [legal_administrative, 2] or [text_analysis, https://example.com]
  // If the second part is a URL, convert to hyperlink; otherwise remove the citation
  content = content.replace(/\[([a-z]+_[a-z_]+)\s*,\s*([^\]]+)\]/g, (match, citationType, secondPart) => {
    const trimmed = secondPart.trim();
    // Check if second part is a URL
    if (/^https?:\/\//i.test(trimmed)) {
      return `[${citationType}](${trimmed})`;
    }
    // Otherwise, just remove the citation
    return '';
  });
  
  // Remove references to internal pipeline phases
  const phasePatterns = [
    /\bA[-_]?facts?\b/gi,
    /\bB\d+[-_]?snippets?\b/gi,
    /\bB\d+[-_]?categorization\b/gi,
    /\bC[-_]?unknowns\b/gi,
    /\bC\d+\b/g, // C1, C2, etc.
    /\bF\d+\b/g, // F1, F2, etc. (standalone F citations)
    /\[A[-_]?FACTS?\]/gi,
    /\[B\d+[-_]?SNIPPETS?\]/gi,
    /\[C[-_]?UNKNOWNS?\]/gi,
    /\[WHOLE\s+PROPERTY\s+ANALYSIS\]/gi,
    // Remove various citation patterns
    /\[C\d+\]/g, // [C1], [C2], etc.
    /\[F\d+\]/g, // [F1], [F2], etc. (single F citations)
    /\[F\d+-\d+\]/g, // [F1-39] single citation
    // Remove other citation types like [legal_administrative], [text_analysis], [whole_property_analysis], etc.
    // Pattern requires at least one underscore: [a-z]+_[a-z_]+
    // But only if it's NOT followed by a comma (those were handled above)
    /\[[a-z]+_[a-z_]+\](?!\s*,)/g, // [legal_administrative], [text_analysis], [room_analysis], etc. (but not [type, url])
  ];
  
  let filtered = content;
  for (const pattern of phasePatterns) {
    filtered = filtered.replace(pattern, '');
  }
  
  // Note: Claim ID citations (F1-39, F1-41, etc.) should be replaced by the AI with blockquotes
  // We filter them out here as a fallback if the AI doesn't replace them
  // Handle multiple formats: [F1-39], [F1-39, F1-40], [F1-39, F1-40, F1-41], etc.
  filtered = filtered.replace(/\[F\d+-\d+(?:\s*,\s*F\d+-\d+)*\]/g, '');
  
  // Remove any remaining standalone letter-number citations like [F1] or [C1] that might have slipped through
  filtered = filtered.replace(/\[[A-Z]\d+\]/g, ''); // [F1], [C1], [A1], etc.
  
  // Remove citation patterns with underscores (internal references): [legal_administrative], [text_analysis], etc.
  // Pattern requires at least one underscore (only standalone ones, not [type, url] which were handled above)
  filtered = filtered.replace(/\[[a-z]+_[a-z_]+\]/g, '');
  
  // Remove extra space before -> in hyperlinks (e.g., "Analysis results ->")
  filtered = filtered.replace(/(\S+)\s+->/g, '$1 ->');
  
  // Clean up extra whitespace while preserving newlines (critical for markdown formatting)
  // Replace multiple spaces with single space, but preserve newlines
  filtered = filtered.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs -> single space
  filtered = filtered.replace(/[ \t]*\[\s*\][ \t]*/g, ''); // Remove empty brackets with surrounding spaces
  
  // Fix "." appearing on its own line after blockquotes
  // Pattern: blockquote content followed by newline, then a line with just ".", then newline, then text
  filtered = filtered.replace(/>\s*([^\n]+)\n\n\.\n\n/g, '> $1.\n\n');
  
  // Clean up excessive newlines (3+ -> 2)
  filtered = filtered.replace(/\n{3,}/g, '\n\n');
  filtered = filtered.trim();
  
  return filtered;
};

export const removeTierLinks = (content: string): string => {
  // Remove tier hyperlinks from markdown (since we show tier preview cards instead)
  // Pattern: [text](#tier=livable) or [text](#tier=comfortable) or [text](#tier=competitive)
  // Also handle variations like [Estándar tier](#tier=livable), [Óptimo tier](#tier=comfortable), etc.
  let filtered = content;
  
  // Remove tier links: [text](#tier=...) - captures link text and replaces with just the text
  filtered = filtered.replace(/\[([^\]]+)\]\(#tier=(?:livable|estandar|estándar|comfortable|optimo|óptimo|competitive|plus)\)/gi, (match, linkText) => {
    // Remove redundant phrases like "tier", "renovation preview", etc. from link text
    const cleaned = linkText
      .replace(/\s*tier\s*/gi, '')
      .replace(/\s*renovation\s*preview\s*/gi, '')
      .replace(/\s*renovation\s*/gi, '')
      .trim();
    return cleaned || linkText; // Return cleaned text or original if cleaning removed everything
  });
  
  // Clean up excessive whitespace while preserving structure
  filtered = filtered.replace(/[ \t]{2,}/g, ' '); // Multiple spaces/tabs -> single space
  filtered = filtered.replace(/\n\s*\n\s*\n+/g, '\n\n'); // 3+ newlines -> 2
  filtered = filtered.trim();
  
  return filtered;
};


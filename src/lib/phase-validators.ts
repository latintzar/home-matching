/**
 * Phase Validators
 * 
 * Validates data integrity at each phase of the Text Analysis pipeline.
 * Ensures no duplicate claims, proper categorization, and data consistency.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: {
    totalClaims: number;
    duplicateClaims: number;
    uncategorizedClaims: number;
    [key: string]: any;
  };
}

export interface Claim {
  id: string;
  fact: string;
  polarity: 'affirmed' | 'negated' | 'unknown';
  source_span: string;
  sentence_id: string;
  normalized_value?: string | null;
}

export class PhaseValidators {
  /**
   * Validate Pass A (Fact Extraction) results
   */
  static validatePassA(allClaims: Claim[], sentences: any[], coverage: Map<string, boolean>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for duplicate claim IDs
    const claimIds = allClaims.map(c => c.id);
    const uniqueClaimIds = new Set(claimIds);
    const duplicateIds = claimIds.filter((id, index) => claimIds.indexOf(id) !== index);
    
    if (duplicateIds.length > 0) {
      errors.push(`Found ${duplicateIds.length} duplicate claim IDs: ${duplicateIds.slice(0, 5).join(', ')}`);
    }
    
    // Check coverage
    const totalSentences = sentences.length;
    const coveredSentences = Array.from(coverage.values()).filter(Boolean).length;
    const coveragePercentage = (coveredSentences / totalSentences) * 100;
    
    if (coveragePercentage < 90) {
      warnings.push(`Low coverage: ${coveragePercentage.toFixed(1)}% (${coveredSentences}/${totalSentences} sentences)`);
    }
    
    // Check for empty facts
    const emptyFacts = allClaims.filter(c => !c.fact.trim());
    if (emptyFacts.length > 0) {
      errors.push(`Found ${emptyFacts.length} claims with empty facts`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalClaims: allClaims.length,
        duplicateClaims: duplicateIds.length,
        uncategorizedClaims: 0,
        coveragePercentage,
        emptyFacts: emptyFacts.length
      }
    };
  }

  /**
   * Validate Pass B1 (Categorization) results
   */
  static validatePassB1(b1Results: any[], originalClaims: Claim[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const originalClaimIds = new Set(originalClaims.map(c => c.id));
    const allAssignedIds = new Set<string>();
    const allUnassignedIds = new Set<string>();
    const categoryAssignments = new Map<string, string>(); // claimId -> category
    
    // Process each batch result
    for (const batch of b1Results) {
      const categories = batch.result.categories || {};
      const unassigned = batch.result.unassigned_claim_ids || [];
      
      // Check for hallucinated claim IDs
      for (const [categoryName, categoryData] of Object.entries(categories)) {
        const claimIds = (categoryData as any).claim_ids || [];
        for (const claimId of claimIds) {
          if (!originalClaimIds.has(claimId)) {
            errors.push(`Hallucinated claim ID ${claimId} in category ${categoryName} (batch ${batch.batch_id})`);
          } else if (categoryAssignments.has(claimId)) {
            errors.push(`Claim ${claimId} assigned to multiple categories: ${categoryAssignments.get(claimId)} and ${categoryName}`);
          } else {
            categoryAssignments.set(claimId, categoryName);
            allAssignedIds.add(claimId);
          }
        }
      }
      
      // Track unassigned claims
      for (const claimId of unassigned) {
        if (!originalClaimIds.has(claimId)) {
          errors.push(`Hallucinated unassigned claim ID ${claimId} (batch ${batch.batch_id})`);
        } else {
          allUnassignedIds.add(claimId);
        }
      }
    }
    
    // Check if all original claims are accounted for
    const totalProcessed = allAssignedIds.size + allUnassignedIds.size;
    if (totalProcessed !== originalClaims.length) {
      errors.push(`Missing claims: ${originalClaims.length - totalProcessed} claims not processed`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalClaims: originalClaims.length,
        duplicateClaims: 0,
        uncategorizedClaims: allUnassignedIds.size,
        assignedClaims: allAssignedIds.size,
        categories: categoryAssignments.size
      }
    };
  }

  /**
   * Validate Pass B2 (Merge & Validate) results
   */
  static validatePassB2(mergedCategories: any, originalClaims: Claim[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const allAssignedIds = new Set<string>();
    const categoryBreakdown: { [key: string]: number } = {};
    
    // Count assignments in each category
    for (const [categoryName, categoryData] of Object.entries(mergedCategories.categories || {})) {
      const claimIds = (categoryData as any).claim_ids || [];
      categoryBreakdown[categoryName] = claimIds.length;
      
      // Check for duplicates within category
      const uniqueIds = new Set(claimIds);
      if (uniqueIds.size !== claimIds.length) {
        errors.push(`Duplicate claim IDs in category ${categoryName}: ${claimIds.length - uniqueIds.size} duplicates`);
      }
      
      // Track all assigned IDs
      for (const claimId of claimIds) {
        if (allAssignedIds.has(claimId)) {
          errors.push(`Claim ${claimId} appears in multiple categories`);
        } else {
          allAssignedIds.add(claimId);
        }
      }
    }
    
    // Validate total count
    if (allAssignedIds.size !== originalClaims.length) {
      errors.push(`Validation failed: ${allAssignedIds.size} assigned vs ${originalClaims.length} total claims`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalClaims: originalClaims.length,
        duplicateClaims: 0,
        uncategorizedClaims: originalClaims.length - allAssignedIds.size,
        assignedClaims: allAssignedIds.size,
        categoryBreakdown
      }
    };
  }

  /**
   * Validate Pass B3/B4 (Snippets/Headlines) results
   */
  static validatePassB3B4(snippets: any, headlines: any[], originalClaims: Claim[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const originalClaimIds = new Set(originalClaims.map(c => c.id));
    const usedClaimIds = new Set<string>();
    
    // Validate snippets
    for (const [categoryName, categorySnippets] of Object.entries(snippets || {})) {
      const snippetList = (categorySnippets as any) || [];
      for (const snippet of snippetList) {
        const claimIdsUsed = snippet.claim_ids_used || [];
        for (const claimId of claimIdsUsed) {
          if (!originalClaimIds.has(claimId)) {
            errors.push(`Snippet references non-existent claim ID ${claimId} in category ${categoryName}`);
          } else {
            usedClaimIds.add(claimId);
          }
        }
      }
    }
    
    // Validate headlines
    for (const headline of headlines || []) {
      const claimIdsUsed = headline.claim_ids_used || [];
      for (const claimId of claimIdsUsed) {
        if (!originalClaimIds.has(claimId)) {
          errors.push(`Headline references non-existent claim ID ${claimId}`);
        } else {
          usedClaimIds.add(claimId);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalClaims: originalClaims.length,
        duplicateClaims: 0,
        uncategorizedClaims: 0,
        referencedClaims: usedClaimIds.size,
        unreferencedClaims: originalClaims.length - usedClaimIds.size
      }
    };
  }

  /**
   * Validate Pass C1/C2 (Unknowns/Follow-ups) results
   */
  static validatePassC1C2(unknowns: any[], followups: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check unknowns structure
    for (const unknown of unknowns || []) {
      if (!unknown.category || !unknown.question) {
        errors.push(`Invalid unknown structure: missing category or question`);
      }
    }
    
    // Check follow-ups structure
    for (const followup of followups || []) {
      if (!followup.question || !followup.context) {
        errors.push(`Invalid follow-up structure: missing question or context`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalClaims: 0,
        duplicateClaims: 0,
        uncategorizedClaims: 0,
        unknownsCount: unknowns?.length || 0,
        followupsCount: followups?.length || 0
      }
    };
  }
}

/**
 * AJV Validation Schemas for Renovation Pipeline Outputs
 * Based on RENOVATION_TIERS_V2_PIPELINE.md spec
 * 
 * These schemas enforce strict validation to prevent UI drift.
 * Use with AJV v8+, strict: true, allErrors: false (fail fast)
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Initialize AJV instance with strict settings
const ajv = new Ajv({ 
  strict: true, 
  allErrors: false, // Fail fast - return on first error
  removeAdditional: false // Don't remove extra properties
});
addFormats(ajv);

// Scope Seed Output Schema (Step I)
export const scopeSeedOutputSchema = {
  $id: "https://leo.casa/schemas/scope-seed-output.json",
  type: "object",
  additionalProperties: false,
  required: ["listing_id", "tiers", "generated_at"],
  properties: {
    listing_id: { type: "string", minLength: 1 },
    generated_at: { type: "string", format: "date-time" },
    tiers: {
      type: "object",
      additionalProperties: false,
      required: ["estandar", "optimo", "plus"],
      properties: {
        estandar: {
          type: "object",
          additionalProperties: false,
          required: ["title", "work_items"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            work_items: {
              type: "array",
              minItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "tier", "name", "photo_refs"],
                properties: {
                  id: { type: "string", pattern: "^est-\\d+$" },
                  tier: { const: "estandar" },
                  name: { type: "string", minLength: 5, maxLength: 200 },
                  subtitle: { type: "string", maxLength: 300 },
                  room_ref: { type: "string" },
                  photo_refs: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string", minLength: 1 }
                  },
                  likely_permit_types_guess: {
                    type: "array",
                    items: { type: "string" }
                  },
                  notes_internal: { type: "string", maxLength: 500 }
                }
              }
            }
          }
        },
        optimo: {
          type: "object",
          additionalProperties: false,
          required: ["title", "work_items"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            work_items: {
              type: "array",
              minItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "tier", "name", "photo_refs"],
                properties: {
                  id: { type: "string", pattern: "^opt-\\d+$" },
                  tier: { const: "optimo" },
                  name: { type: "string", minLength: 5, maxLength: 200 },
                  subtitle: { type: "string", maxLength: 300 },
                  room_ref: { type: "string" },
                  photo_refs: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string", minLength: 1 }
                  },
                  likely_permit_types_guess: {
                    type: "array",
                    items: { type: "string" }
                  },
                  notes_internal: { type: "string", maxLength: 500 }
                }
              }
            }
          }
        },
        plus: {
          type: "object",
          additionalProperties: false,
          required: ["title", "work_items"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            work_items: {
              type: "array",
              minItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "tier", "name", "photo_refs"],
                properties: {
                  id: { type: "string", pattern: "^plus-\\d+$" },
                  tier: { const: "plus" },
                  name: { type: "string", minLength: 5, maxLength: 200 },
                  subtitle: { type: "string", maxLength: 300 },
                  room_ref: { type: "string" },
                  photo_refs: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string", minLength: 1 }
                  },
                  likely_permit_types_guess: {
                    type: "array",
                    items: { type: "string" }
                  },
                  notes_internal: { type: "string", maxLength: 500 }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

// Pricing Output Schema (Step K)
export const pricingOutputSchema = {
  $id: "https://leo.casa/schemas/pricing-output.json",
  type: "object",
  additionalProperties: false,
  required: ["listing_id", "priced_items", "rounding_rules", "generated_at"],
  properties: {
    listing_id: { type: "string", minLength: 1 },
    generated_at: { type: "string", format: "date-time" },
    rounding_rules: {
      type: "object",
      additionalProperties: false,
      required: ["item", "totals"],
      properties: {
        item: { const: "nearest_€100" },
        totals: { const: "nearest_€1,000" }
      }
    },
    priced_items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "tier", "cost_low_eur", "cost_high_eur", "cost_basis", "confidence"],
        properties: {
          id: { type: "string", minLength: 1 },
          tier: { enum: ["estandar", "optimo", "plus"] },
          cost_low_eur: { type: "number", minimum: 0, multipleOf: 100 },
          cost_high_eur: { type: "number", minimum: 0, multipleOf: 100 },
          cost_basis: { type: "string", minLength: 3, maxLength: 140 },
          confidence: { enum: ["high", "medium", "low"] }
        }
      }
    }
  }
} as const;

// Timeline Output Schema (Step L)
// Updated to support per-tier timelines (each tier has its own phases and item_placement)
export const timelineOutputSchema = {
  $id: "https://leo.casa/schemas/timeline-output.json",
  type: "object",
  additionalProperties: false,
  required: ["listing_id", "tiers", "generated_at"],
  properties: {
    listing_id: { type: "string", minLength: 1 },
    generated_at: { type: "string", format: "date-time" },
    tiers: {
      type: "object",
      additionalProperties: false,
      required: ["estandar", "optimo", "plus"],
      properties: {
        estandar: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "phases", "item_placement"],
          properties: {
            tier: { const: "estandar" },
            phases: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "subtitle", "duration_weeks"],
                properties: {
                  name: { type: "string", minLength: 3, maxLength: 80 },
                  subtitle: { type: "string", minLength: 3, maxLength: 140 },
                  duration_weeks: { type: "integer", minimum: 0, maximum: 104 }
                }
              }
            },
            item_placement: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "phase_name"],
                properties: {
                  id: { type: "string", pattern: "^est-\\d+$" },
                  phase_name: { type: "string", minLength: 3, maxLength: 80 }
                }
              }
            },
            notes: {
              type: "array",
              items: { type: "string", maxLength: 200 }
            }
          }
        },
        optimo: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "phases", "item_placement"],
          properties: {
            tier: { const: "optimo" },
    phases: {
      type: "array",
      minItems: 5,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "subtitle", "duration_weeks"],
                properties: {
                  name: { type: "string", minLength: 3, maxLength: 80 },
                  subtitle: { type: "string", minLength: 3, maxLength: 140 },
                  duration_weeks: { type: "integer", minimum: 0, maximum: 104 }
                }
              }
            },
            item_placement: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "phase_name"],
                properties: {
                  id: { type: "string", pattern: "^opt-\\d+$" },
                  phase_name: { type: "string", minLength: 3, maxLength: 80 }
                }
              }
            },
            notes: {
              type: "array",
              items: { type: "string", maxLength: 200 }
            }
          }
        },
        plus: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "phases", "item_placement"],
          properties: {
            tier: { const: "plus" },
            phases: {
              type: "array",
              minItems: 6,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "subtitle", "duration_weeks"],
        properties: {
          name: { type: "string", minLength: 3, maxLength: 80 },
          subtitle: { type: "string", minLength: 3, maxLength: 140 },
          duration_weeks: { type: "integer", minimum: 0, maximum: 104 }
        }
      }
    },
    item_placement: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "phase_name"],
        properties: {
                  id: { type: "string", pattern: "^plus-\\d+$" },
          phase_name: { type: "string", minLength: 3, maxLength: 80 }
        }
      }
    },
    notes: {
      type: "array",
      items: { type: "string", maxLength: 200 }
            }
          }
        }
      }
    }
  }
} as const;

// Permits Output Schema (Step M)
// Updated to support per-tier permits (each tier has its own permits array)
export const permitsOutputSchema = {
  $id: "https://leo.casa/schemas/permits-output.json",
  type: "object",
  additionalProperties: false,
  required: ["listing_id", "tiers", "generated_at"],
  properties: {
    listing_id: { type: "string", minLength: 1 },
    generated_at: { type: "string", format: "date-time" },
    tiers: {
      type: "object",
      additionalProperties: false,
      required: ["estandar", "optimo", "plus"],
      properties: {
        estandar: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "permits"],
          properties: {
            tier: { const: "estandar" },
            permits: {
              type: "array",
              minItems: 0,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["permit_type", "applies_to_work_ids", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "confidence"],
                properties: {
                  permit_type: { type: "string", minLength: 3, maxLength: 80 },
                  applies_to_work_ids: {
                    type: "array",
                    minItems: 1,
                    uniqueItems: true,
                    items: { type: "string", pattern: "^est-\\d+$" }
                  },
                  why_needed: { type: "string", minLength: 10, maxLength: 600 },
                  what_needed: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string", minLength: 2, maxLength: 120 }
                  },
                  issuing_authority: { type: "string", minLength: 2, maxLength: 120 },
                  expected_time_weeks: { type: "integer", minimum: 0, maximum: 104 },
                  pitfalls: {
                    type: "array",
                    items: { type: "string", maxLength: 140 }
                  },
                  confidence: { enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        },
        optimo: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "permits"],
          properties: {
            tier: { const: "optimo" },
    permits: {
              type: "array",
              minItems: 0,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["permit_type", "applies_to_work_ids", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "confidence"],
                properties: {
                  permit_type: { type: "string", minLength: 3, maxLength: 80 },
                  applies_to_work_ids: {
                    type: "array",
                    minItems: 1,
                    uniqueItems: true,
                    items: { type: "string", pattern: "^opt-\\d+$" }
                  },
                  why_needed: { type: "string", minLength: 10, maxLength: 600 },
                  what_needed: {
      type: "array",
      minItems: 1,
                    items: { type: "string", minLength: 2, maxLength: 120 }
                  },
                  issuing_authority: { type: "string", minLength: 2, maxLength: 120 },
                  expected_time_weeks: { type: "integer", minimum: 0, maximum: 104 },
                  pitfalls: {
                    type: "array",
                    items: { type: "string", maxLength: 140 }
                  },
                  confidence: { enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        },
        plus: {
          type: "object",
          additionalProperties: false,
          required: ["tier", "permits"],
          properties: {
            tier: { const: "plus" },
            permits: {
              type: "array",
              minItems: 0,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["permit_type", "applies_to_work_ids", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "confidence"],
        properties: {
          permit_type: { type: "string", minLength: 3, maxLength: 80 },
          applies_to_work_ids: {
            type: "array",
            minItems: 1,
            uniqueItems: true,
                    items: { type: "string", pattern: "^plus-\\d+$" }
          },
          why_needed: { type: "string", minLength: 10, maxLength: 600 },
          what_needed: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 2, maxLength: 120 }
          },
          issuing_authority: { type: "string", minLength: 2, maxLength: 120 },
          expected_time_weeks: { type: "integer", minimum: 0, maximum: 104 },
          pitfalls: {
            type: "array",
            items: { type: "string", maxLength: 140 }
          },
          confidence: { enum: ["high", "medium", "low"] }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

// Final Renovation Scope Schema (Step N)
export const finalRenovationScopeSchema = {
  $id: "https://leo.casa/schemas/final-renovation-scope.json",
  type: "object",
  additionalProperties: false,
  required: ["listing_id", "generated_at", "tiers", "validation"],
  properties: {
    listing_id: { type: "string", minLength: 1 },
    generated_at: { type: "string", format: "date-time" },
    tiers: {
      type: "object",
      additionalProperties: false,
      required: ["estandar", "optimo", "plus"],
      properties: {
        estandar: {
          type: "object",
          additionalProperties: false,
          required: ["title", "tier_subtitle", "work_items", "total_estimate_range_eur", "timeline", "permits"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            tier_subtitle: { type: "string", minLength: 1, maxLength: 200 },
            work_items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "tier", "name", "photo_refs", "cost_low_eur", "cost_high_eur", "stage"],
                properties: {
                  id: { type: "string", pattern: "^est-\\d+$" },
                  tier: { const: "estandar" },
                  name: { type: "string", minLength: 1 },
                  subtitle: { type: "string" },
                  room_ref: { type: "string" },
                  photo_refs: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string" }
                  },
                  cost_low_eur: { type: "number", minimum: 0, multipleOf: 100 },
                  cost_high_eur: { type: "number", minimum: 0, multipleOf: 100 },
                  stage: { type: "string", minLength: 1 }
                }
              }
            },
            total_estimate_range_eur: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "number", minimum: 0, multipleOf: 1000 }
            },
            timeline: {
              type: "object",
              additionalProperties: false,
              required: ["phases", "total_duration_display"],
              properties: {
                phases: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "subtitle", "start_offset_weeks", "duration_weeks", "display_duration"],
                    properties: {
                      name: { type: "string", minLength: 1 },
                      subtitle: { type: "string" },
                      start_offset_weeks: { type: "integer", minimum: 0 },
                      duration_weeks: { type: "integer", minimum: 0 },
                      display_duration: { type: "string", minLength: 1 }
                    }
                  }
                },
                total_duration_display: { type: "string", minLength: 1 }
              }
            },
            permits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["permit_type", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "applies_to_work_ids"],
                properties: {
                  permit_type: { type: "string", minLength: 1 },
                  why_needed: { type: "string", minLength: 1 },
                  what_needed: {
                    type: "array",
                    items: { type: "string" }
                  },
                  issuing_authority: { type: "string", minLength: 1 },
                  expected_time_weeks: { type: "integer", minimum: 0 },
                  applies_to_work_ids: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        optimo: {
          type: "object",
          additionalProperties: false,
          required: ["title", "tier_subtitle", "work_items", "total_estimate_range_eur", "timeline", "permits"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            tier_subtitle: { type: "string", minLength: 1, maxLength: 200 },
            work_items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "tier", "name", "photo_refs", "cost_low_eur", "cost_high_eur", "stage"],
                properties: {
                  id: { type: "string", pattern: "^opt-\\d+$" },
                  tier: { const: "optimo" },
                  name: { type: "string", minLength: 1 },
                  subtitle: { type: "string" },
                  room_ref: { type: "string" },
                  photo_refs: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string" }
                  },
                  cost_low_eur: { type: "number", minimum: 0, multipleOf: 100 },
                  cost_high_eur: { type: "number", minimum: 0, multipleOf: 100 },
                  stage: { type: "string", minLength: 1 }
                }
              }
            },
            total_estimate_range_eur: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "number", minimum: 0, multipleOf: 1000 }
            },
            timeline: {
              type: "object",
              additionalProperties: false,
              required: ["phases", "total_duration_display"],
              properties: {
                phases: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "subtitle", "start_offset_weeks", "duration_weeks", "display_duration"],
                    properties: {
                      name: { type: "string", minLength: 1 },
                      subtitle: { type: "string" },
                      start_offset_weeks: { type: "integer", minimum: 0 },
                      duration_weeks: { type: "integer", minimum: 0 },
                      display_duration: { type: "string", minLength: 1 }
                    }
                  }
                },
                total_duration_display: { type: "string", minLength: 1 }
              }
            },
            permits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["permit_type", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "applies_to_work_ids"],
                properties: {
                  permit_type: { type: "string", minLength: 1 },
                  why_needed: { type: "string", minLength: 1 },
                  what_needed: {
                    type: "array",
                    items: { type: "string" }
                  },
                  issuing_authority: { type: "string", minLength: 1 },
                  expected_time_weeks: { type: "integer", minimum: 0 },
                  applies_to_work_ids: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        plus: {
          type: "object",
          additionalProperties: false,
          required: ["title", "tier_subtitle", "work_items", "total_estimate_range_eur", "timeline", "permits"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 100 },
            tier_subtitle: { type: "string", minLength: 1, maxLength: 200 },
            work_items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "tier", "name", "photo_refs", "cost_low_eur", "cost_high_eur", "stage"],
                properties: {
                  id: { type: "string", pattern: "^plus-\\d+$" },
                  tier: { const: "plus" },
                  name: { type: "string", minLength: 1 },
                  subtitle: { type: "string" },
                  room_ref: { type: "string" },
                  photo_refs: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string" }
                  },
                  cost_low_eur: { type: "number", minimum: 0, multipleOf: 100 },
                  cost_high_eur: { type: "number", minimum: 0, multipleOf: 100 },
                  stage: { type: "string", minLength: 1 }
                }
              }
            },
            total_estimate_range_eur: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: { type: "number", minimum: 0, multipleOf: 1000 }
            },
            timeline: {
              type: "object",
              additionalProperties: false,
              required: ["phases", "total_duration_display"],
              properties: {
                phases: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "subtitle", "start_offset_weeks", "duration_weeks", "display_duration"],
                    properties: {
                      name: { type: "string", minLength: 1 },
                      subtitle: { type: "string" },
                      start_offset_weeks: { type: "integer", minimum: 0 },
                      duration_weeks: { type: "integer", minimum: 0 },
                      display_duration: { type: "string", minLength: 1 }
                    }
                  }
                },
                total_duration_display: { type: "string", minLength: 1 }
              }
            },
            permits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["permit_type", "why_needed", "what_needed", "issuing_authority", "expected_time_weeks", "applies_to_work_ids"],
                properties: {
                  permit_type: { type: "string", minLength: 1 },
                  why_needed: { type: "string", minLength: 1 },
                  what_needed: {
                    type: "array",
                    items: { type: "string" }
                  },
                  issuing_authority: { type: "string", minLength: 1 },
                  expected_time_weeks: { type: "integer", minimum: 0 },
                  applies_to_work_ids: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["pricing_ids_covered", "timeline_items_mapped", "permit_ids_mapped", "sums_check_passed"],
      properties: {
        pricing_ids_covered: { type: "boolean" },
        timeline_items_mapped: { type: "boolean" },
        permit_ids_mapped: { type: "boolean" },
        sums_check_passed: { type: "boolean" }
      }
    }
  }
} as const;

// Compiled AJV validators (export for use in endpoints)
export const validateScopeSeedOutput = ajv.compile(scopeSeedOutputSchema);
export const validatePricingOutput = ajv.compile(pricingOutputSchema);
export const validateTimelineOutput = ajv.compile(timelineOutputSchema);
export const validatePermitsOutput = ajv.compile(permitsOutputSchema);
export const validateFinalRenovationScope = ajv.compile(finalRenovationScopeSchema);

// Type exports for TypeScript (simplified - full types inferred from schemas)
export type ScopeSeedOutput = {
  listing_id: string;
  generated_at: string;
  tiers: {
    estandar: { title: string; work_items: Array<{
      id: string;
      tier: 'estandar';
      name: string;
      subtitle?: string;
      room_ref?: string;
      photo_refs: string[];
      likely_permit_types_guess?: string[];
      notes_internal?: string;
    }> };
    optimo: { title: string; work_items: Array<{
      id: string;
      tier: 'optimo';
      name: string;
      subtitle?: string;
      room_ref?: string;
      photo_refs: string[];
      likely_permit_types_guess?: string[];
      notes_internal?: string;
    }> };
    plus: { title: string; work_items: Array<{
      id: string;
      tier: 'plus';
      name: string;
      subtitle?: string;
      room_ref?: string;
      photo_refs: string[];
      likely_permit_types_guess?: string[];
      notes_internal?: string;
    }> };
  };
};

export type PricingOutput = {
  listing_id: string;
  generated_at: string;
  rounding_rules: { item: 'nearest_€100'; totals: 'nearest_€1,000' };
  priced_items: Array<{
    id: string;
    tier: 'estandar' | 'optimo' | 'plus';
    cost_low_eur: number;
    cost_high_eur: number;
    cost_basis: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
};

export type TimelineOutput = {
  listing_id: string;
  generated_at: string;
  phases: Array<{
    name: string;
    subtitle: string;
    duration_weeks: number;
  }>;
  item_placement: Array<{
    id: string;
    phase_name: string;
  }>;
  notes?: string[];
};

export type PermitsOutput = {
  listing_id: string;
  generated_at: string;
  permits: Array<{
    permit_type: string;
    applies_to_work_ids: string[];
    why_needed: string;
    what_needed: string[];
    issuing_authority: string;
    expected_time_weeks: number;
    pitfalls?: string[];
    confidence: 'high' | 'medium' | 'low';
  }>;
};

export type FinalRenovationScope = {
  listing_id: string;
  generated_at: string;
  tiers: {
    estandar: {
      title: string;
      tier_subtitle: string;
      work_items: Array<{
        id: string;
        tier: 'estandar';
        name: string;
        subtitle?: string;
        room_ref?: string;
        photo_refs: string[];
        cost_low_eur: number;
        cost_high_eur: number;
        stage: string;
      }>;
      total_estimate_range_eur: [number, number];
      timeline: {
        phases: Array<{
          name: string;
          subtitle: string;
          start_offset_weeks: number;
          duration_weeks: number;
          display_duration: string;
        }>;
        total_duration_display: string;
      };
      permits: Array<{
        permit_type: string;
        why_needed: string;
        what_needed: string[];
        issuing_authority: string;
        expected_time_weeks: number;
        applies_to_work_ids: string[];
      }>;
    };
    optimo: {
      title: string;
      tier_subtitle: string;
      work_items: Array<{
        id: string;
        tier: 'optimo';
        name: string;
        subtitle?: string;
        room_ref?: string;
        photo_refs: string[];
        cost_low_eur: number;
        cost_high_eur: number;
        stage: string;
      }>;
      total_estimate_range_eur: [number, number];
      timeline: {
        phases: Array<{
          name: string;
          subtitle: string;
          start_offset_weeks: number;
          duration_weeks: number;
          display_duration: string;
        }>;
        total_duration_display: string;
      };
      permits: Array<{
        permit_type: string;
        why_needed: string;
        what_needed: string[];
        issuing_authority: string;
        expected_time_weeks: number;
        applies_to_work_ids: string[];
      }>;
    };
    plus: {
      title: string;
      tier_subtitle: string;
      work_items: Array<{
        id: string;
        tier: 'plus';
        name: string;
        subtitle?: string;
        room_ref?: string;
        photo_refs: string[];
        cost_low_eur: number;
        cost_high_eur: number;
        stage: string;
      }>;
      total_estimate_range_eur: [number, number];
      timeline: {
        phases: Array<{
          name: string;
          subtitle: string;
          start_offset_weeks: number;
          duration_weeks: number;
          display_duration: string;
        }>;
        total_duration_display: string;
      };
      permits: Array<{
        permit_type: string;
        why_needed: string;
        what_needed: string[];
        issuing_authority: string;
        expected_time_weeks: number;
        applies_to_work_ids: string[];
      }>;
    };
  };
  validation: {
    pricing_ids_covered: boolean;
    timeline_items_mapped: boolean;
    permit_ids_mapped: boolean;
    sums_check_passed: boolean;
  };
};


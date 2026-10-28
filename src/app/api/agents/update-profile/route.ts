import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";

// Type for extracted profile data
interface ExtractedProfileData {
  budget?: { min?: number; max?: number };
  preferences?: { add?: string[]; remove?: string[] };
  dealbreakers?: { add?: string[]; remove?: string[] };
  tradeoffs?: Record<string, unknown>;
  bedrooms?: { min?: number };
  areas?: { add?: string[]; replace?: string[]; remove?: string[] };
  commute?: { workLocation?: string; maxMinutes?: number };
  newInfo?: {
    familySituation?: string;
    pets?: string;
    remoteWork?: string;
    deliveryPreference?: string;
    email?: string;
    phoneNumber?: string;
    notes?: string;
  };
  flexibility?: {
    budgetMax?: number;
    neighborhoods?: string[];
    commuteExtra?: number;
    bedroomsMin?: number;
    dealbreakersRemoved?: string[];
  };
  intakeComplete?: boolean;
  completedStep?: number;
  whatifComplete?: boolean;
}

/**
 * POST /api/agents/update-profile
 * Update user profile after a conversation with Leo
 * 
 * Accepts two formats:
 * 1. Wrapped format: { conversationId, conversationType, extractedData: {...} }
 * 2. Direct format (from ElevenLabs webhook): { budget_min, budget_max, preferred_areas, ... }
 * 
 * This applies DELTAS to the profile, not full overwrites
 */
export async function POST(request: NextRequest) {
  try {
    // For webhook calls, we may not have auth - check for API key or user
    const user = await getCurrentUser().catch(() => null);
    
    const body = await request.json();
    console.log('[update-profile] Request body:', JSON.stringify(body, null, 2));
    
    // Detect if this is a direct webhook call (has snake_case fields directly)
    const isWebhookFormat = body.budget_min !== undefined || 
                           body.budget_max !== undefined || 
                           body.preferred_areas !== undefined ||
                           body.budgetMin !== undefined ||
                           body.budgetMax !== undefined;
    
    let userId: string;
    let conversationId: string | undefined;
    let conversationType = 'onboarding';
    let extractedData: ExtractedProfileData = {};
    
    if (isWebhookFormat) {
      // Direct webhook format from ElevenLabs
      // We need to get the user ID from a header or the conversation metadata
      // For now, we'll use the user if authenticated, or return error
      if (!user) {
        // Try to get user ID from X-User-Id header (set by client before calling Leo)
        const headerUserId = request.headers.get('X-User-Id');
        if (!headerUserId) {
          console.log('[update-profile] No user auth or X-User-Id header');
          return NextResponse.json({ 
            success: true, 
            message: "Profile data received (no user context)" 
          });
        }
        userId = headerUserId;
      } else {
        userId = user.id;
      }
      
      // Convert webhook format to our internal format
      extractedData = {
        budget: {
          min: body.budget_min || body.budgetMin,
          max: body.budget_max || body.budgetMax,
        },
        areas: body.preferred_areas || body.preferredAreas ? {
          replace: body.preferred_areas || body.preferredAreas
        } : undefined,
        bedrooms: body.bedrooms_min || body.bedroomsMin ? {
          min: body.bedrooms_min || body.bedroomsMin
        } : undefined,
        commute: {
          workLocation: body.work_location || body.workLocation,
          maxMinutes: body.max_commute_minutes || body.maxCommuteMinutes,
        },
        preferences: body.nice_to_haves || body.niceToHaves ? {
          add: body.nice_to_haves || body.niceToHaves
        } : undefined,
        dealbreakers: body.dealbreakers ? {
          add: body.dealbreakers
        } : undefined,
        flexibility: {
          budgetMax: body.flexibility_budget_max || body.flexibilityBudgetMax,
          neighborhoods: body.flexibility_neighborhoods || body.flexibilityNeighborhoods,
          commuteExtra: body.flexibility_commute_extra_mins || body.flexibilityCommuteExtraMins,
        },
        newInfo: {
          familySituation: body.family_situation || body.familySituation,
          pets: body.pets,
          remoteWork: body.remote_work || body.remoteWork,
          deliveryPreference: body.delivery_preference || body.deliveryPreference,
          email: body.email,
          phoneNumber: body.phone_number || body.phoneNumber,
        },
        // Mark intake as complete if we have core data
        intakeComplete: !!(body.budget_max || body.budgetMax) && 
                       !!(body.preferred_areas?.length || body.preferredAreas?.length),
      };
    } else {
      // Wrapped format
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
      conversationId = body.conversationId;
      conversationType = body.conversationType || 'onboarding';
      extractedData = (body.extractedData || {}) as ExtractedProfileData;
    }

    const supabase = await getSupabaseServer();

    // Get existing profile
    const { data: existingProfile } = await supabase
      .from("user_lifestyle_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Build update object based on conversation type and extracted data
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Handle extracted data deltas
    const {
      budget,
      preferences,
      dealbreakers,
      tradeoffs,
      bedrooms,
      areas,
      commute,
      newInfo,
    } = extractedData;

    // Budget updates
    if (budget?.min !== undefined) updates.budget_min = budget.min;
    if (budget?.max !== undefined) updates.budget_max = budget.max;

    // Bedroom updates
    if (bedrooms?.min !== undefined) updates.bedrooms_min = bedrooms.min;

    // Area updates (merge with existing)
    if (areas?.add?.length) {
      const existingAreas = existingProfile?.preferred_areas || [];
      updates.preferred_areas = [...new Set([...existingAreas, ...areas.add])];
    }
    if (areas?.replace) {
      updates.preferred_areas = areas.replace;
    }

    // Commute updates
    if (commute?.workLocation) updates.work_location = commute.workLocation;
    if (commute?.maxMinutes !== undefined) updates.max_commute_minutes = commute.maxMinutes;

    // Update property_constraints (merge)
    if (preferences || dealbreakers) {
      const existingConstraints = existingProfile?.property_constraints || {};
      const updatedConstraints = { ...existingConstraints };

      if (preferences?.add?.length) {
        updatedConstraints.preferences = [
          ...(existingConstraints.preferences || []),
          ...preferences.add,
        ];
      }
      if (dealbreakers?.add?.length) {
        updatedConstraints.dealbreakers = [
          ...(existingConstraints.dealbreakers || []),
          ...dealbreakers.add,
        ];
      }
      if (dealbreakers?.remove?.length) {
        updatedConstraints.dealbreakers = (existingConstraints.dealbreakers || [])
          .filter((d: string) => !dealbreakers.remove!.includes(d));
      }

      updates.property_constraints = updatedConstraints;
    }

    // Update tradeoffs
    if (tradeoffs) {
      const existingTradeoffs = existingProfile?.trade_off_matrix || {};
      updates.trade_off_matrix = { ...existingTradeoffs, ...tradeoffs };
    }

    // Handle conversation type specific updates
    if (conversationType === 'onboarding') {
      // Increment intake step if provided
      if (extractedData.completedStep !== undefined) {
        updates.intake_step = Math.max(
          existingProfile?.intake_step || 0,
          extractedData.completedStep
        );
      }
      // Mark as complete if all core questions done
      if (extractedData.intakeComplete) {
        updates.intake_completed = true;
        updates.intake_completed_at = new Date().toISOString();
      }
    } else if (conversationType === 'whatifs') {
      // Mark whatifs as complete
      if (extractedData.whatifComplete) {
        updates.whatifs_completed = true;
      }
      // Store flexibility data
      if (extractedData.flexibility) {
        if (extractedData.flexibility.budgetMax) {
          updates.flexibility_budget_max = extractedData.flexibility.budgetMax;
        }
        if (extractedData.flexibility.commuteExtra) {
          updates.flexibility_commute_extra_mins = extractedData.flexibility.commuteExtra;
        }
        if (extractedData.flexibility.neighborhoods) {
          updates.flexibility_neighborhoods = extractedData.flexibility.neighborhoods;
        }
        if (extractedData.flexibility.bedroomsMin) {
          updates.flexibility_bedrooms_min = extractedData.flexibility.bedroomsMin;
        }
        if (extractedData.flexibility.dealbreakersRemoved) {
          updates.flexibility_dealbreakers_removed = extractedData.flexibility.dealbreakersRemoved;
        }
      }
    } else if (conversationType === 'followup') {
      // Increment followup count
      updates.followup_count = (existingProfile?.followup_count || 0) + 1;
      updates.last_followup_at = new Date().toISOString();
    }

    // Store conversation ID if provided
    if (conversationId) {
      updates.voice_conversation_id = conversationId;
    }

    // Store any new lifestyle notes
    if (newInfo?.notes) {
      const existingNotes = existingProfile?.lifestyle_notes || '';
      updates.lifestyle_notes = existingNotes 
        ? `${existingNotes}\n\n[${new Date().toLocaleDateString('es-ES')}]: ${newInfo.notes}`
        : newInfo.notes;
    }
    
    // Handle additional info from webhook format
    if (newInfo?.deliveryPreference) {
      updates.delivery_preference = newInfo.deliveryPreference;
    }
    if (newInfo?.email) {
      updates.email = newInfo.email;
    }
    if (newInfo?.phoneNumber) {
      updates.phone_number = newInfo.phoneNumber;
    }

    // Upsert the profile
    const { data: updatedProfile, error } = await supabase
      .from("user_lifestyle_profiles")
      .upsert(
        {
          user_id: userId,
          session_id: existingProfile?.session_id || crypto.randomUUID(),
          ...updates,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    // Create preference signals from extracted data
    if (preferences?.add?.length || dealbreakers?.add?.length) {
      const signals = [];

      if (preferences?.add?.length) {
        for (const pref of preferences.add) {
          signals.push({
            user_id: userId,
            source_type: conversationType === 'followup' ? 'followup_call' : 'onboarding',
            source_id: conversationId || null,
            signal_type: 'like',
            category: categorizePreference(pref),
            description: pref,
            confidence: 0.9,
          });
        }
      }

      if (dealbreakers?.add?.length) {
        for (const db of dealbreakers.add) {
          signals.push({
            user_id: userId,
            source_type: conversationType === 'followup' ? 'followup_call' : 'onboarding',
            source_id: conversationId || null,
            signal_type: 'dealbreaker',
            category: categorizePreference(db),
            description: db,
            confidence: 0.95,
          });
        }
      }

      if (signals.length > 0) {
        await supabase.from("user_preference_signals").insert(signals);
      }
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      conversationType,
    });

  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Simple categorization of preferences for preference signals
 */
function categorizePreference(pref: string): string {
  const lower = pref.toLowerCase();
  
  if (lower.includes('balcon') || lower.includes('terraza') || lower.includes('balcony') || lower.includes('terrace')) {
    return 'outdoor_space';
  }
  if (lower.includes('cocina') || lower.includes('kitchen')) {
    return 'kitchen';
  }
  if (lower.includes('baño') || lower.includes('bath')) {
    return 'bathroom';
  }
  if (lower.includes('luz') || lower.includes('light') || lower.includes('exterior')) {
    return 'light';
  }
  if (lower.includes('zona') || lower.includes('barrio') || lower.includes('location') || lower.includes('area')) {
    return 'location';
  }
  if (lower.includes('transporte') || lower.includes('metro') || lower.includes('transport')) {
    return 'transport';
  }
  if (lower.includes('habitación') || lower.includes('bedroom') || lower.includes('dormitorio')) {
    return 'bedrooms';
  }
  if (lower.includes('ascensor') || lower.includes('elevator')) {
    return 'accessibility';
  }
  if (lower.includes('parking') || lower.includes('garaje') || lower.includes('garage')) {
    return 'parking';
  }
  if (lower.includes('piscina') || lower.includes('pool')) {
    return 'amenities';
  }
  if (lower.includes('suelo') || lower.includes('floor')) {
    return 'flooring';
  }
  if (lower.includes('ruido') || lower.includes('noise') || lower.includes('tranquil')) {
    return 'noise';
  }
  
  return 'other';
}


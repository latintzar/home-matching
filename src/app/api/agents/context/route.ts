import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * POST /api/agents/context
 * Get profile context for an ElevenLabs agent conversation
 * 
 * Request: { conversationType: 'onboarding' | 'whatifs' | 'followup', profileType?: 'renter' | 'buyer' }
 * Response: { context: string, metadata: object, profileType: string, agentId: string }
 */

// Profile-specific agent IDs
const AGENT_IDS = {
  renter: {
    intake: (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''), // leo-intake-renter (v2)
    whatifs: (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''), // TODO: leo-whatifs-renter
    followup: (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''), // leo-followup
  },
  buyer: {
    intake: (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''), // TODO: Update with leo-intake-buyer ID
    whatifs: (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''), // TODO: leo-whatifs-buyer
    followup: (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''), // leo-followup
  },
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationType = 'onboarding', profileType: requestedProfileType } = body;

    const supabase = await getSupabaseServer();

    // Get user's active profile type if not specified
    let profileType: 'renter' | 'buyer' = 'renter';
    if (requestedProfileType) {
      profileType = requestedProfileType;
    } else {
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("active_profile_type")
        .eq("id", user.id)
        .single();
      profileType = (userProfile?.active_profile_type as 'renter' | 'buyer') || 'renter';
    }

    // Get the user's lifestyle profile for the specified profile type
    const { data: profile } = await supabase
      .from("user_lifestyle_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("profile_type", profileType)
      .single();

    // Get recent activity (saved properties, viewings) for this profile type
    const { data: savedProperties } = await supabase
      .from("saved_properties")
      .select("listing_id")
      .eq("user_id", user.id)
      .eq("profile_type", profileType)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get recent notes for this profile type
    const { data: recentNotes } = await supabase
      .from("property_notes")
      .select("content, created_at")
      .eq("user_id", user.id)
      .eq("profile_type", profileType)
      .order("created_at", { ascending: false })
      .limit(5);
    
    // Determine agent ID based on profile type and conversation type
    const agentIds = AGENT_IDS[profileType];
    let agentId: string;
    switch (conversationType) {
      case 'whatifs':
        agentId = agentIds.whatifs;
        break;
      case 'followup':
        agentId = agentIds.followup;
        break;
      default:
        agentId = agentIds.intake;
    }
    
    // Add profile type context to all responses
    const profileTypeLabel = profileType === 'renter' ? 'alquilar' : 'comprar';

    // Build context based on conversation type
    let context = "";
    let metadata: Record<string, unknown> = {};

    if (conversationType === 'onboarding') {
      // For onboarding, provide minimal context - just basic profile if exists
      if (profile) {
        context = `El usuario está volviendo a continuar su onboarding para ${profileTypeLabel}. Paso actual: ${profile.intake_step || 0}/6.`;
        if (profile.budget_min || profile.budget_max) {
          context += ` Presupuesto mencionado: €${profile.budget_min || '?'} - €${profile.budget_max || '?'}.`;
        }
        if (profile.preferred_areas?.length) {
          context += ` Zonas de interés: ${profile.preferred_areas.join(', ')}.`;
        }
      } else {
        context = `Usuario nuevo, primera conversación para ${profileTypeLabel}.`;
      }
      metadata = {
        isReturning: !!profile,
        currentStep: profile?.intake_step || 0,
        profileType,
      };

    } else if (conversationType === 'whatifs') {
      // For whatifs, provide the full profile to explore tradeoffs
      if (!profile) {
        return NextResponse.json(
          { error: "No profile found. Complete onboarding first." },
          { status: 400 }
        );
      }

      const constraints = profile.property_constraints || {};
      const dna = profile.lifestyle_dna || {};

      context = `Usuario con perfil completo. `;
      context += `Presupuesto: €${profile.budget_min || '?'} - €${profile.budget_max || '?'}. `;
      context += `Habitaciones mínimas: ${profile.bedrooms_min || '?'}. `;
      if (profile.preferred_areas?.length) {
        context += `Zonas preferidas: ${profile.preferred_areas.join(', ')}. `;
      }
      if (profile.work_location) {
        context += `Trabajo: ${profile.work_location}, máximo ${profile.max_commute_minutes || '?'} min. `;
      }
      if (constraints.dealbreakers?.length) {
        context += `Dealbreakers actuales: ${constraints.dealbreakers.join(', ')}. `;
      }

      metadata = {
        profile: {
          budget: { min: profile.budget_min, max: profile.budget_max },
          bedrooms: profile.bedrooms_min,
          areas: profile.preferred_areas,
          commute: profile.max_commute_minutes,
          dealbreakers: constraints.dealbreakers,
        },
      };

    } else if (conversationType === 'followup') {
      // For followup, provide full context including activity
      if (!profile) {
        return NextResponse.json(
          { error: "No profile found. Complete onboarding first." },
          { status: 400 }
        );
      }

      context = `Conversación de seguimiento #${(profile.followup_count || 0) + 1}. `;
      context += `Última conversación: ${profile.last_followup_at ? new Date(profile.last_followup_at).toLocaleDateString('es-ES') : 'nunca'}. `;
      context += `Propiedades guardadas: ${savedProperties?.length || 0}. `;
      
      if (recentNotes?.length) {
        context += `Notas recientes del usuario: `;
        recentNotes.slice(0, 3).forEach((note) => {
          context += `"${note.content?.slice(0, 100)}..." `;
        });
      }

      const constraints = profile.property_constraints || {};
      context += `Perfil actual: €${profile.budget_min || '?'}-€${profile.budget_max || '?'}, `;
      context += `${profile.bedrooms_min || '?'}+ habs, `;
      if (profile.preferred_areas?.length) {
        context += `zonas: ${profile.preferred_areas.join(', ')}.`;
      }

      metadata = {
        followupCount: profile.followup_count || 0,
        lastFollowup: profile.last_followup_at,
        savedCount: savedProperties?.length || 0,
        recentNotes: recentNotes?.map(n => n.content?.slice(0, 50)) || [],
      };
    }

    return NextResponse.json({
      success: true,
      context,
      metadata,
      conversationType,
      profileType,
      agentId,
    });

  } catch (error) {
    console.error("Agent context error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


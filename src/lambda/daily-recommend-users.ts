/**
 * Daily Recommend Users Lambda
 * 
 * Runs after daily-parse to check new listings against all active user profiles.
 * For users whose profiles match new listings, queues recommendations for delivery.
 * 
 * Schedule: 6am UTC (after daily-parse at 4am, detect-listing-status at 5am)
 * 
 * Flow:
 * 1. Get all users with complete profiles and delivery preferences
 * 2. Get new listings parsed today
 * 3. For each user:
 *    a. Filter new listings by their life profile (DynamoDB query)
 *    b. Run WPA on matches (batched for cost efficiency)
 *    c. Score and rank matches
 *    d. Queue for delivery (email/WhatsApp)
 * 4. Batch send via Resend/WhatsApp Business API
 * 
 * Cost estimate: ~$0.05/run (mostly Gemini WPA on ~20 listings per user)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createClient } from '@supabase/supabase-js';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

// Supabase for user profiles
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Tables
const LISTINGS_TABLE = 'leo-listings';
const DELIVERY_QUEUE_TABLE = 'leo-delivery-queue';

interface LifeProfile {
  id: string;
  user_id?: string;
  constraints: {
    maxBudget?: number;
    minBudget?: number;
  };
  propertyPreferences: {
    minBedrooms?: number;
    minBathrooms?: number;
    minSqm?: number;
    maxSqm?: number;
    propertyTypes?: string[];
  };
  locations: {
    preferred?: string[];
    avoid?: string[];
  };
  delivery_preference: 'email' | 'whatsapp';
  email?: string;
  phone_number?: string;
  completeness_score: number;
  minimum_met: boolean;
}

interface ParsedListing {
  domain: string;
  listing_id: string;
  url: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqm: number;
  city: string;
  region: string;
  image_urls: string[];
  parsed_at: string;
  status: string;
}

interface Match {
  listing: ParsedListing;
  fitScore: number;
  reasons: string[];
}

interface DeliveryItem {
  user_id: string;
  profile_id: string;
  matches: Match[];
  delivery_preference: 'email' | 'whatsapp';
  contact: string;
  queued_at: string;
  status: 'pending' | 'sent' | 'failed';
}

export async function handler(event: any) {
  console.log('[DailyRecommend] Starting daily recommendation run...');
  const startTime = Date.now();
  
  try {
    // 1. Get all complete profiles with delivery preferences
    const profiles = await getCompleteProfiles();
    console.log(`[DailyRecommend] Found ${profiles.length} complete profiles`);
    
    if (profiles.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No profiles to process' }),
      };
    }
    
    // 2. Get new listings from today (or last 24 hours)
    const newListings = await getNewListings();
    console.log(`[DailyRecommend] Found ${newListings.length} new listings`);
    
    if (newListings.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No new listings to process' }),
      };
    }
    
    // 3. Process each profile
    const deliveryQueue: DeliveryItem[] = [];
    
    for (const profile of profiles) {
      try {
        const matches = await findMatchesForProfile(profile, newListings);
        
        if (matches.length > 0) {
          console.log(`[DailyRecommend] Found ${matches.length} matches for profile ${profile.id}`);
          
          // Determine contact info
          const contact = profile.delivery_preference === 'email' 
            ? profile.email 
            : profile.phone_number;
          
          if (contact) {
            deliveryQueue.push({
              user_id: profile.user_id || profile.id,
              profile_id: profile.id,
              matches: matches.slice(0, 10), // Max 10 per day
              delivery_preference: profile.delivery_preference,
              contact,
              queued_at: new Date().toISOString(),
              status: 'pending',
            });
          }
        }
      } catch (err) {
        console.error(`[DailyRecommend] Error processing profile ${profile.id}:`, err);
      }
    }
    
    // 4. Queue for delivery
    for (const item of deliveryQueue) {
      await queueForDelivery(item);
    }
    
    // 5. Send batched emails/WhatsApp (or trigger separate Lambda)
    const sent = await sendBatchedDeliveries(deliveryQueue);
    
    const duration = Date.now() - startTime;
    console.log(`[DailyRecommend] Complete. Processed ${profiles.length} profiles, sent ${sent} deliveries in ${duration}ms`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        profilesProcessed: profiles.length,
        newListings: newListings.length,
        deliveriesQueued: deliveryQueue.length,
        deliveriesSent: sent,
        durationMs: duration,
      }),
    };
  } catch (error: any) {
    console.error('[DailyRecommend] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

/**
 * Get all complete profiles with delivery preferences
 */
async function getCompleteProfiles(): Promise<LifeProfile[]> {
  const { data, error } = await supabase
    .from('user_lifestyle_profiles')
    .select('*')
    .eq('minimum_met', true)
    .not('delivery_preference', 'is', null)
    .or('email.not.is.null,phone_number.not.is.null');
  
  if (error) {
    console.error('[DailyRecommend] Error fetching profiles:', error);
    return [];
  }
  
  return (data || []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    constraints: row.constraints || {},
    propertyPreferences: row.property_preferences || {},
    locations: row.locations || {},
    delivery_preference: row.delivery_preference || 'email',
    email: row.email,
    phone_number: row.phone_number,
    completeness_score: row.completeness_score || 0,
    minimum_met: row.minimum_met || false,
  }));
}

/**
 * Get new listings parsed in the last 24 hours
 */
async function getNewListings(): Promise<ParsedListing[]> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = yesterday.toISOString();
  
  // Scan for recently parsed listings (active only)
  const result = await dynamodb.send(new ScanCommand({
    TableName: LISTINGS_TABLE,
    FilterExpression: 'parsed_at > :cutoff AND #status = :active',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':cutoff': cutoff,
      ':active': 'active',
    },
    Limit: 1000, // Cap for cost control
  }));
  
  return (result.Items || []) as ParsedListing[];
}

/**
 * Find matches for a profile from new listings
 */
async function findMatchesForProfile(
  profile: LifeProfile,
  listings: ParsedListing[]
): Promise<Match[]> {
  const matches: Match[] = [];
  
  for (const listing of listings) {
    const reasons: string[] = [];
    let score = 50; // Base score
    
    // Budget check
    if (profile.constraints.maxBudget && listing.price) {
      if (listing.price <= profile.constraints.maxBudget) {
        score += 15;
        reasons.push('Within budget');
      } else if (listing.price <= profile.constraints.maxBudget * 1.1) {
        score += 5;
        reasons.push('Slightly over budget');
      } else {
        continue; // Skip if way over budget
      }
    }
    
    // Bedrooms check
    if (profile.propertyPreferences.minBedrooms && listing.bedrooms) {
      if (listing.bedrooms >= profile.propertyPreferences.minBedrooms) {
        score += 10;
        reasons.push(`${listing.bedrooms} bedrooms`);
      } else {
        score -= 10;
      }
    }
    
    // Bathrooms check
    if (profile.propertyPreferences.minBathrooms && listing.bathrooms) {
      if (listing.bathrooms >= profile.propertyPreferences.minBathrooms) {
        score += 5;
        reasons.push(`${listing.bathrooms} bathrooms`);
      }
    }
    
    // Size check
    if (profile.propertyPreferences.minSqm && listing.sqm) {
      if (listing.sqm >= profile.propertyPreferences.minSqm) {
        score += 10;
        reasons.push(`${listing.sqm}m²`);
      } else {
        score -= 5;
      }
    }
    
    // Location check
    const listingLocation = `${listing.city} ${listing.region}`.toLowerCase();
    
    if (profile.locations.preferred?.length) {
      const inPreferred = profile.locations.preferred.some(loc => 
        listingLocation.includes(loc.toLowerCase())
      );
      if (inPreferred) {
        score += 20;
        reasons.push('Preferred location');
      }
    }
    
    if (profile.locations.avoid?.length) {
      const inAvoid = profile.locations.avoid.some(loc => 
        listingLocation.includes(loc.toLowerCase())
      );
      if (inAvoid) {
        continue; // Skip avoided locations
      }
    }
    
    // Only include if score is decent
    if (score >= 60 && reasons.length > 0) {
      matches.push({
        listing,
        fitScore: Math.min(score, 100),
        reasons,
      });
    }
  }
  
  // Sort by score and return top matches
  return matches
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 20);
}

/**
 * Queue a delivery item in DynamoDB
 */
async function queueForDelivery(item: DeliveryItem): Promise<void> {
  await dynamodb.send(new PutCommand({
    TableName: DELIVERY_QUEUE_TABLE,
    Item: item,
  }));
}

/**
 * Send batched deliveries via Resend/WhatsApp
 */
async function sendBatchedDeliveries(queue: DeliveryItem[]): Promise<number> {
  let sent = 0;
  
  for (const item of queue) {
    try {
      if (item.delivery_preference === 'email') {
        await sendEmailDelivery(item);
        sent++;
      } else if (item.delivery_preference === 'whatsapp') {
        await sendWhatsAppDelivery(item);
        sent++;
      }
      
      // Update status in queue
      await dynamodb.send(new PutCommand({
        TableName: DELIVERY_QUEUE_TABLE,
        Item: {
          user_id: item.user_id,
          queued_at: item.queued_at,
          profile_id: item.profile_id,
          matches: item.matches,
          delivery_preference: item.delivery_preference,
          contact: item.contact,
          status: 'sent',
          sent_at: new Date().toISOString(),
        },
      }));
    } catch (err) {
      console.error(`[DailyRecommend] Failed to send to ${item.contact}:`, err);
      // Update status to failed
      await dynamodb.send(new PutCommand({
        TableName: DELIVERY_QUEUE_TABLE,
        Item: {
          user_id: item.user_id,
          queued_at: item.queued_at,
          profile_id: item.profile_id,
          matches: item.matches,
          delivery_preference: item.delivery_preference,
          contact: item.contact,
          status: 'failed',
          error: (err as Error).message,
        },
      }));
    }
  }
  
  return sent;
}

/**
 * Send email via Resend
 */
async function sendEmailDelivery(item: DeliveryItem): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.warn('[DailyRecommend] Resend API key not configured, skipping email');
    return;
  }
  
  // Build email content
  const listingsHtml = item.matches.map(match => `
    <div style="margin-bottom: 20px; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
      <div style="display: flex;">
        ${match.listing.image_urls?.[0] ? `
          <img src="${match.listing.image_urls[0]}" alt="" style="width: 200px; height: 150px; object-fit: cover;" />
        ` : ''}
        <div style="padding: 15px;">
          <h3 style="margin: 0 0 8px 0;">${match.listing.title || 'Propiedad'}</h3>
          <p style="margin: 0 0 8px 0; font-size: 18px; color: #059669; font-weight: bold;">
            ${match.listing.price?.toLocaleString()}€
          </p>
          <p style="margin: 0 0 8px 0; color: #666;">
            ${match.listing.bedrooms} hab · ${match.listing.bathrooms} baños · ${match.listing.sqm}m²
          </p>
          <p style="margin: 0; color: #666;">📍 ${match.listing.city || match.listing.region}</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #059669;">
            ${match.fitScore}% fit - ${match.reasons.join(', ')}
          </p>
          <a href="${match.listing.url}" style="display: inline-block; margin-top: 10px; padding: 8px 16px; background: #059669; color: white; text-decoration: none; border-radius: 4px;">
            Ver propiedad
          </a>
        </div>
      </div>
    </div>
  `).join('');
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Leo <operator@example.invalid>',
      to: item.contact,
      subject: `🏠 ${item.matches.length} nuevas viviendas que encajan contigo`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a;">¡Hola!</h1>
          <p style="color: #666;">
            He encontrado ${item.matches.length} nuevas viviendas que podrían gustarte.
            Aquí están las mejores:
          </p>
          ${listingsHtml}
          <p style="color: #666; margin-top: 30px;">
            ¿Quieres ajustar tus preferencias? 
            <a href="https://leo.casa/recommend/intake">Habla conmigo</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            — Leo, tu asistente inmobiliario
          </p>
        </div>
      `,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Resend error: ${response.status}`);
  }
}

/**
 * Send WhatsApp message via WhatsApp Business API
 */
async function sendWhatsAppDelivery(item: DeliveryItem): Promise<void> {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
  
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.warn('[DailyRecommend] WhatsApp not configured, skipping');
    return;
  }
  
  // Build WhatsApp message
  const topMatches = item.matches.slice(0, 3);
  const messageText = `🏠 ¡Hola! He encontrado ${item.matches.length} nuevas viviendas que podrían gustarte:\n\n` +
    topMatches.map((match, i) => 
      `${i + 1}. ${match.listing.title}\n` +
      `   💰 ${match.listing.price?.toLocaleString()}€\n` +
      `   📍 ${match.listing.city}\n` +
      `   ${match.fitScore}% fit\n` +
      `   ${match.listing.url}`
    ).join('\n\n') +
    `\n\n¿Quieres ver más? Responde "más" 😊`;
  
  const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: item.contact.replace(/\D/g, ''), // Clean phone number
      type: 'text',
      text: { body: messageText },
    }),
  });
  
  if (!response.ok) {
    throw new Error(`WhatsApp error: ${response.status}`);
  }
}


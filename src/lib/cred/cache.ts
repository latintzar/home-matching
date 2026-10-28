/**
 * Domain Credibility Cache Functions
 * 
 * Handles caching of domain credibility scores in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { Credibility } from './scoreDomain';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface CacheEntry {
  domain: string;
  etld1: string;
  source_url?: string;
  credibility: Credibility;
  method: 'deterministic' | 'heuristic' | 'gemini_fallback';
  matched_signals: string[];
  ttl_sec?: number;
}

export interface CachedRecord {
  id: string;
  domain: string;
  etld1: string;
  source_url: string | null;
  credibility: Credibility;
  method: string;
  matched_signals: string[];
  first_seen_at: string;
  last_seen_at: string;
  ttl_sec: number;
  expires_at: string;
  notes: string | null;
  version: number;
}

/**
 * Get cached credibility for a domain
 */
export async function getCacheByDomain(domain: string): Promise<CachedRecord | null> {
  const { data, error } = await supabase
    .from('domain_credibility_cache')
    .select('*')
    .eq('domain', domain.toLowerCase())
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching cache:', error);
    return null;
  }

  if (!data) return null;

  // Check if expired
  const expires = new Date(data.expires_at);
  if (expires < new Date()) {
    return null;
  }

  return data as CachedRecord;
}

/**
 * Upsert domain credibility to cache
 * Returns false on error (non-blocking for RLS issues)
 */
export async function upsertCache(entry: CacheEntry): Promise<boolean> {
  const now = new Date();
  const ttlSec = entry.ttl_sec || 7776000; // 90 days default
  const expiresAt = new Date(now.getTime() + ttlSec * 1000);
  
  const { error } = await supabase
    .from('domain_credibility_cache')
    .upsert({
      domain: entry.domain.toLowerCase(),
      etld1: entry.etld1,
      source_url: entry.source_url,
      credibility: entry.credibility,
      method: entry.method,
      matched_signals: entry.matched_signals,
      ttl_sec: ttlSec,
      expires_at: expiresAt.toISOString(),
      version: 1,
      last_seen_at: now.toISOString()
    }, {
      onConflict: 'domain'
    });

  if (error) {
    console.error('Error upserting cache:', error);
    // Don't throw - allow endpoint to continue even if cache fails
    return false;
  }
  
  return true;
}

/**
 * Batch upsert multiple domains
 */
export async function batchUpsertCache(entries: CacheEntry[]): Promise<void> {
  const now = new Date().toISOString();
  
  const cacheData = entries.map(entry => ({
    domain: entry.domain.toLowerCase(),
    etld1: entry.etld1,
    source_url: entry.source_url,
    credibility: entry.credibility,
    method: entry.method,
    matched_signals: entry.matched_signals,
    ttl_sec: entry.ttl_sec || 7776000,
    version: 1,
    last_seen_at: now
  }));

  const { error } = await supabase
    .from('domain_credibility_cache')
    .upsert(cacheData, {
      onConflict: 'domain',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error batch upserting cache:', error);
    throw error;
  }
}

/**
 * Clean expired entries from cache
 */
export async function cleanExpiredCache(): Promise<number> {
  const { data, error } = await supabase
    .from('domain_credibility_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Error cleaning expired cache:', error);
    return 0;
  }

  return data?.length || 0;
}


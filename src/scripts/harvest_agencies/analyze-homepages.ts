
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as cheerio from 'cheerio';

// --- Configuration ---
const STATUS_CSV = 'data/agency_homepages_status.csv';
const OUTPUT_CSV = 'data/agencies_analyzed.csv';
const BATCH_SIZE = 50;

// --- Interfaces ---
interface StatusRecord {
  domain: string;
  url: string;
  status: string;
  filepath: string;
}

interface AnalysisResult {
  domain: string;
  url: string;
  title: string;
  description: string;
  email: string;
  phone: string;
  keywordsFound: string;
  isLikelyAgency: boolean; // Based on keywords
  socialLinks: string;
  poweredBy: string; // Detect if it's a template (e.g. "Inmoweb", "HabitatSoft")
}

// --- Keywords for Validation ---
const AGENCY_KEYWORDS = [
  'inmobiliaria', 'real estate', 'agencia', 'venta', 'alquiler', 
  'buy', 'rent', 'property', 'properties', 'pisos', 'casas', 
  'estate agent', 'vivienda', 'promoción'
];

const PLATFORM_SIGNATURES = [
  { name: 'Inmoweb', selector: 'a[href*="inmoweb"]' },
  { name: 'HabitatSoft', selector: 'a[href*="habitatsoft"]' },
  { name: 'Witei', selector: 'a[href*="witei"]' },
  { name: 'Mobilia', selector: 'a[href*="mobilia"]' },
  { name: 'Inmovilla', selector: 'a[href*="inmovilla"]' }
];

// --- Main Script ---
async function main() {
  console.log('🕵️ Starting Homepage Analysis...');

  if (!fs.existsSync(STATUS_CSV)) {
    console.error(`❌ Status file not found: ${STATUS_CSV}`);
    process.exit(1);
  }

  // 1. Load Status Records
  const inputContent = fs.readFileSync(STATUS_CSV, 'utf-8');
  // Relaxed parsing for the status file in case of weird chars
  const records: StatusRecord[] = parse(inputContent, { 
    columns: true, 
    skip_empty_lines: true, 
    relax_quotes: true 
  });

  // 2. Filter for Success
  const successRecords = records.filter(r => r.status === 'success' && r.filepath && fs.existsSync(r.filepath));
  console.log(`📊 Found ${successRecords.length} successfully downloaded pages to analyze.`);

  // 3. Prepare Output
  const csvHeaders = ['domain', 'url', 'title', 'description', 'email', 'phone', 'isLikelyAgency', 'keywordsFound', 'socialLinks', 'poweredBy'];
  fs.writeFileSync(OUTPUT_CSV, csvHeaders.join(',') + '\n');

  let processedCount = 0;
  const total = successRecords.length;

  // 4. Process
  const results: AnalysisResult[] = [];
  
  for (const record of successRecords) {
    try {
      const html = fs.readFileSync(record.filepath, 'utf-8');
      const $ = cheerio.load(html);
      
      // -- Extraction Logic --

      // Meta Data
      const title = $('title').text().trim().replace(/\n/g, ' ').substring(0, 200);
      const description = $('meta[name="description"]').attr('content')?.trim().replace(/\n/g, ' ') || 
                          $('meta[property="og:description"]').attr('content')?.trim().replace(/\n/g, ' ') || '';

      // Text Content for Keyword Search (limit length for perf)
      const bodyText = $('body').text().toLowerCase().replace(/\s+/g, ' ').substring(0, 10000);
      
      // Keywords
      const foundKeywords = AGENCY_KEYWORDS.filter(k => bodyText.includes(k));
      const isLikelyAgency = foundKeywords.length >= 2; // Arbitrary threshold

      // Contacts
      const emails = new Set<string>();
      // Mailto links
      $('a[href^="mailto:"]').each((_, el) => {
        const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim();
        if (email && email.includes('@')) emails.add(email);
      });
      // Regex in text (basic)
      const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
      const textEmails = bodyText.match(emailRegex);
      if (textEmails) textEmails.forEach(e => emails.add(e));

      // Phones
      const phones = new Set<string>();
      // Tel links
      $('a[href^="tel:"]').each((_, el) => {
        const phone = $(el).attr('href')?.replace('tel:', '').trim();
        if (phone) phones.add(phone);
      });
      // Basic Spanish phone regex looking for 9 digits starting with 6, 7, 8, 9
      const phoneRegex = /(?:\+34|0034)?[ -]*(?:6|7|8|9)[0-9]{2}[ -]*[0-9]{3}[ -]*[0-9]{3}/g;
      const textPhones = bodyText.match(phoneRegex);
      if (textPhones) textPhones.forEach(p => phones.add(p.replace(/[^0-9+]/g, '')));

      // Socials
      const socials: string[] = [];
      if ($('a[href*="facebook.com"]').length) socials.push('Facebook');
      if ($('a[href*="instagram.com"]').length) socials.push('Instagram');
      if ($('a[href*="linkedin.com"]').length) socials.push('LinkedIn');

      // Platform Detection
      let poweredBy = '';
      for (const p of PLATFORM_SIGNATURES) {
        if ($(p.selector).length) {
          poweredBy = p.name;
          break;
        }
      }

      const result: AnalysisResult = {
        domain: record.domain,
        url: record.url,
        title,
        description: description.substring(0, 200),
        email: Array.from(emails).join('; '),
        phone: Array.from(phones).slice(0, 3).join('; '), // Limit to 3
        keywordsFound: foundKeywords.slice(0, 5).join(', '),
        isLikelyAgency,
        socialLinks: socials.join(', '),
        poweredBy
      };

      // Write immediately
      const csvLine = stringify([[
        result.domain,
        result.url,
        result.title,
        result.description,
        result.email,
        result.phone,
        result.isLikelyAgency ? 'YES' : 'NO',
        result.keywordsFound,
        result.socialLinks,
        result.poweredBy
      ]]);
      
      fs.appendFileSync(OUTPUT_CSV, csvLine);
      processedCount++;

      if (processedCount % 100 === 0) {
        console.log(`✅ Analyzed ${processedCount}/${total}`);
      }

    } catch (err) {
      // console.warn(`⚠️ Error analyzing ${record.domain}:`, err);
      // Skip silently or log to a debug file if needed
    }
  }

  console.log(`🏁 Analysis Complete! Results saved to ${OUTPUT_CSV}`);
}

main().catch(console.error);


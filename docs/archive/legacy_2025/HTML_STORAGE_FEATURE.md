# Full HTML Storage Feature

**Created:** 2024-01-27  
**Purpose:** Document the full HTML storage capability in the robust scraper

## Overview

The robust scraper now stores the complete HTML content from Idealista pages in the `scraped_data.full_html` field, providing complete control and debugging capabilities.

## Implementation

### Database Storage
- **Table**: `listings`
- **Field**: `scraped_data.full_html` (JSONB)
- **Size**: ~584KB per listing (varies by page complexity)
- **Format**: Raw HTML string

### Data Structure
```json
{
  "scraped_data": {
    "areas": {...},
    "physical_features": [...],
    "photos": [...],
    "full_html": "<html>...</html>",     // Complete HTML content
    "html_length": 584082,               // Character count
    "scraped_at": "2025-10-26T15:36:57.905Z"  // ISO timestamp
  }
}
```

## Benefits

### 1. Complete Control
- Access to entire page content for re-processing
- No dependency on original page availability
- Full data integrity preservation

### 2. Debugging & Development
- Inspect any part of the HTML for extraction issues
- Test new extraction logic without re-scraping
- Validate extraction accuracy against source

### 3. Future-Proofing
- Extract additional data fields without re-scraping
- Handle page structure changes gracefully
- Build offline processing capabilities

### 4. Data Validation
- Compare extracted data against original source
- Verify photo URLs and metadata accuracy
- Audit extraction completeness

## Usage Examples

### Query HTML Content
```sql
-- Get HTML length for all listings
SELECT 
  id, 
  title,
  scraped_data->>'html_length' as html_size,
  scraped_data->>'scraped_at' as scraped_at
FROM listings 
WHERE scraped_data->>'full_html' IS NOT NULL;

-- Check if HTML contains specific content
SELECT id, title
FROM listings 
WHERE scraped_data->>'full_html' LIKE '%fullScreenGalleryPics%';
```

### Extract Additional Data
```javascript
// Re-process HTML for new data fields
const htmlContent = listing.scraped_data.full_html;
const $ = cheerio.load(htmlContent);

// Extract new fields without re-scraping
const newData = {
  virtual_tour: $('.virtual-tour').length > 0,
  energy_certificate: $('.energy-cert').text(),
  // ... any other fields
};
```

## Performance Considerations

### Storage Impact
- **Average Size**: ~584KB per listing
- **Database Impact**: Minimal with JSONB compression
- **Query Performance**: Use JSONB operators for efficient queries

### Best Practices
- Use `scraped_data->>'html_length'` for size checks
- Index on `scraped_at` for time-based queries
- Consider archiving old HTML data if storage becomes an issue

## Monitoring

### Health Checks
```sql
-- Monitor HTML storage success rate
SELECT 
  COUNT(*) as total_listings,
  COUNT(CASE WHEN scraped_data->>'full_html' IS NOT NULL THEN 1 END) as with_html,
  ROUND(
    COUNT(CASE WHEN scraped_data->>'full_html' IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as success_rate
FROM listings;
```

### Size Monitoring
```sql
-- Track HTML storage sizes
SELECT 
  AVG((scraped_data->>'html_length')::int) as avg_size,
  MAX((scraped_data->>'html_length')::int) as max_size,
  MIN((scraped_data->>'html_length')::int) as min_size
FROM listings 
WHERE scraped_data->>'full_html' IS NOT NULL;
```

## Future Enhancements

### Potential Features
1. **HTML Compression**: Compress HTML before storage
2. **Selective Storage**: Store only relevant HTML sections
3. **Version Control**: Track HTML changes over time
4. **Search Indexing**: Full-text search within stored HTML

### API Endpoints
- `GET /api/listings/[id]/html` - Retrieve stored HTML
- `POST /api/listings/[id]/reprocess` - Re-process stored HTML
- `GET /api/listings/[id]/html/stats` - HTML storage statistics

## Testing

### Verification Commands
```bash
# Test HTML storage
curl -X POST http://localhost:3000/api/scrape/robust \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.idealista.com/inmueble/98721524/"}'

# Verify storage
curl -X GET http://localhost:3000/api/listings/1000000018
```

### Success Criteria
- ✅ HTML content stored in `scraped_data.full_html`
- ✅ HTML length tracked in `scraped_data.html_length`
- ✅ Scrape timestamp recorded in `scraped_data.scraped_at`
- ✅ All existing functionality preserved

## Conclusion

The full HTML storage feature provides complete control over scraped data, enabling sophisticated re-processing, debugging, and future enhancements without dependency on external sources.

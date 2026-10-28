# Gemini Image Understanding Field Notes

**Generated**: 2025-01-27  
**Purpose**: Document multimodal image capabilities and input methods for Gemini integration

## Test Overview

Run `/api/test/gemini-image-test` to get current test results with real listing photos.

## Image Input Methods Comparison

| Method | Description | Pros | Cons | Reliability |
|--------|-------------|------|------|-------------|
| **Base64 Inline** | Images encoded as base64 and sent inline | ✅ No external dependencies<br>✅ Works with any image source<br>✅ Consistent performance | ❌ Larger request size<br>❌ Base64 encoding overhead | High |
| **URL Fetch** | Gemini fetches images directly from URLs | ✅ Smaller request size<br>✅ No encoding overhead<br>✅ Simpler implementation | ❌ Requires public URLs<br>❌ Potential CORS issues<br>❌ Network dependencies | Medium |

## Production Decision: Supabase Storage + Base64

### Our Approach:
1. **Store photos in Supabase Storage** during scraping
2. **Use Supabase Storage URLs** for display (fast CDN)
3. **Convert to Base64** only for Gemini analysis
4. **No fallbacks** - Single reliable method

### Implementation:
```typescript
// 1. Store photos during scraping
const storageResults = await storeListingPhotos(photos, listingId);

// 2. Save Supabase URLs to database
await supabase.from('listing_photos').insert({
  url: result.supabaseUrl,        // For display
  original_url: result.originalUrl, // For reference
  filename: result.filename
});

// 3. Convert to Base64 for Gemini analysis
const base64Image = await convertSupabaseUrlToBase64(supabaseUrl);
const result = await model.generateContent([
  { text: prompt },
  { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
]);
```

### Benefits:
- ✅ **Fast photo display** - Supabase CDN
- ✅ **Reliable Gemini analysis** - Base64 method
- ✅ **No anti-bot issues** - We control photos
- ✅ **High quality** - Original resolution
- ✅ **Cost effective** - Supabase Storage is cheap
- ✅ **No confusion** - Single method, no fallbacks

## Technical Details

### Base64 Conversion Process:
1. Fetch photo from Supabase Storage URL
2. Convert ArrayBuffer to Base64 string
3. Send inline with Gemini request
4. Gemini processes image directly

### Storage Structure:
```
Supabase Storage Bucket: listing-photos
├── listing_123/
│   ├── property_1.jpg
│   ├── property_2.jpg
│   ├── floorplan_1.jpg
│   └── ...
└── listing_456/
    ├── property_1.jpg
    └── ...
```

### Database Schema:
```sql
-- listing_photos table
url TEXT,              -- Supabase Storage URL (primary)
original_url TEXT,     -- Original Idealista URL (reference)
filename TEXT,         -- Filename in storage
photo_type TEXT,       -- 'property' or 'floorplan'
```

## Actual Test Results (2025-01-27)

**Base64 Inline Method**:
- ✅ **Success Rate**: 100% (2/2 tests passed)
- ⏱️ **Response Time**: ~4.3 seconds average
- 📊 **Quality**: Detailed room descriptions (106+ characters)
- 🔧 **Implementation**: Uses `contents: [{ role: 'user', parts: [...] }]` format
- ✅ **Reliability**: No external dependencies, works with any image URL

**URL Fetch Method**:
- ✅ **Success Rate**: 100% (2/2 tests passed)  
- ⏱️ **Response Time**: ~4.9 seconds average
- 📊 **Quality**: Detailed room descriptions (106+ characters)
- 🔧 **Implementation**: Uses `fileData: { fileUri, mimeType }` format
- ⚠️ **Dependencies**: Requires public URLs, Gemini internet access

### Sample Response Quality
```
"This photo depicts a long, narrow enclosed balcony or sunroom, characterized by abundant natural light and..."
```

## Model Performance Notes

### gemini-2.5-flash (Recommended)
- **Speed**: Fast (2-4 seconds per image)
- **Quality**: Excellent for room analysis
- **Cost**: Cost-effective
- **Use Case**: Primary choice for all analysis stages

### gemini-2.5-pro (For Final Output)
- **Speed**: Slower (4-8 seconds per image)
- **Quality**: Highest quality analysis
- **Cost**: Higher cost
- **Use Case**: Final integrator stage only

## Quality Guidelines

### Good Image Analysis Responses
- Specific element identification (tiles, fixtures, walls)
- Condition assessment (wear, damage, maintenance)
- Room type recognition
- Layout observations
- Material identification

### Poor Image Analysis Responses
- Generic statements ("room looks good")
- Vague descriptions ("nice space")
- No specific elements mentioned
- No condition assessment

## Performance Monitoring

Track these metrics in production:
- **Response Time**: Target < 5 seconds per image
- **Success Rate**: Target > 95%
- **Token Usage**: Monitor costs
- **Error Rate**: Track and alert on failures

## Conclusion

**Base64 encoding with Supabase Storage is our production method.** It provides the best balance of reliability, performance, and control. We eliminate external dependencies while maintaining fast photo display and reliable AI analysis.

No fallbacks, no confusion - one method that works consistently.

---

**Last Updated**: 2025-01-27 - Supabase Storage implementation

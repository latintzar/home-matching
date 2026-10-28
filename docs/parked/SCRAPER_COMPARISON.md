# Scraper Capabilities Comparison

This document provides a detailed, line-by-line comparison of the three scraping mechanisms used in the platform.

**Legend:**
- ✅ **Native/Robust**: Uses specific selectors and cleaning logic. High accuracy.
- 🧠 **AI/Heuristic**: Uses patterns, genetic algorithms, or LLMs. Good for unknown structures.
- ⚠️ **Partial**: Basic extraction, might miss edge cases.

| Feature | **Extension (Instant)** | **Robust Scraper (Server)** | **Universal Scraper (AI/Heuristic)** |
| :--- | :--- | :--- | :--- |
| **Execution Context** | Client-side (Browser) | Server-side (Node.js/Cheerio) | Client-side or Server-side (Gemini) |
| **Latency** | **< 50ms (Pre-fetched)** | 2-5 seconds | 5-15 seconds |
| **Title Parsing** | ✅ Specific selectors (`.main-info__title-main`) + Cleaning Regex | ✅ Identical Logic | 🧠 Heuristic (H1 detection) |
| **Address Cleaning** | ✅ Regex to strip "Flat for sale in..." prefixes | ✅ Identical Logic | 🧠 LLM/Heuristic |
| **Price Extraction** | ✅ Specific selectors + Regex (`/[^\d]/g`) | ✅ Specific selectors + Regex (`/(\d...)/`) | 🧠 Max font-size + Currency symbol logic |
| **Description** | ✅ Selectors (`.comment`, `.detail-description`) | ✅ Identical Logic | 🧠 Longest paragraph heuristic |
| **Bedrooms** | ✅ Regex scan of header + features list | ✅ Identical Logic | 🧠 Regex scan of `document.body` |
| **Bathrooms** | ✅ Regex scan of header + features list | ✅ Identical Logic | 🧠 Regex scan of `document.body` |
| **Area (Built)** | ✅ Regex (`m² built`) from all features | ✅ Identical Logic | 🧠 Regex (`m²`) from visible text |
| **Area (Useful)** | ✅ Regex (`m² useful`) from all features | ✅ Identical Logic | ⚠️ Often missed if not explicit |
| **Floor Level** | ✅ Keywords (`bajo`, `ático`, `planta 4`) | ✅ Identical Logic | 🧠 LLM inference |
| **Condition** | ✅ Keywords (`obra nueva`, `a reformar`) | ✅ Identical Logic | 🧠 LLM inference |
| **Elevator** | ✅ Keywords (`ascensor`, `lift`) | ✅ Identical Logic | 🧠 LLM inference |
| **Exterior** | ✅ Keywords (`exterior`) | ✅ Identical Logic | 🧠 LLM inference |
| **Terrace/Balcony** | ✅ Keywords (`terraza`, `balcón`) | ✅ Identical Logic | 🧠 LLM inference |
| **Pool/Garden/Garage** | ✅ Keywords (`piscina`, `jardín`, `garaje`) | ✅ Identical Logic | 🧠 LLM inference |
| **Coordinates** | ✅ Map attributes + Script variable scan | ✅ Identical Logic | ❌ Not typically available |
| **Photos** | ✅ Script parsing (`fullScreenGalleryPics`) | ✅ Identical Logic | 🧠 Large image heuristic (>400px) |
| **Agency Info** | ✅ Logo/Name from branding script | ✅ Identical Logic | ❌ Difficult to isolate |
| **Reference ID** | ✅ Specific selectors (`.txt-ref`) | ✅ Identical Logic | ⚠️ Regex for "Ref:" pattern |

## Detailed Logic Comparison

### 1. Address & Title
- **Extension/Robust**: Both use a shared `cleanMainTitleForAddress` function that aggressively strips real estate prefixes (e.g., "Piso en venta en...") to find the true street address.
- **Universal**: Relies on finding the largest H1 or using LLM (Gemini) to identify the address entity.

### 2. Stats (Beds, Baths, m²)
- **Extension/Robust**: Both construct a "super-string" of `header features + list features` and run specific regex patterns against it. This ensures that if "3 beds" is in the title but not the list, it's still caught.
- **Universal**: Scans the entire `document.body.innerText`. This is powerful but can sometimes pick up "3 bedrooms" from a "Similar Properties" section sidebar.

### 3. Boolean Specs (Elevator, Pool, etc.)
- **Extension/Robust**: Both now map specific keywords (Spanish/English) to boolean flags (`has_elevator`, `has_pool`, etc.) and enum fields (`condition`, `floor_level`).
- **Universal**: Does not output structured booleans natively unless processed via LLM.

### 4. Photos
- **Extension/Robust**: Both extract the *high-resolution* JSON data hidden in the `fullScreenGalleryPics` script variable. This bypasses the low-res thumbnails shown on the page.
- **Universal**: Selects `<img>` tags with `naturalWidth > 400`. This gets decent photos but often misses the highest quality versions or includes irrelevant images (ads, agent photos).

### 5. Coordinates
- **Extension/Robust**: Both implement a "Double Tap" strategy:
    1. Check `<div id="ideMapDetail" data-latitude="...">`
    2. If missing, scan all `<script>` tags for `latitude: ...` variables.
- **Universal**: Cannot reliably extract coordinates as they are often hidden in scripts or map API calls.

## Conclusion

The **Extension (Instant)** scraper has been upgraded to **complete parity** with the **Robust Server Scraper**. It is no longer a "lite" version but a full-featured client-side parser that shares the exact same logic for cleaning, parsing, and extracting data.

The **Universal Scraper** remains a fallback for non-Idealista sites, using intelligent heuristics to make a "best guess" at the content.


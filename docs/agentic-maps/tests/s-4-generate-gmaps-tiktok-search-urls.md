---
test_id: "S.4"
name: "Generate GMaps/TikTok search URLs"
scenario: 0
scenario_name: "Shared Building Blocks"
status: not-started
api: "None (URL construction)"
cost: "FREE"
implementation: null
last_tested: null
---

### Shared.4 - Generate GMaps/TikTok search URLs

| | |
|---|---|
| **Input** | Search query + location |
| **Output** | Clickable links that open platform searches |
| **API** | None (URL construction) |
| **Cost** | FREE |
| **Proves** | URL patterns are correct |

**Steps:**
| # | Action | Method |
|---|--------|--------|
| 1 | Take search query + location | Input strings |
| 2 | Combine into full query | `"${query} ${location}"` |
| 3 | URL encode for GMaps | `encodeURIComponent(fullQuery).replace(/%20/g, '+')` |
| 4 | Build GMaps URL | `https://www.google.com/maps/search/${encoded}` |
| 5 | URL encode for TikTok (lowercase) | `encodeURIComponent(fullQuery.toLowerCase()).replace(/%20/g, '+')` |
| 6 | Build TikTok URL | `https://www.tiktok.com/search?q=${encoded}` |
| 7 | Return both URLs | `{ gmaps: gmapsUrl, tiktok: tiktokUrl }` |
| 8 | Render as clickable buttons | `<a href={url} target="_blank">` |

**📋 TEST INPUT (copy-paste):**
```
speakeasy bars | El Born Barcelona
```

**Expected output:**
```
GMaps: https://www.google.com/maps/search/speakeasy+bars+El+Born+Barcelona
TikTok: https://www.tiktok.com/search?q=speakeasy+bars+el+born+barcelona
```

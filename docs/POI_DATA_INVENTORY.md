# POI Data Inventory

> Complete inventory of POI data sources and when to use each.

## Decision Tree: Which Data Source?

```
User asks about POIs
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Is it INFRASTRUCTURE that rarely changes (10+ years)?      │
│  (parks, metro, schools, hospitals, beaches, sports clubs)  │
└─────────────────────────────────────────────────────────────┘
         │ YES                              │ NO
         ▼                                  ▼
    ┌─────────┐               ┌─────────────────────────────┐
    │   OSM   │               │  Is it a CHAIN BUSINESS?    │
    │ (FREE)  │               │  (Starbucks, McDonalds,     │
    └─────────┘               │   Mercadona, CrossFit...)   │
                              └─────────────────────────────┘
                                    │ YES           │ NO
                                    ▼               ▼
                              ┌─────────┐    ┌─────────────────┐
                              │   ATP   │    │ Does user need  │
                              │ (FREE)  │    │ QUALITY/REVIEWS?│
                              └─────────┘    └─────────────────┘
                                                  │ YES    │ NO
                                                  ▼        ▼
                                            ┌──────────┐ ┌─────┐
                                            │ScrapingDog│ │ OSM │
                                            │ ($0.002) │ │(FREE)│
                                            └──────────┘ └─────┘
```

### Quick Reference

| User Says | Source | Why |
|-----------|--------|-----|
| "Near a park" | OSM | Infrastructure |
| "Close to metro" | OSM | Infrastructure |
| "Good schools nearby" | OSM | Infrastructure |
| "Near a Mercadona" | ATP | Chain business |
| "CrossFit gyms" | ATP | Chain business |
| "Near cafes" | OSM | General existence (amenity=cafe) |
| "Near bakeries" | OSM | General existence (shop=bakery) |
| "Best specialty coffee" | ScrapingDog | Quality matters |
| "Dog-friendly restaurants" | ScrapingDog | Specific attribute |
| "Highly-rated brunch spots" | ScrapingDog | Reviews needed |

---

## AllThePlaces (ATP) Inventory - Spain

**Total: 92,375 POIs across 387 chains**
**Table: `leo-atp-pois`**
**Key: PK = geohash prefix (4 chars), SK = geohash#id**

### 🛒 Supermarkets/Grocery (13,259 total)

| Spider | Count | Brand |
|--------|-------|-------|
| dia_es | 3,291 | Dia |
| carrefour_es | 1,887 | Carrefour |
| mercadona | 1,672 | Mercadona |
| spar_es | 850 | Spar |
| condis_es | 722 | Condis |
| lidl_es | 714 | Lidl |
| alcampo_es | 566 | Alcampo |
| aldi_nord_es | 497 | Aldi |
| gadisa_es | 483 | Gadisa |
| supercor_es | 129 | Supercor |
| dinosol_es | 228 | Dinosol |
| superverd_es | 68 | Superverd |

**Use case:** "Near a supermarket" → ATP (comprehensive chain coverage)

### ⛽ Gas Stations (8,812 total)

| Spider | Count | Brand |
|--------|-------|-------|
| repsol | 3,631 | Repsol |
| total_energies | 3,202 | TotalEnergies |
| bp | 1,216 | BP |
| shell | 763 | Shell |

**Use case:** Not typically relevant for housing search

### 🏦 Banks (7,192 total)

| Spider | Count | Brand |
|--------|-------|-------|
| banco_sabadell_es | 2,906 | Sabadell |
| cajamar_es | 2,054 | Cajamar |
| bankinter_es | 764 | Bankinter |
| abanca_es | 704 | Abanca |
| credit_agricole | 737 | Credit Agricole |

**Use case:** Not typically relevant for housing search

### 🍔 Fast Food (4,949 total)

| Spider | Count | Brand |
|--------|-------|-------|
| mcdonalds_es | 1,204 | McDonald's |
| burger_king_es_pt | 1,146 | Burger King |
| burger_king | 1,121 | Burger King |
| taco_bell_es | 166 | Taco Bell |
| papa_johns_es | 153 | Papa John's |
| subway | 59 | Subway |
| dominos_pizza_fr | 23 | Domino's |
| kfc_fr | 37 | KFC |
| five_guys_fr | 2 | Five Guys |

**Use case:** Area vibe indicator (high fast food = more commercial)

### ☕ Coffee Chains (272 total)

| Spider | Count | Brand |
|--------|-------|-------|
| starbucks_eu | 257 | Starbucks |
| starbucks_mena | 15 | Starbucks |

**⚠️ LIMITATION:** Only Starbucks! For general "cafes nearby", use OSM.

### 💪 Gyms/Fitness (820 total)

| Spider | Count | Brand |
|--------|-------|-------|
| cross_fit | 648 | CrossFit |
| basic_fit_fr | 82 | Basic-Fit |
| anytime_fitness | 53 | Anytime Fitness |
| go_fit | 19 | GoFit |
| orangetheory_fitness | 9 | Orangetheory |
| f45_training | 13 | F45 |

**Use case:** "CrossFit nearby" → ATP. "Any gym nearby" → need OSM too.

### 👕 Fashion Retail (3,500+ total)

| Spider | Count | Brand |
|--------|-------|-------|
| inditex | 1,162 | Zara, Massimo Dutti, Pull&Bear |
| hm | 146 | H&M |
| primark | 74 | Primark |
| decathlon_es | 179 | Decathlon |
| jd_sports_es | 131 | JD Sports |
| foot_locker | 68 | Foot Locker |
| nike | 52 | Nike |
| adidas | 62 | Adidas |

**Use case:** Shopping area indicator

### 🏨 Hotels (600+ total)

| Spider | Count | Brand |
|--------|-------|-------|
| accor | 326 | Accor (Ibis, Novotel) |
| marriott_hotels | 132 | Marriott |
| hilton | 91 | Hilton |
| ihg_hotels | 82 | IHG |
| catalonia_hotels | 62 | Catalonia |

**Use case:** Tourist area indicator

### 🚲 Bike Sharing (14,757 total)

| Spider | Count | Description |
|--------|-------|-------------|
| gbfs | 14,757 | Bike share stations (Bicing, etc.) |

**Use case:** "Bikeable area" → ATP (gbfs)

### 📦 Other Notable

| Spider | Count | Use Case |
|--------|-------|----------|
| amazon_locker | 2,803 | Convenience indicator |
| movistar_es | 840 | - |
| orange_es | 754 | - |
| coinstar | 802 | - |
| ikea | 157 | Furniture shopping |
| decathlon_es | 179 | Sports shopping |
| peluquerias_low_cost_es | 481 | Hair salons |

---

## OSM Data Inventory - Spain

**Table: `leo-osm-pois`**
**Total: 126,009 POIs**

### Currently Imported ✅

| Type | OSM Tag | Count (approx) | Use Case |
|------|---------|----------------|----------|
| Parks | leisure=park | 52,000+ | Green space scoring |
| Metro | railway=station | 500+ | Transit access |
| Beaches | natural=beach | 4,500+ | Beach proximity |
| Schools | amenity=school | 3,200+ | Family scoring |
| Supermarkets | shop=supermarket | 8,000+ | Convenience |
| Healthcare |  | 2,000+ | Healthcare access |

### NOT YET IMPORTED ❌ (Need to add!)

| Type | OSM Tag | Est. Count | Use Case |
|------|---------|------------|----------|
| **Cafes** | amenity=cafe | ~15,000 | "Near cafes" |
| **Bakeries** | shop=bakery | ~8,000 | "Near bakeries" |
| **Restaurants** | amenity=restaurant | ~40,000 | "Restaurants nearby" |
| **Bars** | amenity=bar | ~10,000 | Nightlife indicator |
| **Gyms** | leisure=fitness_centre | ~3,000 | "Gym nearby" |
| **Pharmacies** | amenity=pharmacy | ~22,000 | Healthcare |
| **Playgrounds** | leisure=playground | ~8,000 | Family scoring |
| **Dog Parks** | leisure=dog_park | ~500 | Dog-friendly |
| **Tennis** | leisure=pitch + sport=tennis | ~2,000 | Sports |
| **Swimming** | leisure=swimming_pool | ~1,500 | Sports |
| **Coworking** | amenity=coworking_space | ~500 | Remote work |

---

## ScrapingDog (Live API)

**Cost:** ~$0.002 per search
**Cache:** 7 days in `leo-scraped-pois`

### When to Use

Use ScrapingDog when the user's request requires:

1. **Quality/Ratings**: "Best cafes", "top-rated restaurants"
2. **Specific Attributes**: "Dog-friendly", "LGBTQ-friendly", "quiet"
3. **Review Analysis**: "Coworking with fast wifi" (need to read reviews)
4. **Niche Categories**: "Specialty coffee", "natural wine bars"

### Conversation Probing

When user mentions cafes/restaurants/etc, Leo should probe:

| User Says | Probe Question | If General → | If Specific → |
|-----------|---------------|--------------|---------------|
| "Near cafes" | "Any cafe, or looking for good coffee specifically?" | OSM | ScrapingDog |
| "Restaurants nearby" | "Just want options, or looking for quality?" | OSM | ScrapingDog |
| "Gym access" | "Any gym, or specific type like CrossFit?" | OSM | ATP/ScrapingDog |
| "Dog-friendly area" | "Parks for walks, or cafes/restaurants too?" | OSM parks | ScrapingDog |

---

## Action Items

### Immediate
- [ ] Add missing OSM tags to extract script (cafes, bakeries, restaurants, bars, gyms)
- [ ] Re-run OSM import with new tags
- [ ] Update `leo-osm-pois` table

### Future
- [ ] Build probing logic into Leo Brain
- [ ] Cache ScrapingDog results aggressively
- [ ] Create density scoring from OSM (cafe_density, restaurant_density)

---

*Last Updated: 2025-12-09*

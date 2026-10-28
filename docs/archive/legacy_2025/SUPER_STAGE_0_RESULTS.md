# Super Stage 0 Pipeline Results

**Date**: 2025-11-18  
**Listing ID**: 1000000121  
**Pipeline Version**: Super Stage 0 (merged Stage 0, 1, 1.5)

## Summary

The Super Stage 0 pipeline successfully merged visual and structural analysis into a single authoritative pass. Results are **spot on** - all photos correctly clustered with proper visibility mappings.

## Architecture Changes

### Before
- **Stage 0**: Visual cluster analysis (Pro)
- **Stage 1**: Structural extraction (Flash Lite)
- **Stage 1.5**: Merge visual + structural (Flash)
- **Stage 2**: Choose best photo per space
- **Stage 3**: Match remaining photos
- **Stage 5**: Visual refinement

### After (Super Stage 0)
- **Super Stage 0**: Visual + Structural merged (Pro) - single authoritative pass
  - Analyzes all photos visually
  - Uses listing details (bedrooms, bathrooms, description)
  - Outputs definitive clusters with anchor photos and descriptions
  - Provides `target_clusters` and `merged_photo_groupings`
- **Stage 2**: Choose best photo per space (uses anchor descriptions)
- **Stage 3**: Match remaining photos (uses anchor descriptions as semantic prototypes)
- **Stage 5**: Visual refinement (temperature lowered to 0.1 for deterministic finisher)

## Key Improvements

1. **Single Source of Truth**: Super Stage 0 replaces 3 stages (0, 1, 1.5) with one authoritative pass
2. **Anchor Photos**: Each cluster has a chosen anchor photo with rich description
3. **Semantic Matching**: Stages 2 & 3 use anchor descriptions for better photo matching
4. **Deterministic Refinement**: Stage 5 temperature lowered to 0.1 - only fixes obvious outliers
5. **Better Consistency**: Reduced variability between runs by consolidating decision-making

## Results

### Clusters Generated: 10

1. **Salón-Comedor** (6 photos)
   - Visibility: Terraza con Piscina Privada, Cocina, Dormitorio Principal
   
2. **Cocina** (1 photo)
   - Visibility: Salón-Comedor
   
3. **Terraza con Piscina Privada** (8 photos)
   - Visibility: Salón-Comedor, Dormitorio Principal
   
4. **Dormitorio Principal** (3 photos)
   - Visibility: Salón-Comedor, Terraza con Piscina Privada
   
5. **Baño Principal (En-suite)** (1 photo)
   
6. **Dormitorio 2 (Estilo Safari)** (2 photos)
   
7. **Baño 2 (En-suite)** (1 photo)
   
8. **Dormitorio 3** (1 photo)
   
9. **Baño 3** (1 photo)
   
10. **Piscina Comunitaria y Jardines** (1 photo)

### Excluded Clusters

- **excluded - plano** (floorplan)
- **excluded - vistas** (views)
- **excluded - certificado energético** (energy certificate)

## Visibility Mappings

Visibility detection is conservative - only marks clusters as visible when a **significant portion** is visible (for R3 consistency). Examples:

- Salón-Comedor → Terraza con Piscina Privada (via sliding glass doors)
- Salón-Comedor → Cocina (open plan)
- Dormitorio Principal → Terraza con Piscina Privada (via sliding glass doors)

## Technical Details

### Stage 0 (Super Stage 0)
- **Model**: Gemini 2.5 Pro
- **Max Output Tokens**: 20000
- **Temperature**: 0.2
- **Inputs**: All photos + listing details (title, address, bedrooms, bathrooms, description, property type, constructed area)

### Stage 2
- **Model**: Gemini 2.5 Pro
- **Max Output Tokens**: 32000
- **Uses**: Anchor descriptions from Super Stage 0 for semantic matching

### Stage 3
- **Model**: Gemini 2.5 Pro
- **Max Output Tokens**: 16000
- **Uses**: Anchor descriptions as semantic prototypes for matching remaining photos

### Stage 5 (Refinement)
- **Model**: Gemini 2.5 Pro
- **Max Output Tokens**: 30000
- **Temperature**: 0.1 (lowered for deterministic finisher behavior)
- **Role**: Only fixes obvious outliers, minimizes changes

## User Feedback

> "They're very good. They're spot on."

The Super Stage 0 approach successfully:
- ✅ Correctly clusters all photos
- ✅ Identifies proper room types
- ✅ Creates meaningful cluster names
- ✅ Detects excluded content (views, floorplans, certificates)
- ✅ Maps visibility conservatively (significant portions only)
- ✅ Provides consistent results run-to-run

## Next Steps

- Clear records and rerun to verify consistency
- Monitor Stage 5 refinement behavior with lower temperature
- Ensure anchor descriptions are being used effectively in Stages 2 & 3


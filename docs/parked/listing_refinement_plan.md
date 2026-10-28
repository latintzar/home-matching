# Implementation Plan: Refinement of Listing Editor & Downstream Components

## 1. Amenities / Features Cleanup
- [ ] **Rename "Amenities" Section**: Change the "Amenities" header in `ListingEditor` to "Other Features" to avoid confusion with the specific booleans above.
- [ ] **Filter Redundancy**: Ensure that `amenities` list in `formData` does NOT contain items that are already covered by the explicit boolean toggles (e.g., "Lift", "Pool", "Garage") during the scraping/normalization phase.
- [ ] **UI Update**: In `PropertyDetails.tsx`, ensure the "Other Features" list filters out any text that matches the booleans to prevent double-listing.

## 2. Floor Level Precision
- [ ] **New Floor Option**: Add "Entreplanta" (Mezzanine) to the `floor_level` dropdown options (`ground`, `mezzanine`, `intermediate`, `top`).
- [ ] **Conditional Floor Number**:
    - If `ground` or `mezzanine`: The "Nº" input should be **disabled/faded** or hidden (implicitly 0 or 0.5).
    - If `intermediate` or `top`: The "Nº" input is **required/editable**.
- [ ] **Validation**: Ensure proper validation when saving manual listings.

## 3. Agent Details Enrichment
- [ ] **Expanded Agent Fields**:
    - Already added `whatsapp`, `phone`, `email` to `ListingEditor` in previous step (confirmed).
    - Ensure these fields are correctly extracted by the **scrapers** (Idealista/Universal).
    - Ensure they are displayed in `PropertyDetails`.
- [ ] **UI Polish**: Verify the Agent card in `ListingEditor` looks clean with these new inputs.

## 4. Migrations
- [ ] **Apply Pending Migrations**: Ensure `054_add_balcony_terrace_orientation.sql` (created previously) is applied via MCP if not already.
- [ ] **Verify Schema**: Check `listings` table has all new columns (`floor_number`, `balcony_orientation`, `terrace_orientation`, `agent_id` linkage).

## Execution Steps
1.  **Modify `ListingEditor.tsx`**: Implement the floor level logic and "Other Features" renaming (already partially done, will refine).
2.  **Update `scraper-normalizer.ts`**: Add logic to filter out boolean keywords from the free-text `amenities` array.
3.  **Update `PropertyDetails.tsx`**: Ensure it displays the rich agent info.
4.  **Apply Migrations**: Run `mcp_supabase_apply_migration` for any pending files.


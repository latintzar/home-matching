import { NextRequest, NextResponse } from 'next/server';
import { callGeminiRest } from '@/lib/gemini-rest-client';
import { getModelForTask } from '@/lib/model-registry';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for image generation

/**
 * Landing Page Image Generator
 * 
 * Generates the 6 images needed for Leo.casa homepage using Gemini 3 Pro Image Preview
 * 
 * POST /api/landing/generate-images
 * Body: { imageId?: string } - Optional: generate a specific image, otherwise generate all
 */

interface ImagePrompt {
  id: string;
  filename: string;
  description: string;
  prompt: string;
  aspectRatio: '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
}

const LANDING_IMAGE_PROMPTS: ImagePrompt[] = [
  // ===== RENTERS SECTION IMAGES =====
  {
    id: 'renters-morning-light',
    filename: 'renters-morning-light.png',
    description: 'Renters: Morning light in Spanish apartment',
    prompt: `Create a beautiful photograph of morning light streaming into a Spanish apartment.

SCENE:
- A cozy corner of a Barcelona apartment bedroom or living room
- Early morning golden light streaming through tall windows with wooden shutters (persianas)
- Soft shadows creating patterns on white walls
- A person (seen from behind or partially) enjoying coffee by the window, relaxed posture
- Hints of the neighborhood visible through the window (rooftops, other buildings)

DETAILS:
- Warm, natural morning light (not harsh)
- Simple, tasteful furnishings - linen bedding or a comfortable reading chair
- Maybe a small plant or book on the windowsill
- Original architectural details (moldings, tile floor)
- Cup of coffee steaming gently

MOOD:
- "This is what my mornings could look like"
- Peaceful, aspirational, calm
- The feeling of having found the right place
- Warm without being staged

COLOR:
- Warm golden tones from morning sun
- Soft whites and creams
- Natural wood tones
- Touch of green from plant

NO: Harsh lighting, overly styled, stock photo feeling, direct face shots, clutter`,
    aspectRatio: '16:9'
  },
  {
    id: 'renters-apartment-search',
    filename: 'renters-apartment-search.png',
    description: 'Renters: Person casually browsing on phone',
    prompt: `Create a lifestyle photograph of someone casually looking at their phone while in their environment.

SCENE:
- A young professional (late 20s-30s) sitting in a cafe or on a park bench in Barcelona
- Casually looking at their phone with a relaxed, interested expression
- Golden afternoon light
- Barcelona urban environment visible in background (buildings, trees, cafe tables)

PERSON:
- Natural, candid pose - not posed or stock-photo-like
- Dressed casually but stylishly (Mediterranean casual)
- Phone held naturally, screen not visible
- Slight smile or focused expression
- Can be any gender/ethnicity

ENVIRONMENT:
- Outdoor setting - cafe terrace, park bench, or urban plaza
- Barcelona architecture in soft focus behind
- Late afternoon golden light
- Maybe a coffee or drink on a table nearby

MOOD:
- "Searching for your next place doesn't have to be stressful"
- Relaxed, modern, optimistic
- Life continues while Leo works in the background

NO: Stock photo poses, office setting, stressed expression, harsh lighting, visible screen content`,
    aspectRatio: '16:9'
  },
  {
    id: 'renters-viewing-day',
    filename: 'renters-viewing-day.png',
    description: 'Renters: Apartment viewing scene',
    prompt: `Create a photograph of an apartment viewing scene in a Spanish flat.

SCENE:
- A bright, empty or sparsely furnished Spanish apartment
- Someone (seen from behind) standing in the middle of the room, looking around
- Natural daylight flooding in from large windows
- Original architectural details visible (high ceilings, moldings, herringbone floors)
- The feeling of imagining possibilities

COMPOSITION:
- Person occupies about 30% of frame, positioned to one side
- Shows the potential of the space
- Through the window: glimpse of Barcelona neighborhood
- Empty walls waiting to become a home

DETAILS:
- Original wooden doors, possibly ajar
- Tall ceilings with period details
- Hardwood or terracotta floors
- Large windows with classic Barcelona balcony railings visible
- Clean, bright, full of potential

MOOD:
- "This could be the one"
- Hopeful, excited, considering
- The moment of imagining your life in a new space
- Possibility and potential

NO: Cluttered space, staged furniture, agent in frame, harsh shadows, dark corners`,
    aspectRatio: '16:9'
  },
  {
    id: 'renters-balcony-view',
    filename: 'renters-balcony-view.png',
    description: 'Renters: Barcelona balcony view',
    prompt: `Create a beautiful photograph from a Barcelona apartment balcony.

VIEW:
- Looking out from a typical Barcelona apartment balcony
- View of neighborhood rooftops, other apartment buildings, maybe church spire or landmark in distance
- Mediterranean blue sky with a few soft clouds
- Late afternoon golden light on the buildings

BALCONY DETAILS:
- Classic wrought iron railing in foreground (slightly out of focus)
- Maybe a small plant or coffee cup on the balcony ledge
- Hint of the apartment interior visible behind (curtain, window frame)

NEIGHBORHOOD:
- Mix of traditional Barcelona buildings (4-6 stories)
- Terracotta rooftops at various angles
- Some laundry hanging on distant balconies (authentic touch)
- Trees visible in courtyards or streets below
- Maybe a glimpse of the sea or Tibidabo in the far distance

LIGHTING:
- Golden hour - warm light on building facades
- Some buildings in sun, some in gentle shadow
- Romantic, inviting atmosphere

MOOD:
- "This view will be yours every evening"
- The reward of finding the right place
- Urban life with beauty
- A moment of pause in a busy city

NO: Ugly buildings, air conditioning units prominently featured, cars, harsh midday light, tourists`,
    aspectRatio: '16:9'
  },
  {
    id: 'renters-keys-moment',
    filename: 'renters-keys-moment.png',
    description: 'Renters: Getting the keys moment',
    prompt: `Create a photograph capturing the moment of receiving keys to a new apartment.

SCENE:
- Close-up of hands - one hand giving keys, another receiving them
- Background: entrance hall of a classic Spanish apartment building (portal)
- Natural light coming from the entrance
- Moment of transition and new beginnings

DETAILS:
- Classic brass or iron keys with character (not generic modern keys)
- Elegant Spanish apartment building entrance (marble floors, ornate mailboxes, period details)
- Soft focus on the background
- Hands in natural position - not overly posed

ENVIRONMENT:
- Traditional Barcelona "portal" entrance
- Maybe vintage elevator cage visible in background
- Decorative tile floor
- Ornate lamp or ironwork

MOOD:
- "The moment it becomes yours"
- Excitement, relief, new chapter
- The payoff of the search
- Trust and handover

COLOR:
- Warm tones
- Classic building materials: marble, wood, brass
- Soft natural light from doorway

NO: Modern building, clinical/generic keys, harsh lighting, messy background`,
    aspectRatio: '4:3'
  },
  {
    id: 'renters-neighborhood-life',
    filename: 'renters-neighborhood-life.png',
    description: 'Renters: Neighborhood daily life scene',
    prompt: `Create a charming photograph of daily life in a Barcelona neighborhood.

SCENE:
- A quiet morning on a residential street in Gràcia, Poble Sec, or Sant Antoni
- Local bakery or small shop with door open
- Maybe someone walking a dog or carrying a shopping bag
- Trees providing dappled shade
- The rhythm of local life

DETAILS:
- Classic neighborhood shops: bakery (forn), fruit shop, small cafe
- Awnings in traditional colors
- Neighbor buildings with balconies and shutters
- Maybe a bicycle parked against a wall
- Local character - not touristy

PEOPLE (if any):
- Locals going about their day - walking, chatting, shopping
- Natural, not posed
- Part of the environment, not the focus

LIGHTING:
- Morning light - soft and inviting
- Some areas in shade from buildings
- Dappled light through trees

MOOD:
- "This could be your neighborhood"
- The daily rhythm you'd become part of
- Community, belonging, routine
- The life between home and city

NO: Tourists, crowded streets, restaurants with prices displayed, nightlife, harsh shadows`,
    aspectRatio: '16:9'
  },
  // ===== LIFE STAGES IMAGES - DIFFERENT INTERNATIONAL PEOPLE, DIFFERENT SPACES =====
  {
    id: 'life-first-place',
    filename: 'life-first-place.png',
    description: 'First apartment - Korean woman in Raval studio',
    prompt: `Cinematic photograph of a KOREAN WOMAN (mid 20s) in her first apartment in Barcelona's Raval neighborhood.

THE PERSON:
- Young Korean woman, mid 20s
- Moved to Barcelona for a design job
- Sitting in a CHAIR at a small desk by the window
- Casual evening clothes, hair up
- Working on laptop, takeout nearby

THE SPACE - RAVAL CHARACTER:
- Tiny but charming Raval studio
- OLD BUILDING character: exposed brick wall, wooden beams
- Small balcony with iron railing overlooking narrow street
- Colorful tiles on the floor (hydraulic tiles)
- It's rough but has SOUL

HOME TOUCHES (messy but lived-in):
- Sitting on a simple wooden chair at tiny desk
- String lights on the wall
- Photos and postcards pinned up
- Plants on the balcony
- Korean snacks on shelf, Spanish wine bottle
- Clothes on a rack (no closet)
- It's messy but it's HOME

THE MOMENT:
- Evening, warm lamp light
- City sounds from the open balcony
- She's tired but content
- Video call ended, now eating dinner alone but happy

MOOD:
- First apartment abroad that's actually HERS
- Chaotic but cozy
- Independence in a new city
- The Raval energy - gritty but alive

CINEMATOGRAPHY:
- Warm tungsten lamp light
- Blue hour Barcelona outside
- Intimate, documentary style
- Film grain

NO: Sitting on floor, sterile modern apartment, too clean`,
    aspectRatio: '16:9'
  },
  {
    id: 'life-flatmates',
    filename: 'life-flatmates.png',
    description: 'Flatmates - international group in Poble Sec terrace',
    prompt: `Cinematic photograph of INTERNATIONAL FLATMATES on their ROOFTOP TERRACE in Poble Sec, Barcelona.

THE PEOPLE (4 different nationalities):
- Argentinian man with beard
- Dutch woman, tall, blonde
- Moroccan woman with curly hair  
- Irish man, red hair
- All late 20s, clearly close friends

THE SPACE - POBLE SEC ROOFTOP:
- Shared rooftop terrace (very Barcelona!)
- Mismatched chairs, string lights, plants
- View of Montjuïc in background
- Makeshift outdoor furniture
- BBQ or paella pan visible
- Very different from typical indoor dining

THE MOMENT:
- Summer evening on the terrace
- Post-dinner drinks, someone playing guitar
- Relaxed, laughing, wine bottles everywhere
- The golden hour light of Barcelona summer
- That specific rooftop magic

MOOD:
- Rooftop terrace living = peak Barcelona
- International found family
- Summer nights that go until 2am
- Speaking 4 languages, understanding each other
- Poble Sec neighborhood vibes

CINEMATOGRAPHY:
- Golden hour / magic hour light
- Montjuïc silhouette in background
- Wide shot showing the group + view
- Warm, nostalgic summer feeling
- Think "Call Me By Your Name" summer vibes

NO: Indoor scene, same nationality, winter, posed`,
    aspectRatio: '16:9'
  },
  {
    id: 'life-moving-in',
    filename: 'life-moving-in.png',
    description: 'Couple moving in - to modernist Eixample apartment',
    prompt: `Cinematic photograph of an INTERNATIONAL COUPLE in their new EIXAMPLE apartment.

THE COUPLE:
- British-Nigerian man, late 20s
- Italian woman, curly dark hair, late 20s
- They met in Barcelona, now moving in together
- Casual moving day clothes

THE SPACE - CLASSIC EIXAMPLE:
- STUNNING modernist Eixample apartment
- Original features: stained glass, decorative ceilings
- Gallery hallway with patterned tiles
- Tall French doors to the balcony
- The specific grandeur of Eixample buildings
- Empty but GORGEOUS

THE MOMENT:
- Standing in the gallery hallway together
- Light streaming through stained glass
- Looking around at THEIR new place
- The awe of affording something this beautiful
- Boxes stacked but they're just taking it in

MOOD:
- "How did we get THIS apartment?"
- Eixample dream come true
- Two people from different countries
- Building a life in Barcelona's most beautiful buildings
- Overwhelmed by the beauty

CINEMATOGRAPHY:
- Light through stained glass windows
- Architectural details visible
- Soft, dreamy quality
- The specific light of Eixample apartments
- Think Woody Allen's Barcelona scenes

NO: Modern apartment, generic space, dark`,
    aspectRatio: '16:9'
  },
  {
    id: 'life-family',
    filename: 'life-family.png',
    description: 'Family - in a Gràcia apartment with courtyard',
    prompt: `Cinematic photograph of an INTERNATIONAL FAMILY in their GRÀCIA apartment.

THE FAMILY:
- Brazilian father
- German mother  
- Toddler (mixed, curly hair)
- A family that Barcelona created
- Mid 30s parents

THE SPACE - GRÀCIA CHARACTER:
- Gràcia apartment with interior courtyard view
- The specific Gràcia vibe: artsy, bohemian, family-friendly
- Wooden floors, white walls, plants everywhere
- Big windows looking onto interior patio
- Not huge but PERFECT for them
- Very different from Eixample grandeur

THE MOMENT:
- Morning light from the courtyard
- Dad playing with toddler near the window
- Mom in background with coffee
- Lazy weekend morning energy
- Toys scattered but it's cozy

MOOD:
- Gràcia = the family neighborhood
- International family rooted in Barcelona
- Weekend morning domestic bliss
- The courtyard light that Gràcia is known for
- A child growing up between cultures

CINEMATOGRAPHY:
- Soft courtyard morning light
- Intimate, documentary feel
- Plants and greenery visible
- Warm but not oversaturated
- Think "Aftersun" domestic intimacy

NO: Perfect stock family, Eixample style, dark`,
    aspectRatio: '16:9'
  },
  // ===== CHECKLIST VISUAL IMAGES =====
  {
    id: 'checklist-look-feel',
    filename: 'checklist-look-feel.png',
    description: 'Checklist: Look and feel - clean wide angle apartment',
    prompt: `Create a WIDE-ANGLE photograph of a beautiful Spanish apartment interior. NO overlays, NO text, NO bounding boxes - just a clean photo.

THE SPACE:
- One spacious Spanish apartment living room
- Wide-angle lens capturing the whole space
- Beautiful morning light streaming through tall windows on left side
- High ceilings (3+ meters) with original ornate moldings
- Herringbone parquet or terracotta tile floors
- French doors or balcony doors visible, possibly open
- Gallery-style layout typical of Barcelona Eixample

LIGHT:
- Gorgeous natural morning light flooding in from the left
- Light creating patterns on the floor
- Warm golden tones
- Shadows adding depth

FURNISHING:
- Empty or very minimal (a plant, a bench, nothing more)
- The space itself is the subject
- Clean, airy, full of potential

ARCHITECTURAL DETAILS:
- Ornate ceiling rose
- Original wooden doors
- Wrought iron balcony railings visible through windows
- Period moldings and trim

MOOD:
- Aspirational, beautiful, spacious
- "This could be your place"
- Clean, bright, inviting

ABSOLUTELY NO: Text, labels, bounding boxes, overlays, UI elements, multiple rooms, collage, people`,
    aspectRatio: '16:9'
  },
  // ===== LISTING VS REALITY IMAGES =====
  {
    id: 'listing-staged-beautiful',
    filename: 'listing-staged-beautiful.png',
    description: 'Listing photo: Beautiful staged apartment (wide-angle, morning light)',
    prompt: `Create a professional real estate listing photograph of a beautiful Spanish apartment interior.

THIS IS A STAGED LISTING PHOTO - it should look TOO good:
- Wide-angle lens making the room look bigger than it is
- Perfect morning golden light flooding in
- Professionally styled with minimal furniture
- Everything pristine, no imperfections visible

ROOM:
- Bright living room of a Barcelona apartment
- High ceilings with period moldings
- Large windows letting in abundant light
- Herringbone wood floors gleaming
- Fresh white walls

STAGING:
- Designer furniture, perfectly placed
- Fresh flowers in a vase
- Artfully arranged books and decor
- No personal items, totally generic
- Almost too perfect to be real

PHOTOGRAPHY:
- Ultra wide-angle lens (makes room look 30% bigger)
- Shot during golden hour morning light
- Perfect exposure, no shadows
- Professional real estate photography style
- HDR-like perfect lighting everywhere

MOOD:
- "This looks amazing!" (but too good to be true)
- Aspirational, magazine-quality
- The kind of listing photo that gets you excited

NO: Dark corners, any imperfections, realistic shadows, normal lighting, personal items`,
    aspectRatio: '4:3'
  },
  {
    id: 'reality-dark-corner',
    filename: 'reality-dark-corner.png',
    description: 'Reality photo: Dark corner the listing hid',
    prompt: `Create a realistic photograph showing a disappointing corner of a Spanish apartment - what the listing photo hid.

SCENE:
- The corner of a Spanish apartment living room
- Taken with a normal phone camera (not professional)
- Natural lighting revealing the truth

THE REALITY:
- This corner is much darker than the listing suggested
- North-facing window, limited natural light
- Walls look more grey/beige than the bright white in listing
- Some wear visible on the walls
- The room feels smaller than in the listing photos

ISSUES VISIBLE:
- Shadows the professional photo avoided
- Paint slightly discolored in corners
- Maybe a small crack or imperfection
- The ceiling looks lower than expected
- Dated electrical outlets visible

PHOTOGRAPHY STYLE:
- Phone camera quality
- Slightly uneven exposure
- Natural, unedited look
- The kind of photo you'd take during a viewing
- Honest, showing the real space

MOOD:
- "Oh, it's not as bright as I thought"
- The slight disappointment of reality
- Still liveable, but different from listing

NO: Professional photography, perfect lighting, HDR, staging`,
    aspectRatio: '4:3'
  },
  {
    id: 'reality-water-stain',
    filename: 'reality-water-stain.png',
    description: 'Reality photo: Water stain the listing hid',
    prompt: `Create a realistic photograph of a ceiling/wall corner showing a water stain - something the listing photo cropped out.

SCENE:
- Looking up at a ceiling corner of a Spanish apartment
- Taken with phone camera during a viewing
- Natural daylight

THE ISSUE:
- A yellowish-brown water stain on the ceiling or upper wall
- Could be from a past leak or ongoing humidity issue
- The kind of thing that makes you wonder about the building
- Not catastrophic, but concerning

DETAILS:
- Stain has irregular edges, organic shape
- Some discoloration radiating from the main spot
- Maybe slight bubbling or peeling paint nearby
- The rest of the ceiling/wall looks okay but older

SURROUNDINGS:
- Period molding or cornice (typical Barcelona)
- White ceiling showing its age
- Natural shadows from window light
- Maybe a light fixture partially visible

PHOTOGRAPHY:
- Phone camera, slightly awkward angle (looking up)
- The kind of photo you'd text to a friend: "look at this..."
- Natural exposure, not perfect
- Documentary style

MOOD:
- "Should I be worried about this?"
- The discovery during a viewing that gives you pause
- Red flag or dealbreaker material

NO: Professional photo, dramatic lighting, extreme damage, pristine surfaces`,
    aspectRatio: '4:3'
  },
  {
    id: 'reality-street-view',
    filename: 'reality-street-view.png',
    description: 'Reality photo: Street view from window showing busy road',
    prompt: `Create a realistic photograph of the view from an apartment window in Barcelona, showing a busier street than expected.

SCENE:
- Looking out a window from inside a Spanish apartment
- Phone camera photo during a viewing
- Daytime, normal urban lighting

THE VIEW:
- The street below is busier/louder than expected
- Traffic visible - cars, maybe a bus
- Commercial activity at street level (shops, restaurant terraces)
- Other apartment buildings close by
- Less charming than the listing implied

WINDOW FRAME:
- Typical Barcelona window with wooden frame or persianas
- View framed by the window edges
- Interior slightly visible (curtain edge, wall)

STREET DETAILS:
- Parked cars, moving traffic
- Restaurant terrace with umbrellas/tables
- People walking on narrow sidewalk
- Maybe garbage bins or street furniture visible
- Signs that this is a busy, loud street

PHOTOGRAPHY:
- Phone camera through glass
- Some reflections maybe visible
- Natural, unedited look
- Documentary "this is what I saw" style

MOOD:
- "It's noisier than I expected"
- The reality of urban living in Barcelona
- Making you wonder about night noise

NO: Charming quiet street, professional photo, idyllic view, perfect lighting`,
    aspectRatio: '4:3'
  },
  {
    id: 'reality-nice-light',
    filename: 'reality-nice-light.png',
    description: 'Reality photo: The one good thing - nice morning light',
    prompt: `Create a realistic photograph showing genuinely beautiful morning light in a Spanish apartment.

SCENE:
- A corner of a Spanish apartment bedroom or living room
- Morning light streaming through the window beautifully
- Simple, honest view of the space
- The silver lining of the viewing

THE GOOD PART:
- Genuine, beautiful morning sunlight
- Light making warm patterns on terracotta floor or white walls
- The room actually does have good natural light
- East-facing window catching morning sun
- Soft shadows from window frame or shutters

REALISTIC TOUCHES:
- The room isn't perfect (some wear visible)
- Not professionally staged
- Normal furniture - maybe a simple wooden chair or small table in the light
- But the LIGHT is genuinely lovely and warm

COMPOSITION:
- Focus on the light itself - the way it falls into the room
- Empty or minimal furniture lets the light be the subject
- No people, no devices
- Just the beautiful, honest morning light

MOOD:
- "Ok, this part is actually nice"
- Peaceful, warm, inviting
- Makes you consider the place despite other issues

NO: Professional staging, people, phones, devices, perfect room, HDR photography`,
    aspectRatio: '4:3'
  },
  {
    id: 'property-card-apartment',
    filename: 'property-card-apartment.png',
    description: 'Property card: Beautiful apartment thumbnail for listings',
    prompt: `Create a thumbnail photograph of a beautiful Barcelona apartment interior, suitable for a property listing card.

THIS IS FOR A LISTING THUMBNAIL:
- Show the best angle of a living room
- Inviting, warm, makes you want to click
- High quality but not overly staged

SCENE:
- Living room of a renovated Barcelona apartment
- High ceilings with period details
- Natural light from tall windows
- Tasteful modern-Mediterranean decor
- Warm, inviting atmosphere

KEY ELEMENTS:
- Herringbone or terracotta floors
- White walls with some warmth
- Comfortable sofa and plants
- Balcony or tall windows visible
- Hints of character (moldings, original features)

PHOTOGRAPHY:
- Good quality real estate photo
- Well-lit, balanced exposure
- Slightly wide angle but not extreme
- Shows the potential of the space

MOOD:
- "I want to see this place"
- Aspirational but believable
- The kind of photo that gets clicks
- 94% fit energy

NO: Over-staging, fish-eye distortion, dark corners, dated furniture`,
    aspectRatio: '4:3'
  },
  // ===== ORIGINAL GENERAL IMAGES =====
  {
    id: 'hero-barcelona',
    filename: 'hero-barcelona-aerial.png',
    description: 'Hero background: Stylized aerial Barcelona illustration',
    prompt: `Create a stylized, artistic aerial illustration of Barcelona, Spain.

STYLE:
- Soft, dreamy watercolor or gouache aesthetic
- Warm Mediterranean color palette: terracotta roofs, sandy beige buildings, azure sea
- Golden hour lighting with soft shadows
- Semi-abstract, not photorealistic - like an elegant travel poster or editorial illustration
- Gentle, calming mood - NOT busy or overwhelming

COMPOSITION:
- Bird's eye view looking down at the Eixample district's famous octagonal grid blocks
- Show the distinctive chamfered corners of Barcelona blocks (chaflanes)
- Include hints of: La Rambla as a green tree-lined avenue, glimpses of the Mediterranean coastline on one edge
- Sagrada Familia as a small recognizable silhouette in the distance
- Parks appear as soft green patches

COLOR:
- Dominant: warm terracotta oranges and sandy yellows for rooftops
- Accent: deep Mediterranean blue for sea glimpses
- Soft sage greens for tree-lined streets and parks
- Cream/beige for building facades
- Subtle coral and pink tones in the sky

MOOD:
- Inviting, warm, peaceful
- A city you want to live in
- Aspirational but approachable

NO: Harsh shadows, photorealistic details, cars/traffic, clutter, text, logos, watermarks`,
    aspectRatio: '16:9'
  },
  {
    id: 'interior-apartment',
    filename: 'interior-spanish-apartment.png',
    description: 'Interior lifestyle shot (Spanish apartment, natural light)',
    prompt: `Create a beautiful interior photograph of a typical Spanish apartment living room.

SETTING:
- A bright, airy living room in a renovated Barcelona apartment
- High ceilings with original moldings (molduras)
- Large windows or balcony doors letting in abundant natural light
- Herringbone wood floors (parquet) or traditional terracotta tiles
- Whitewashed walls with subtle warmth

FURNITURE & STYLING:
- Mix of modern and mid-century pieces
- Comfortable linen sofa in neutral tones
- A few plants adding life (monstera, olive tree, fiddle leaf)
- Artful but minimal decoration - a few ceramics, books, art
- No clutter - curated, intentional

LIGHTING:
- Soft, diffused natural daylight streaming through windows
- Golden afternoon light creating gentle warmth
- Some areas in soft shadow for depth
- NO harsh direct sunlight

MOOD:
- "This could be my home" - aspirational but achievable
- Peaceful, calm, livable
- Mediterranean lifestyle feeling
- Ready to move in

COMPOSITION:
- Wide angle showing the flow of the space
- Slight angle, not straight-on
- Show some architectural detail (windows, doors, moldings)

NO: People, pets, TV screens, visible logos, mess, overly styled magazine look, harsh contrast`,
    aspectRatio: '16:9'
  },
  {
    id: 'street-neighborhood',
    filename: 'street-spanish-neighborhood.png',
    description: 'Street/neighbourhood shot (walkable Spanish street, golden light)',
    prompt: `Create a charming street scene from a walkable Spanish neighborhood.

SETTING:
- A quiet residential street in Barcelona's Gràcia or Poble Sec neighborhood
- Narrow pedestrian-friendly street with small shops at ground level
- Traditional 4-5 story apartment buildings with wrought iron balconies
- Trees providing dappled shade
- Maybe a small plaza visible in the distance

DETAILS:
- Colorful building facades: terracotta, ochre, dusty pink, sage green
- Window boxes with geraniums
- A few outdoor café tables (empty or with blurred figures)
- Cobblestone or patterned tile sidewalk
- Laundry hanging from some balconies (authentic touch)
- Street lamps (farolas) in classic style

LIGHTING:
- Golden hour - late afternoon warm light
- Long soft shadows
- Warm glow on building facades
- Inviting, romantic lighting

MOOD:
- "I want to walk down this street"
- Neighborhood feel, not touristy
- Safe, livable, charming
- The kind of street where you'd know your neighbors

COMPOSITION:
- Looking down the street (one-point perspective)
- Buildings framing both sides
- Sky visible above
- Some depth/distance

NO: Crowds, cars, motorcycles prominently featured, graffiti, trash, harsh midday light, tourist shops`,
    aspectRatio: '4:3'
  },
  {
    id: 'building-facade',
    filename: 'building-spanish-facade.png',
    description: 'Building façade (typical Spanish apartment block)',
    prompt: `Create an image of a beautiful Spanish apartment building facade.

BUILDING:
- Classic Barcelona apartment building, 5-6 stories
- Mix of Modernista and traditional elements
- Ornate wrought iron balconies (French balconies) on every floor
- Large windows with wooden shutters (persianas)
- Ground floor with an elegant entrance (portal) and possibly a small shop
- Rooftop with traditional terrace visible

ARCHITECTURAL DETAILS:
- Decorative cornices and moldings
- Floral or geometric relief work between floors
- Original wooden shutters, some open, some closed
- Mix of window styles adds character
- Maybe a small turret or corner detail on top floor

COLOR & MATERIAL:
- Warm ochre, dusty rose, or cream facade
- Dark green or deep blue shutters
- Wrought iron in black with some patina
- Stone or marble entrance surround
- Terracotta or patterned tiles visible on penthouse terrace

LIGHTING:
- Warm afternoon light on the facade
- Some balconies in soft shadow
- Light catching the ironwork details
- Blue sky with perhaps a few soft clouds

MOOD:
- Elegant but approachable
- Well-maintained but with character
- "I'd love to live here"
- Timeless architecture

COMPOSITION:
- Slight upward angle from street level
- Include some of the street to ground it
- Full building visible or artistic crop
- Maybe a tree branch framing one corner

NO: People on balconies, visible air conditioning units, ugly additions, signs, graffiti, harsh shadows`,
    aspectRatio: '3:4'
  },
  {
    id: 'agent-workspace',
    filename: 'agent-calm-workspace.png',
    description: 'Work scene (agent at laptop, calm workspace)',
    prompt: `Create a serene workspace scene showing a professional working environment.

SETTING:
- Clean, modern home office or light-filled co-working space
- Large desk with laptop open
- Professional but warm environment
- Natural materials: wood desk, leather chair details

PERSON (subtle, not the focus):
- Professional person (can be any gender/ethnicity) seen from behind or side
- Working at laptop, relaxed posture
- Dressed casually professional
- NOT the hero of the image - the workspace is

WORKSPACE DETAILS:
- Laptop screen showing a clean dashboard or interface (blurred/generic)
- A coffee cup or water glass
- Maybe a small plant
- Minimal papers or notes
- Quality headphones or earbuds visible
- Natural light from a window

LIGHTING:
- Soft, diffused daylight
- Clean, bright but not harsh
- Warm undertones
- Productive, focused atmosphere

MOOD:
- "Work that feels good"
- Calm productivity
- Professional without corporate sterility
- The kind of workspace you'd want

COMPOSITION:
- Wide shot showing the environment
- Person occupies maybe 30% of frame
- Depth showing the room/space
- Clean, uncluttered composition

NO: Cluttered desk, multiple monitors, corporate office aesthetic, harsh fluorescent light, stock photo energy, direct face shots`,
    aspectRatio: '16:9'
  },
  {
    id: 'city-skyline',
    filename: 'city-skyline-relocation.png',
    description: 'City skyline for Relocation section',
    prompt: `Create a panoramic city skyline illustration for relocation/moving context.

CONCEPT:
- Stylized cityscape showing a welcoming destination city
- Barcelona-inspired but could represent any Mediterranean city
- Feeling of "arriving somewhere new"

STYLE:
- Illustrated/stylized, not photorealistic
- Similar aesthetic to high-end editorial or brand illustration
- Clean lines with soft color fills
- Slightly geometric/modern interpretation

ELEMENTS:
- Skyline silhouette with recognizable but abstracted landmarks
- Mix of historic (church spires, traditional rooftops) and modern (glass towers)
- Hills or mountains in the background (like Collserola/Tibidabo)
- Sea or water on one edge
- Small airplanes or clouds suggesting travel/arrival

COLOR PALETTE:
- Gradient sky: soft coral/peach to light blue
- Buildings in warm neutrals: terracotta, sand, cream
- Modern buildings in soft blue-grey
- Green hills in sage/olive
- Sea in calm teal

LIGHTING:
- Early morning or golden hour feeling
- Optimistic, new-beginning energy
- Soft, welcoming light

MOOD:
- "Your new chapter starts here"
- Exciting but not overwhelming
- Opportunity and possibility
- Welcoming, not intimidating

COMPOSITION:
- Horizontal panorama
- City in lower 2/3, expansive sky above
- Sense of scale but not overwhelming detail
- Clean, breathing room

NO: Photorealism, dark colors, night scene, dystopian vibes, clutter, text, logos`,
    aspectRatio: '16:9'
  }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { imageId } = body;

    // Determine which images to generate
    const imagesToGenerate = imageId 
      ? LANDING_IMAGE_PROMPTS.filter(p => p.id === imageId)
      : LANDING_IMAGE_PROMPTS;

    if (imagesToGenerate.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'invalid_image_id',
        details: `Image ID "${imageId}" not found. Valid IDs: ${LANDING_IMAGE_PROMPTS.map(p => p.id).join(', ')}`
      }, { status: 400 });
    }

    console.log(`🎨 Generating ${imagesToGenerate.length} landing page images...`);

    const results: Array<{ id: string; filename: string; success: boolean; error?: string; base64?: string }> = [];
    const modelName = getModelForTask('visuals.render');

    for (const imagePrompt of imagesToGenerate) {
      console.log(`\n📸 Generating: ${imagePrompt.id} - ${imagePrompt.description}`);

      try {
        const result = await callGeminiRest(imagePrompt.prompt, {
          model: modelName,
          generateImages: true,
          temperature: 1,
          topP: 0.95,
          maxOutputTokens: 32768,
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: imagePrompt.aspectRatio,
            imageSize: '4K',
            imageOutputOptions: {
              mimeType: 'image/png'
            },
            personGeneration: 'ALLOW_ALL'
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
          ]
        });

        if (!result.success || !result.images || result.images.length === 0) {
          console.error(`❌ Failed to generate ${imagePrompt.id}:`, result.error);
          results.push({
            id: imagePrompt.id,
            filename: imagePrompt.filename,
            success: false,
            error: result.error ? JSON.stringify(result.error) : 'No image generated'
          });
          continue;
        }

        const imageBase64 = result.images[0].data;
        
        // Save to public/images/landing/
        const publicDir = path.join(process.cwd(), 'public', 'images', 'landing');
        
        // Ensure directory exists
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }

        const filePath = path.join(publicDir, imagePrompt.filename);
        fs.writeFileSync(filePath, Buffer.from(imageBase64, 'base64'));

        console.log(`✅ Saved: ${imagePrompt.filename}`);

        results.push({
          id: imagePrompt.id,
          filename: imagePrompt.filename,
          success: true,
          base64: imageBase64.substring(0, 100) + '...' // Preview only
        });

      } catch (error: any) {
        console.error(`❌ Error generating ${imagePrompt.id}:`, error);
        results.push({
          id: imagePrompt.id,
          filename: imagePrompt.filename,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n🏁 Complete: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      success: failCount === 0,
      generated: successCount,
      failed: failCount,
      total: imagesToGenerate.length,
      results: results.map(r => ({
        id: r.id,
        filename: r.filename,
        success: r.success,
        error: r.error,
        path: r.success ? `/images/landing/${r.filename}` : undefined
      })),
      model: modelName
    });

  } catch (error: any) {
    console.error('❌ Landing image generation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'generation_failed',
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to list available image prompts
export async function GET() {
  return NextResponse.json({
    availableImages: LANDING_IMAGE_PROMPTS.map(p => ({
      id: p.id,
      filename: p.filename,
      description: p.description,
      aspectRatio: p.aspectRatio
    })),
    usage: 'POST /api/landing/generate-images with optional { imageId: "hero-barcelona" } to generate specific image'
  });
}


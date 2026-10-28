# UI ASCII Designs + Analytics Tracking Plan

**Last Updated**: December 1, 2024

---

## 📱 NON-PRO USER FLOW

### 0. Homepage (Already Exists)

We have a homepage at `src/app/[lang]/LandingPageClient.tsx`. User clicks main CTA → goes to signup/intake flow.

**Analytics Event**: `cta_clicked` (with `cta_type: 'comprar' | 'alquilar' | 'hablar'`)

---

### 1. Signup (Supabase Auth)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                    [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         🏠 Crear cuenta                                │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│                    [G  Continuar con Google]                           │
│                                                                         │
│                    [   Continuar con Apple]                           │
│                                                                         │
│        ─────────────────── o ───────────────────                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │   Email                                                             ││
│  │   [_________________________________________________]              ││
│  │                                                                     ││
│  │   Contraseña                                                        ││
│  │   [_________________________________________________]              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│                    [Crear cuenta →]                                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│        ¿Ya tienes cuenta? [Iniciar sesión]                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `signup_page_viewed`
- `signup_method_clicked` (with `method: 'google' | 'apple' | 'email'`)
- `signup_completed`

---

### 2. Intake Conversation (Post-Signup)

After signup → straight to Leo conversation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏠 Leo                                                         [···]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│                    ┌─────────────────────────────┐                     │
│                    │                             │                     │
│                    │      [Leo's Avatar]         │                     │
│                    │                             │                     │
│                    │      ● ● ● speaking...      │                     │
│                    │                             │                     │
│                    └─────────────────────────────┘                     │
│                                                                         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  "Hola! Soy Leo. Cuéntame, ¿estás buscando comprar o alquilar?"       │
│                                                                         │
│                                                                         │
│                                                                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         [🎤 Pulsa para hablar]                         │
│                                                                         │
│                    ─── o escribe ───                                   │
│                                                                         │
│                    [💬 Prefiero escribir]                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `intake_started`
- `intake_mode_selected` (with `mode: 'voice' | 'text'`)

---

### 3. End of Intake: WhatsApp Ask

Leo asks at END of conversation (not a separate page):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏠 Leo                                                         [···]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ...                                                                    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 🏠 "Perfecto, ya tengo todo lo que necesito. He encontrado│          │
│  │     algunas zonas que creo que te van a encantar.         │          │
│  │                                                            │          │
│  │     ¿Quieres que te avise por WhatsApp cuando encuentre   │          │
│  │     pisos que encajen contigo?"                           │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │   📱 Tu número de WhatsApp                                          ││
│  │                                                                     ││
│  │   🇪🇸 +34  [_________________________]                              ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│      [Activar alertas WhatsApp]        [Ahora no, quizás luego]        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**WhatsApp flow**:
- If we already have their number (from Google auth phone?) → just confirm
- If not → ask for it
- "Ahora no" → skip, can add later in Settings
- Reminder popup shown occasionally (non-intrusive)

**Analytics Events**:
- `intake_completed`
- `whatsapp_prompt_shown`
- `whatsapp_submitted` / `whatsapp_skipped`

---

### 4. Profile Page (via Sidebar)

Separate from Account Settings. Shows our understanding of them + isochrone map.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [≡]  Mi Perfil                                              [⚙️]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ⚠️ NECESITAMOS MÁS INFO                                          │   │
│  │                                                                   │   │
│  │ Tu llamada se cortó antes de terminar. Cuéntame más sobre       │   │
│  │ tu presupuesto y zonas preferidas.                               │   │
│  │                                                                   │   │
│  │ [🎤 Continuar conversación]                                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  👤 MARÍA GARCÍA                                                       │
│     Buscando comprar en Barcelona                                       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📋 LO QUE ENTENDÍ                                                   ││
│  │                                                                     ││
│  │ "María busca un piso de 3 habitaciones cerca de su trabajo en      ││
│  │  Diagonal. Presupuesto máximo €350k. Prioriza luz natural y        ││
│  │  tranquilidad. Abierta a reformar si el precio lo justifica.       ││
│  │  Evitar plantas bajas y zonas muy turísticas."                     ││
│  │                                                                     ││
│  │ ¿Algo ha cambiado? [🎤 Actualizar con Leo]                         ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🗺️ TUS ZONAS                                                        ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │                                                             │   ││
│  │  │     [    ISOCHRONE MAP    ]                                 │   ││
│  │  │                                                             │   ││
│  │  │     🟢 Sweet Spot (15 min)                                  │   ││
│  │  │     🟡 Opportunity Areas (20-25 min)                        │   ││
│  │  │     📍 Tu trabajo                                           │   ││
│  │  │                                                             │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  Sweet Spot: Eixample, Gràcia, Sant Gervasi                        ││
│  │  Opportunity: Horta, Sarrià, Les Corts                             ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🎯 CRITERIOS                                                  [v]  ││
│  │                                                                     ││
│  │ • Presupuesto: €280k - €350k                                        ││
│  │ • Habitaciones: 3 mínimo                                            ││
│  │ • Commute: <20 min a Diagonal                                       ││
│  │ • Prioridades: Luz, tranquilidad                                    ││
│  │ • Evitar: Planta baja, turístico                                    ││
│  │ • Reforma: Abierta si buen precio                                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Sidebar with notification badge**:
```
┌──────────────────────┐
│  🏠 Leo              │
├──────────────────────┤
│                      │
│  📋 Mis pisos        │
│                      │
│  👤 Mi perfil  🔴    │  ← Badge if action needed
│                      │
│  ⚙️ Ajustes          │
│                      │
└──────────────────────┘
```

**Analytics Events**:
- `profile_page_viewed`
- `profile_needs_info_shown`
- `profile_update_conversation_started`
- `profile_isochrone_viewed`

---

### 5. WhatsApp Reminder Popup (Non-Intrusive)

Shown occasionally if they skipped WhatsApp signup:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │                                                      [×]  │          │
│  │  📱 ¿Quieres alertas por WhatsApp?                        │          │
│  │                                                           │          │
│  │  Te aviso cuando encuentre pisos que encajen contigo.    │          │
│  │  Sin spam, solo lo bueno.                                 │          │
│  │                                                           │          │
│  │  [Añadir WhatsApp]           [Ahora no]                  │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `whatsapp_reminder_shown`
- `whatsapp_reminder_clicked` / `whatsapp_reminder_dismissed`

---

### 7a. Email Alert

```
┌─────────────────────────────────────────────────────────────────────────┐
│  From: Leo <operator@example.invalid>                                              │
│  Subject: 🏠 3 pisos nuevos que encajan contigo                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Hola María,                                                            │
│                                                                         │
│  He encontrado 3 pisos que creo que te van a gustar:                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  [📷][📷][📷]                                                       ││
│  │                                                                     ││
│  │  Gran Via 42, Fort Pienc                                            ││
│  │  85m² • 3 hab • €285,000                                            ││
│  │                                                                     ││
│  │  ████████░░ 78% match                                               ││
│  │  "Buen potencial, algo ruidoso"                                     ││
│  │                                                                     ││
│  │  [Ver análisis completo →]                                          ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  [📷][📷][📷]                                                       ││
│  │  Carrer Balmes 156, Eixample                                        ││
│  │  92m² • 3 hab • €320,000                                            ││
│  │  ██████████ 91% match                                               ││
│  │  "Excelente estado, listo para entrar"                              ││
│  │  [Ver análisis completo →]                                          ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ¿Quieres cambiar lo que buscas? [Actualizar preferencias]             │
│  ¿Ya no quieres recibir alertas? [Darme de baja]                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `alert_sent` (server-side)
- `alert_opened` (email tracking pixel)
- `alert_property_clicked` (with `listing_id`, `position`)

---

### 7b. WhatsApp Alert

```
┌─────────────────────────────────────────────────────────────────────────┐
│  💬 WhatsApp                                              Leo 🏠       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 🏠 ¡Hola María! He encontrado 3 pisos que te pueden       │          │
│  │ interesar:                                                 │          │
│  │                                                            │          │
│  │ 1️⃣ Gran Via 42 — 78% match                                │          │
│  │    85m² • 3 hab • €285k                                   │          │
│  │    "Buen potencial, algo ruidoso"                         │          │
│  │                                                            │          │
│  │ 2️⃣ Balmes 156 — 91% match ⭐                              │          │
│  │    92m² • 3 hab • €320k                                   │          │
│  │    "Excelente estado"                                     │          │
│  │                                                            │          │
│  │ 3️⃣ Pau Claris 89 — 74% match                             │          │
│  │    78m² • 2 hab • €265k                                   │          │
│  │    "Reformado, sin terraza"                               │          │
│  │                                                            │          │
│  │ 👉 Ver todos: leo.casa/mis-pisos                          │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                            10:34 ✓✓     │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ [📷 Gran Via exterior]                                    │          │
│  │ [📷 Gran Via salón]                                       │          │
│  │ [📷 Gran Via cocina]                                      │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                            10:34 ✓✓     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `whatsapp_alert_sent`
- `whatsapp_link_clicked` (via redirect tracking)

---

### 8. Property Page — Fit Score View

**Design note**: Use-0]o'hgrfbvewfdq1e2 the photo carousel + listing display from `src/app/admin/add-property/` — it's already polished.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Mis pisos                                          [♡] [📤]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │    [◀]  [        PHOTO CAROUSEL        ]  [▶]                      ││
│  │                                                                     ││
│  │                      ● ○ ○ ○ ○ ○ ○ ○                                ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Gran Via de les Corts Catalanes 42                                    │
│  Fort Pienc, Barcelona                                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  85m²    │    3 hab    │    1 baño    │    1ª planta    │   Ascensor││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  💰 €285,000                                              €3,353/m²    │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  TU FIT SCORE                                                       ││
│  │                                                                     ││
│  │  ████████░░  78%                                                    ││
│  │                                                                     ││
│  │  ✓ POR QUÉ ENCAJA                                                   ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │  • A 12 min de tu trabajo en metro                                  ││
│  │  • 3 habitaciones como pediste                                      ││
│  │  • Tiene terraza exterior                                           ││
│  │  • Precio dentro de tu rango                                        ││
│  │                                                                     ││
│  │  ⚠️ A TENER EN CUENTA                                               ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │  • Gran Via puede ser ruidosa                                       ││
│  │  • Necesita reforma integral                                        ││
│  │  • 1ª planta = posibles problemas de bajantes                       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  [🏠 Quiero verlo]              [❌ No me interesa]                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `property_page_viewed` (with `listing_id`, `fit_score`, `source`)
- `property_gallery_swiped`
- `quiero_verlo_clicked` ⭐
- `not_interested_clicked`

---

### 9. "Quiero Verlo" → Button Transforms to Contact

**No modal** — the button transforms in place:

**BEFORE click:**
```
│  [🏠 Quiero verlo]              [❌ No me interesa]                    │
```

**AFTER click:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ✓ Añadido a tu shortlist                                              │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📞 CONTACTA AL AGENTE                                                  │
│                                                                         │
│  Inmobiliaria Tecnocasa • Fort Pienc                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │              📱 +34 612 345 678                                     ││
│  │                                                                     ││
│  │      [💬 WhatsApp]                    [📋 Copiar]                  ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  💡 Cuando vayas a la visita, vuelve aquí para tomar notas.           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**WhatsApp preloaded message** (includes 1-liner about user to build agent trust):

```
"Hola, soy María García. Estoy buscando un piso de 3 habitaciones 
cerca del centro de Barcelona y me interesa el de Gran Via 42. 
¿Podríamos concertar una visita? Gracias!"
```

The 1-liner comes from their profile summary — builds credibility with agent.

**Analytics Events**:
- `quiero_verlo_clicked` → button transforms
- `whatsapp_agent_clicked` ⭐ (with preloaded message)
- `copy_phone_clicked`

---

### 10. Shortlist Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Inicio                                                    [⚙️]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         📋 MI SHORTLIST                                │
│                         3 pisos para ver                                │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [📷]  Gran Via 42                                                   ││
│  │       Fort Pienc • 85m² • €285k                                     ││
│  │       ████████░░ 78%                                                ││
│  │                                                                     ││
│  │       Añadido hace 2 días                                           ││
│  │                                                                     ││
│  │       [📝 Tomar notas]                      [📞 Ver contacto]      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [📷]  Balmes 156                                    ✓ NOTAS        ││
│  │       Eixample • 92m² • €320k                                       ││
│  │       ██████████ 91%  →  ████████░░ 79%                            ││
│  │                                                                     ││
│  │       Visitado hace 1 día • 4 notas                                 ││
│  │                                                                     ││
│  │       [📝 Ver notas]                        [📊 Ver resumen]       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [📷]  Pau Claris 89                                                 ││
│  │       Eixample • 78m² • €265k                                       ││
│  │       ███████░░░ 74%                                                ││
│  │                                                                     ││
│  │       Añadido hoy                                                   ││
│  │                                                                     ││
│  │       [📝 Tomar notas]                      [📞 Ver contacto]      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `shortlist_viewed` (with `count`)
- `shortlist_property_clicked` (with `listing_id`, `action: 'notes' | 'contact' | 'summary'`)

---

### 11. Viewing Mode — Note Taking

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Gran Via 42                                         [Ver checklist] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                     📝 NOTAS DE LA VISITA                              │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 💬 "El agente dice que la ITE está pasada pero no        │          │
│  │     tiene el papel aquí, lo envía mañana"                │          │
│  │                                              10:34 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 📷 [Photo: grieta en techo salón]                        │          │
│  │                                              10:36 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 💬 "La vecina del 2º muy maja, el presidente de la       │          │
│  │     comunidad es un pesado según ella"                   │          │
│  │                                              10:38 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 🎤 0:12 ▶️ "El ruido de la Gran Via es bastante..."      │          │
│  │                                              10:41 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 💬 "El baño pequeño huele raro, como a humedad"          │          │
│  │                                              10:45 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [📷]  [🎤]  [💬 Escribe una nota...]                                  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│                    [✓ He terminado la visita]                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `viewing_started` (with `listing_id`)
- `note_added` (with `type: 'text' | 'voice' | 'photo'`)
- `viewing_completed` ⭐

---

### 12. Post-Viewing Reassessment

---

### 13. Account Settings — Billing (B2C)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [≡]  Ajustes                                              [←]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 💳 FACTURACIÓN Y SUSCRIPCIÓN                                        ││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Plan actual:                                                       ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 🏠 Plan Básico                                                  │││
│  │  │                                                                 │││
│  │  │ ✅ Recomendaciones ilimitadas                                   │││
│  │  │ ✅ Alertas por WhatsApp/Email                                   │││
│  │  │ ✅ Análisis de propiedades                                      │││
│  │  │                                                                 │││
│  │  │ €9.99/mes • Renovación: 15 Dic 2024                            │││
│  │  │                                                                 │││
│  │  │ [Gestionar suscripción en Stripe →]                             │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Método de pago:                                                    ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 💳 •••• 4242                                                    │││
│  │  │     Expira: 12/25                                               │││
│  │  │                                                                 │││
│  │  │ [Actualizar método de pago →]                                   │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Historial de facturas:                                             ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 15 Nov 2024    €9.99    [Descargar PDF]                        │││
│  │  │ 15 Oct 2024    €9.99    [Descargar PDF]                        │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `billing_page_viewed`
- `manage_subscription_clicked` (opens Stripe Customer Portal)
- `update_payment_method_clicked` (opens Stripe Checkout)
- `invoice_downloaded`

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Gran Via 42                                               [📤]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    📊 VALORACIÓN ACTUALIZADA                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  FIT SCORE                                                          ││
│  │                                                                     ││
│  │  Antes:   ████████░░  78%                                           ││
│  │  Ahora:   ██████░░░░  62%   (−16)                                   ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📉 BAJÓ POR                                                   [v]  ││
│  │                                                                     ││
│  │ • Ruido peor de lo esperado (−10)                                   ││
│  │   Tu nota: "El ruido de la Gran Via es bastante..."                 ││
│  │                                                                     ││
│  │ • Grieta detectada (−6)                                             ││
│  │   [📷 Tu foto] → Posible problema estructural                       ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📈 MEJOR DE LO ESPERADO                                       [v]  ││
│  │                                                                     ││
│  │ • Luz natural (+3)                                                  ││
│  │   Mejor de lo que parecía en fotos                                  ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 💡 MI RECOMENDACIÓN                                                 ││
│  │                                                                     ││
│  │ "Puede valer la pena, pero negocia fuerte el precio                ││
│  │  por el ruido y pide un informe técnico de la grieta               ││
│  │  antes de ofertar."                                                 ││
│  │                                                                     ││
│  │ Oferta sugerida: €255k - €265k (vs €285k pedidos)                  ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  [📤 Compartir resumen]            [📋 Ver puntos para negociar]      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `reassessment_viewed` (with `score_before`, `score_after`, `score_change`)
- `reassessment_section_expanded` (with `section: 'decreased' | 'increased' | 'recommendation'`)
- `share_summary_clicked`
- `negotiation_points_clicked`

---

## 👔 PRO USER FLOW

### ⚠️ CRITICAL: Component Reuse for MVP

**Note-Taking Experience:**
- **Clients of pros use THE SAME note-taking UI as direct renters/buyers**
- **Pros can view their clients' notes in the same interface**
- **Reuse components** — don't build separate versions
- **Same viewing flow, same reassessment, same everything**

**Why:** MVP needs to be limber. One codebase, one set of components, works for everyone.

**Implementation:**
- Note-taking interface → same component for both direct users AND pro clients
- Notes display → same component for everyone
- Reassessment display → same component for everyone
- Only difference: Pro clients' notes are linked to their `client_id` in DB
- Pro can access via: `/pro/clients/[id]/viewings/[listing_id]` (read-only)

---

### 1. Pro Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [🏠 Leo Pro]                                    María García  [⚙️]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                                   │
│  │ 👥      │ │ 🏠      │ │ 📊      │                                   │
│  │ Clientes│ │ Pisos   │ │ Análisis│                                   │
│  │    5    │ │   23    │ │         │                                   │
│  └─────────┘ └─────────┘ └─────────┘                                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  🔔 NOTIFICACIONES                                                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ⭐ Juan Pérez quiere ver Gran Via 42                    hace 2h    ││
│  │    [Ver piso]  [Contactar agente]                                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📝 Ana López ha añadido 3 notas en Balmes 156          hace 1d    ││
│  │    [Ver notas]  [Ver resumen]                                       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  💡 Cuando haces clic en "Ver notas" → ves el MISMO componente        │
│     que tu cliente usó para tomar notas. Mismo diseño, misma UX.       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  👥 MIS CLIENTES                                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [👤] Juan Pérez         Comprando • Madrid • €300-400k             ││
│  │      3 pisos en shortlist • 1 pendiente de ver           [→]       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [👤] Ana López          Alquilando • Barcelona • €1.2-1.5k         ││
│  │      5 pisos en shortlist • 2 visitados                  [→]       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│                    [+ Añadir nuevo cliente]                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `pro_dashboard_viewed`
- `notification_clicked` (with `type`, `client_id`, `listing_id`)
- `client_card_clicked`
- `add_client_clicked`

---

### 2. Add New Client

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Dashboard                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                       + AÑADIR NUEVO CLIENTE                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  Nombre del cliente                                                 ││
│  │  [_________________________________________________]               ││
│  │                                                                     ││
│  │  Email                                                              ││
│  │  [_________________________________________________]               ││
│  │                                                                     ││
│  │  Teléfono (WhatsApp)                                                ││
│  │  🇪🇸 +34 [________________________________________]               ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ¿CÓMO QUIERES HACER LA ENTREVISTA?                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  [🎤 Yo hago la llamada]                                            ││
│  │                                                                     ││
│  │  Habla tú con Leo sobre tu cliente.                                 ││
│  │  Perfecto si ya conoces bien sus necesidades.                       ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  [📧 Enviar link al cliente]                                        ││
│  │                                                                     ││
│  │  Tu cliente habla directamente con Leo.                             ││
│  │  Recibirás un resumen cuando termine.                               ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `add_client_page_viewed`
- `client_created` (with `intake_method: 'pro_call' | 'client_link'`)
- `intake_link_sent`

---

### 3. Client Profile (with Lifestyle Summary)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Clientes                                      [📧] [📞] [⚙️]        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  👤 JUAN PÉREZ                                                         │
│     Comprando en Madrid                                                 │
│     Cliente desde: 15 Nov 2024                                          │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 📋 RESUMEN DE LO QUE BUSCA                                          ││
│  │                                                                     ││
│  │ "Juan busca un piso de 3 habitaciones en el centro de Madrid,      ││
│  │  máximo €400k. Trabaja en Atocha y quiere estar a menos de 20      ││
│  │  minutos. Tiene dos hijos pequeños así que prioriza colegios       ││
│  │  cerca y zonas tranquilas. No le importa reformar si el precio     ││
│  │  lo justifica. Flexible con el tamaño del salón pero necesita      ││
│  │  mínimo 2 baños."                                                   ││
│  │                                                                     ││
│  │  [Editar resumen]                                                   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 🎯 CRITERIOS CLAVE                                           [v]   ││
│  │                                                                     ││
│  │ • Presupuesto: €300k - €400k                                        ││
│  │ • Zona: Centro Madrid, Retiro, Salamanca                            ││
│  │ • Habitaciones: 3 mínimo                                            ││
│  │ • Baños: 2 mínimo                                                   ││
│  │ • Commute: <20 min a Atocha                                         ││
│  │ • Prioridades: Colegios, tranquilidad                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📋 SU SHORTLIST (3 pisos)                                             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ [📷] Gran Via 42       78%    ⭐ Quiere verlo   [→]      │          │
│  │ [📷] Balmes 156        91%    ✓ Analizado       [→]      │          │
│  │ [📷] Pau Claris        74%    [🔍 Analizar]      [→]      │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  [+ Añadir piso]                [📤 Enviar shortlist al cliente]       │
│                                                                         │
│  💡 Análisis gratis restantes: 2/3                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**"Enviar shortlist al cliente" button:**
- Generates secure shareable link: `leo.casa/shortlist/[token]`
- Token: UUID (not guessable, permanent)
- Pro can copy link or send via WhatsApp/Email
- Client can bookmark and use anytime
- No login required for client
- Client can take notes directly from shortlist

**"Analizar" button:**
- Only shown if property not yet analyzed
- Triggers WPA pipeline
- Counts against free tier (3 analyses)
- Shows progress modal

**Analytics Events**:
- `client_profile_viewed`
- `lifestyle_summary_expanded`
- `lifestyle_summary_edited`
- `client_shortlist_property_clicked`
- `add_property_clicked`
- `analyse_property_clicked` ⭐
- `send_shortlist_clicked` ⭐ (with `link_generated: boolean`)

---

### 3b. Client Shortlist (Secure Link - No Login)

When client opens `leo.casa/shortlist/[token]`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📋 TU SHORTLIST                                    [Compartir]        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Hola Juan, aquí están los pisos que hemos encontrado para ti:        │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [📷]  Gran Via 42                                                   ││
│  │       Fort Pienc • 85m² • €285k                                     ││
│  │       ████████░░ 78%                                                ││
│  │                                                                     ││
│  │       ⭐ Quieres verlo                                              ││
│  │                                                                     ││
│  │       [📝 Tomar notas]                      [📞 Ver contacto]      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [📷]  Balmes 156                                    ✓ NOTAS        ││
│  │       Eixample • 92m² • €320k                                       ││
│  │       ██████████ 91%  →  ████████░░ 79%                            ││
│  │                                                                     ││
│  │       Visitado hace 1 día • 4 notas                                 ││
│  │                                                                     ││
│  │       [📝 Ver notas]                        [📊 Ver resumen]       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key differences from direct user shortlist:**
- Shows "Hola [Name]" (personalized)
- Same note-taking interface
- Same property pages
- Pro can see everything (read-only)

**On viewing day:**
- Client opens shortlist link (bookmarked or from WhatsApp)
- Clicks property they're viewing
- Takes notes in real-time
- Pro gets notification when notes are added

**Analytics Events**:
- `client_shortlist_opened` (with `token`, `client_id`)
- `client_property_clicked` (with `listing_id`)
- `client_note_added` (with `listing_id`, `type`)

---

### 3c. Send Shortlist Link Modal

When pro clicks "📤 Enviar shortlist al cliente":

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                    [×]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    📤 ENVIAR SHORTLIST A JUAN                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Link de acceso:                                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  leo.casa/shortlist/                                   ││
│  │                                                                     ││
│  │  [📋 Copiar]                                                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Enviar por:                                                            │
│                                                                         │
│  [💬 WhatsApp]     [📧 Email]     [📋 Solo copiar]                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  💡 Este link es permanente. Tu cliente puede guardarlo y usarlo       │
│     cuando quiera. No necesita crear cuenta.                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**WhatsApp message:**
```
Hola Juan, aquí tienes tu shortlist con los pisos que hemos encontrado:

👉 leo.casa/shortlist/

Cuando vayas a ver alguno, puedes tomar notas directamente desde ahí.
```

**Analytics Events**:
- `send_shortlist_modal_shown`
- `shortlist_link_copied`
- `shortlist_link_sent_whatsapp`
- `shortlist_link_sent_email`

---

### 4a. Extension Popup — Not Logged In

```
┌─────────────────────────────────────┐
│  🏠 Leo Pro                    [×]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │      [🔒 Login Required]        ││
│  │                                 ││
│  │  Inicia sesión para añadir      ││
│  │  propiedades a tus clientes.    ││
│  │                                 ││
│  │  [Iniciar sesión →]             ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

### 4b. Extension Popup — Logged In

```
┌─────────────────────────────────────┐
│  🏠 Leo Pro                    [×]  │
├─────────────────────────────────────┤
│                                     │
│  Añadir este piso a:                │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [○] Juan Pérez                  ││
│  │     Comprando • Madrid          ││
│  │     ✓ 2/3 análisis gratis       ││
│  ├─────────────────────────────────┤│
│  │ [○] Ana López                   ││
│  │     Alquilando • Barcelona      ││
│  │     ⚠️ Sin análisis gratis     ││
│  └─────────────────────────────────┘│
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ ☑ Analizar automáticamente      ││
│  │   (recomendado para compras)    ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 💬 Nota para el cliente        ││
│  │                                 ││
│  │ [___________________________]   ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  [Añadir y analizar]                │
│                                     │
└─────────────────────────────────────┘
```

**Behavior:**
- ✅ Requires login (shows login prompt if not authenticated)
- ✅ Auto-analysis checkbox checked by default
- ✅ Shows remaining free analyses per client
- ✅ Auto-triggers WPA when added
- ✅ Counts against free tier (3 analyses)

**Analytics Events**:
- `extension_popup_opened`
- `extension_login_required_shown`
- `extension_login_clicked`
- `extension_property_added` (with `client_id`, `listing_url`, `source`, `auto_analyze: boolean`)

---

### 4c. Add Property Page (Pro)

When pro clicks "+ Añadir piso" → goes to this page with URL bar.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Juan Pérez                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ➕ AÑADIR PROPIEDAD                                  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Pega la URL del anuncio:                                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  https://www.idealista.com/inmueble/12345678/                       ││
│  │                                                                     ││
│  │  [Detectar automáticamente]                                         ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ☑ Analizar automáticamente                                          ││
│  │   (recomendado para compras)                                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  💡 Análisis gratis restantes: 2/3                                     │
│                                                                         │
│                    [Añadir y analizar →]                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Uses existing `ListingEditor` component from `/add-property`:**
- ✅ Already has URL bar with brand detection (chameleon UI)
- ✅ Already has ingestion logic for Idealista
- ✅ Already works perfectly for Idealista
- For other sites: Will connect to AWS ingestion rules (learns from scraping rules)

**Analytics Events**:
- `add_property_page_viewed`
- `property_url_pasted`
- `auto_detect_clicked`
- `add_property_submitted` (with `auto_analyze: boolean`, `url`)

---

### 5. Client Wants to View — Notification

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔔 NOTIFICACIÓN                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    ⭐ JUAN QUIERE VER UN PISO                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  [📷][📷][📷]                                                       ││
│  │                                                                     ││
│  │  Gran Via de les Corts Catalanes 42                                 ││
│  │  Fort Pienc, Barcelona                                              ││
│  │                                                                     ││
│  │  85m² • 3 hab • €285,000                                            ││
│  │  ████████░░ 78% match para Juan                                     ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  📞 CONTACTAR AL AGENTE                                                 │
│                                                                         │
│     Inmobiliaria Tecnocasa                                              │
│     📱 +34 612 345 678                                                 │
│                                                                         │
│     [💬 Abrir WhatsApp]     [📞 Llamar]                                │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│     [Ver perfil de Juan]     [Ver análisis del piso]                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `pro_notification_viewed` (with `type: 'client_wants_to_view'`)
- `pro_contact_agent_clicked` ⭐
- `pro_view_client_profile_clicked`
- `pro_view_property_analysis_clicked`

---

### 5b. Pro Views Client Notes (Same Component!)

When pro clicks "Ver notas" → sees the EXACT same note-taking interface their client used.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Ana López / Balmes 156                                    [📤]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    📝 NOTAS DE ANA EN LA VISITA                        │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 💬 "El agente dice que la ITE está pasada pero no        │          │
│  │     tiene el papel aquí, lo envía mañana"                │          │
│  │                                              10:34 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 📷 [Photo: grieta en techo salón]                        │          │
│  │                                              10:36 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ 💬 "La vecina del 2º muy maja, el presidente de la       │          │
│  │     comunidad es un pesado según ella"                   │          │
│  │                                              10:38 AM    │          │
│  └───────────────────────────────────────────────────────────┘          │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│                    [📊 Ver valoración actualizada]                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Point:** This is the SAME note-taking interface the client used, just in read-only mode for the pro. Same design, same layout, same everything.

**Analytics Events**:
- `pro_viewed_client_notes` (with `client_id`, `listing_id`)
- `pro_viewed_client_reassessment` (with `client_id`, `listing_id`)

---

### 6. Pro Account Settings — Billing

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [≡]  Ajustes                                              [←]         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 💳 FACTURACIÓN Y SUSCRIPCIÓN                                        ││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Plan actual:                                                       ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 👔 Personal Shopper Pro                                         │││
│  │  │                                                                 │││
│  │  │ ✅ Análisis ilimitados                                          │││
│  │  │ ✅ Extension ilimitada                                          │││
│  │  │ ✅ Recomendaciones para clientes                                 │││
│  │  │                                                                 │││
│  │  │ €49/mes • Renovación: 15 Dic 2024                               │││
│  │  │                                                                 │││
│  │  │ [Gestionar suscripción en Stripe →]                             │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Método de pago:                                                    ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 💳 •••• 4242                                                    │││
│  │  │     Expira: 12/25                                               │││
│  │  │                                                                 │││
│  │  │ [Actualizar método de pago →]                                   │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Historial de facturas:                                             ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 15 Nov 2024    €49.00    [Descargar PDF]                       │││
│  │  │ 15 Oct 2024    €49.00    [Descargar PDF]                       │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Analytics Events**:
- `pro_billing_page_viewed`
- `pro_manage_subscription_clicked`
- `pro_update_payment_method_clicked`
- `pro_invoice_downloaded`

---

## 📊 ANALYTICS TRACKING PLAN

### Event Schema

```typescript
interface AnalyticsEvent {
  event_name: string;
  timestamp: string;
  user_id?: string;
  session_id: string;
  
  // User context
  user_type: 'non_pro' | 'pro' | 'pro_client';
  pro_user_id?: string; // If user is a pro's client
  
  // Event-specific properties
  properties: Record<string, any>;
}
```

### Key Funnel Events

#### Non-Pro Funnel
| Step | Event | Key Properties |
|------|-------|----------------|
| 1 | `whatsapp_signup_submitted` | `email_also` |
| 2 | `alert_opened` | `alert_id`, `channel` |
| 3 | `alert_property_clicked` | `listing_id`, `position`, `fit_score` |
| 4 | `property_page_viewed` | `listing_id`, `fit_score`, `source` |
| 5 | `quiero_verlo_clicked` | `listing_id` |
| 6 | `whatsapp_agent_clicked` | `listing_id`, `agent_phone` |
| 7 | `shortlist_viewed` | `count` |
| 8 | `viewing_started` | `listing_id` |
| 9 | `note_added` | `listing_id`, `type`, `count` |
| 10 | `viewing_completed` | `listing_id`, `note_count` |
| 11 | `reassessment_viewed` | `listing_id`, `score_before`, `score_after` |

#### Pro Funnel
| Step | Event | Key Properties |
|------|-------|----------------|
| 1 | `client_created` | `intake_method` |
| 2 | `intake_completed` | `client_id`, `method` |
| 3 | `lifestyle_summary_viewed` | `client_id` |
| 4 | `extension_property_added` | `client_id`, `listing_url` |
| 5 | `recommendation_added_to_shortlist` | `client_id`, `listing_id` |
| 6 | `send_shortlist_clicked` | `client_id`, `count` |
| 7 | `pro_notification_viewed` | `type`, `client_id` |
| 8 | `pro_contact_agent_clicked` | `listing_id`, `client_id` |
| 9 | `client_note_added` | `client_id`, `listing_id` |
| 10 | `pro_viewed_client_notes` | `client_id`, `listing_id` |

### Dashboard Metrics

#### Non-Pro Dashboard
```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 NON-PRO FUNNEL                                     Last 7 days     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WhatsApp Signups     ████████████████████████████████████  124        │
│  Alerts Opened        ████████████████████████████░░░░░░░░   89 (72%)  │
│  Properties Clicked   ████████████████████░░░░░░░░░░░░░░░░   67 (75%)  │
│  "Quiero Verlo"       ████████████░░░░░░░░░░░░░░░░░░░░░░░░   34 (51%)  │
│  Notes Taken          █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░   21 (62%)  │
│  Viewing Completed    ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   15 (71%)  │
│                                                                         │
│  Drop-off point: Properties Clicked → Quiero Verlo (49% drop)          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Pro Dashboard
```
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 PRO FUNNEL                                         Last 7 days     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Clients Created      ████████████████████████████████████   18        │
│  Intakes Done         ████████████████████████████░░░░░░░░   14 (78%)  │
│    └─ Pro did call    ████████████████░░░░░░░░░░░░░░░░░░░░    9 (64%)  │
│    └─ Client link     ████████████░░░░░░░░░░░░░░░░░░░░░░░░    5 (36%)  │
│  Extension Used       ████████████████████░░░░░░░░░░░░░░░░   11 (79%)  │
│  Shortlist Sent       ████████████████░░░░░░░░░░░░░░░░░░░░    9 (82%)  │
│  Client Engaged       ████████████░░░░░░░░░░░░░░░░░░░░░░░░    7 (78%)  │
│  Notes Taken          ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░    5 (71%)  │
│                                                                         │
│  Drop-off point: Extension Used → Shortlist Sent (18% drop)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation: Supabase Tables

```sql
-- Analytics events table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- User context
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT NOT NULL,
  user_type TEXT, -- 'non_pro', 'pro', 'pro_client'
  pro_user_id UUID, -- If user is a pro's client
  
  -- Event properties (flexible JSONB)
  properties JSONB DEFAULT '{}',
  
  -- Indexing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_events_name ON analytics_events(event_name);
CREATE INDEX idx_events_user ON analytics_events(user_id);
CREATE INDEX idx_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_events_session ON analytics_events(session_id);

-- Funnel view for non-pro
CREATE VIEW non_pro_funnel AS
SELECT 
  DATE(timestamp) as date,
  COUNT(*) FILTER (WHERE event_name = 'whatsapp_signup_submitted') as signups,
  COUNT(*) FILTER (WHERE event_name = 'alert_opened') as alerts_opened,
  COUNT(*) FILTER (WHERE event_name = 'alert_property_clicked') as properties_clicked,
  COUNT(*) FILTER (WHERE event_name = 'quiero_verlo_clicked') as quiero_verlo,
  COUNT(*) FILTER (WHERE event_name = 'viewing_started') as viewings_started,
  COUNT(*) FILTER (WHERE event_name = 'note_added') as notes_added,
  COUNT(*) FILTER (WHERE event_name = 'viewing_completed') as viewings_completed
FROM analytics_events
WHERE user_type = 'non_pro'
GROUP BY DATE(timestamp);
```

### Client-Side Tracking Helper

```typescript
// lib/analytics.ts

export const track = async (
  eventName: string, 
  properties: Record<string, any> = {}
) => {
  const sessionId = getOrCreateSessionId();
  const userContext = await getUserContext();
  
  await fetch('/api/analytics/track', {
    method: 'POST',
    body: JSON.stringify({
      event_name: eventName,
      session_id: sessionId,
      user_type: userContext.userType,
      pro_user_id: userContext.proUserId,
      properties,
    }),
  });
};

// Usage
track('quiero_verlo_clicked', { listing_id: 123 });
track('note_added', { listing_id: 123, type: 'voice' });
```

---

## Changelog

| Date | Change |
|------|--------|
| Dec 1, 2024 | Initial UI ASCII designs for full flow |
| Dec 1, 2024 | Analytics tracking plan with funnel events |
| Dec 1, 2024 | Supabase schema for analytics |
| Dec 1, 2024 | **Homepage already exists** — #0 clarified |
| Dec 1, 2024 | **Signup flow** — Supabase Auth with social logins |
| Dec 1, 2024 | **WhatsApp ask moved to END of Leo call** — not separate page |
| Dec 1, 2024 | **Profile page (NEW)** — Shows isochrone, understanding, "needs more info" badge |
| Dec 1, 2024 | **WhatsApp reminder popup** — Non-intrusive, shown occasionally |
| Dec 1, 2024 | **"Quiero verlo" transforms button** — No modal, shows phone inline |
| Dec 1, 2024 | **WhatsApp message includes 1-liner** — About user to build agent trust |
| Dec 1, 2024 | **Property page design note** — Reference add-property component |
| Dec 1, 2024 | **Subscription model added** — See SUBSCRIPTION_AND_PAYMENTS.md |
| Dec 1, 2024 | **Extension requires login** — Shows login prompt if not authenticated |
| Dec 1, 2024 | **Auto-analysis via extension** — Checkbox checked by default |
| Dec 1, 2024 | **"Analizar" button for pros** — Manual trigger for unanalyzed properties |
| Dec 1, 2024 | **Add Property page for pros** — Uses same ingester as add-property |
| Dec 1, 2024 | **Billing sections** — B2C and Pro account settings with Stripe integration |
| Dec 1, 2024 | **Component reuse clarified** — Same note-taking UI for direct users AND pro clients |
| Dec 1, 2024 | **Pro viewing client notes** — Uses same component, read-only mode |


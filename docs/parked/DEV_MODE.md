# Dev Mode - Bypass Auth for Page Review

## Enable Dev Bypass

Add this line to your `.env.local` file:

```bash
NEXT_PUBLIC_DEV_BYPASS=true
```

Then restart the dev server:

```bash
npm run dev
```

## What it does

When enabled:
- **All protected pages** are accessible without login
- A **yellow "Dev Mode - Auth Bypassed"** banner appears in the bottom-left corner
- A **mock user** is injected with pro access
- Analytics still work (events are logged)

## Protected Pages Now Accessible

| Route | Description |
|-------|-------------|
| `/profile` | User profile page with preferences |
| `/shortlist` | User's saved property shortlist |
| `/pro/dashboard` | Pro user dashboard |
| `/pro/clients/new` | Add new client |
| `/pro/clients/[id]` | Client profile |

## Public Pages (No Auth Required)

| Route | Description |
|-------|-------------|
| `/auth/signin` | Sign in page |
| `/shortlist/[token]` | Public shortlist (shared via token) |
| `/viewing/[id]` | Viewing notes (works with or without auth) |

## Disable Dev Bypass

Remove the line or set to false:

```bash
NEXT_PUBLIC_DEV_BYPASS=false
```

Or just delete the line entirely.

## Security Note

⚠️ **Never enable this in production!** The bypass only works when:
- `NEXT_PUBLIC_DEV_BYPASS=true` AND
- `NODE_ENV=development`

Production builds will always require real authentication.


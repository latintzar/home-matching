# Self-Hosted Nominatim for Spain

Geocoding service for Leo's recommender system. Handles 100k+ address lookups per month.

## Quick Start

```bash
cd docker/nominatim
docker-compose up -d
```

**First run**: Downloads Spain OSM data (~1GB) and imports (~2-3 hours). 
**Subsequent runs**: Starts immediately.

## API Endpoints

Once running at `http://localhost:8080`:

### Forward Geocoding (Address → Coordinates)
```bash
curl "http://localhost:8080/search?q=Chamberí,Madrid,Spain&format=json&limit=5"
```

### Reverse Geocoding (Coordinates → Address)
```bash
curl "http://localhost:8080/reverse?lat=40.4168&lon=-3.7038&format=json"
```

### Status Check
```bash
curl "http://localhost:8080/status"
```

## Via Leo API

The `/api/geocode` endpoint automatically uses self-hosted if available:

```bash
# Forward
curl "http://localhost:3000/api/geocode?q=Chamberí,Madrid"

# Reverse  
curl "http://localhost:3000/api/geocode?lat=40.4168&lng=-3.7038"

# Status
curl "http://localhost:3000/api/geocode?status=true"
```

## Resource Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 2GB | 4GB |
| Disk | 50GB | 60GB |
| CPU | 2 cores | 4 cores |

## Production Instance (AWS)

| Property | Value |
|----------|-------|
| Instance | `i-0890cad762bc0c8c7` (c5.xlarge) |
| IP | `3.230.148.50:8080` |
| Storage | 150GB EBS |
| Data | Spain OSM (~70GB PostgreSQL) |

**Used by**: Lucas Fox, Century21, RE/MAX, aProperties harvesters

## Costs

| Environment | Monthly Cost |
|-------------|--------------|
| Local (Docker) | $0 |
| EC2 c5.xlarge + 150GB EBS (production) | ~$19/month (scheduled start/stop) |
| EC2 c5.xlarge 24/7 | ~$137/month |

## Data Updates

Spain OSM data is updated daily by Geofabrik. To update:

```bash
docker-compose exec nominatim /app/src/nominatim/utils/update.php --replication
```

Or set `REPLICATION_URL` in docker-compose.yml for automatic daily updates.

## Troubleshooting

### Import stuck or slow
- Ensure at least 4GB RAM available
- Check disk space (need ~50GB free)
- Import can take 2-4 hours on first run

### "Connection refused" errors
- Wait for import to complete (check logs: `docker-compose logs -f`)
- Healthcheck starts working after 5 minutes

### Rate limiting on public API fallback
- If self-hosted unavailable, falls back to public API (1 req/sec limit)
- Check status: `curl http://localhost:3000/api/geocode?status=true`

## Architecture

```
User Request
     ↓
/api/geocode (Next.js)
     ↓
nominatim.ts (checks self-hosted first)
     ↓
┌─────────────────┐     ┌─────────────────┐
│ Self-hosted     │ OR  │ Public API      │
│ localhost:8080  │     │ nominatim.org   │
│ (unlimited)     │     │ (1 req/sec)     │
└─────────────────┘     └─────────────────┘
```


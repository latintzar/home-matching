# Spanish Real Estate Agency Harvester

This script uses Google Gemini (Vertex AI) to generate a comprehensive list of locations in Spain (Communities, Provinces, Municipalities) and then uses the Scrapingdog Google Search API to find real estate agency websites for each location.

## Prerequisites

1.  **Environment Variables**:
    Create or update your `.env.local` file in the root directory:

    ```env
    GOOGLE_CLOUD_PROJECT_ID=your-project-id
    GOOGLE_CLOUD_LOCATION=us-central1
    SCRAPINGDOG_API_KEY=your-scrapingdog-api-key
    ```

    Ensure your Google Cloud credentials are set up (usually via `GOOGLE_APPLICATION_CREDENTIALS` json file).

2.  **Dependencies**:
    Ensure the project dependencies are installed (`npm install`).

## Usage

To run the script, use `npx tsx`:

```bash
npx tsx src/scripts/harvest_agencies/run.ts
```

### Configuration / Limits

By default, the script limits the number of municipalities per province to 5 to avoid excessive API usage during testing. You can control this with environment variables:

```bash
# Run with increased limits (WARNING: High API cost)
LIMIT_MUNICIPALITIES=100 npx tsx src/scripts/harvest_agencies/run.ts
```

-   `LIMIT_COMMUNITIES`: Max number of autonomous communities to process (Default: 100/All)
-   `LIMIT_PROVINCES`: Max number of provinces per community (Default: 100/All)
-   `LIMIT_MUNICIPALITIES`: Max number of municipalities per province (Default: 5)

## Output

-   **Console**: Logs progress of query generation and scraping.
-   **harvest_results.json**: (Not fully implemented in v1, currently outputting to console/csv)
-   **domains.csv**: Appends found domains and links to this file in the root directory.

## Cost Warning

-   **Gemini**: Costs apply based on Vertex AI pricing (Flash is cheap).
-   **Scrapingdog**: Costs 5 credits per request.
    -   1 Municipality = ~3 queries ("inmobiliaria [City]", "real estate [City]", "urbanization [City]")
    -   x 10 pages deep = 30 requests = 150 credits per municipality.
    -   Processing 100 municipalities = 15,000 credits.
    -   Processing **all** ~8000 municipalities in Spain would cost millions of credits. Use with caution.


# Agent setup

Start with README.md, docs/setup.md and RELEASE-STATUS.md. Keep the original fit calculations, cached-analysis boundary and native UI intact when extending the app.

1. Run the Node-only first result and tests. Its homes, prices, property scores and neighborhood scores are authored examples.
2. Run npm ci at root, then python3 tools/sample-app.py build and start. This is the full native app; its SQLite guest state stays outside source. The smaller starter remains a scoring reference.
3. Choose the recipient’s provider accounts before configuring full-app integrations. Read the actual call paths in docs/workflows.md.
4. Store configuration in an absolute file outside the checkout, inside a mode-0700 directory. Use tools/runtime-env.py configure in a private interactive terminal, or let the recipient create that mode-0600 file through their secret store. Ask for secret values through that private route.
5. Run the masked doctor and launch a selected command with runtime-env.py run. The helper clears inherited cloud credentials and disables cloud metadata fallback. Public browser identifiers use NEXT_PUBLIC_ names; service keys remain server-side.
6. Live model, voice, map, scraping, email, payment and cloud provisioning calls need the recipient’s explicit authorization and owned resources. The first-result commands perform zero provider calls.
7. Add independently licensed listings, photos, geography and pricing data with provenance. Keep private records and generated results outside the checkout.

Archive/diagnostic code and original plans are engineering history. Consult the current release status before treating a historical claim as working acceptance. CI checks the full native sample build and local contracts; full cloud acceptance is a separate operator task.

#!/bin/bash
# Build the extension content script
echo "📦 Building extension content script..."
npx esbuild src/extension/content.ts --bundle --outfile=public/extension/content.js --platform=browser --target=es2020
echo "✅ Build complete: public/extension/content.js"


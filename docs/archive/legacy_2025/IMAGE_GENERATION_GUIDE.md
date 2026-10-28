
### ⚠️ Important Note on Image Generation Models (Updated 2025-11-20)

All image generation/editing nodes (R1.5 Edit, F0, R3) now use **Gemini 3 Pro Image Preview** via the **REST API** instead of the Vertex AI SDK.

**Why?**
- Superior image quality (4K resolution support).
- Better instruction following for inpainting/editing.
- Required specific configuration (`responseModalities: ['IMAGE']`, `imageConfig` object) that is fully supported via REST.

**Implementation Detail:**
When creating new image nodes, always use `callGeminiRest` from `@/lib/gemini-rest-client` with the following configuration pattern:

```typescript
const result = await callGeminiRest(prompt, {
  model: 'gemini-3-pro-image-preview', // Or use ModelRegistry.VISUALS.RENDER
  generateImages: true,
  responseModalities: ['IMAGE'], // CRITICAL
  imageConfig: {
    aspectRatio: '16:9',
    imageSize: '4K',
    imageOutputOptions: { mimeType: 'image/png' },
    personGeneration: 'ALLOW_ALL'
  },
  // ... images: [...] if editing
});
```


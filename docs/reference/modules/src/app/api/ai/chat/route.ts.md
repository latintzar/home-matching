# src/app/api/ai/chat/route.ts

[Source](../../../../../../../../src/app/api/ai/chat/route.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `getSupabase` | function | [L7](../../../../../../../../src/app/api/ai/chat/route.ts#L7) |  |
| `isSpanish` | function | [L18](../../../../../../../../src/app/api/ai/chat/route.ts#L18) | text |
| `isEnglish` | function | [L24](../../../../../../../../src/app/api/ai/chat/route.ts#L24) | text |
| `detectQuestionLanguage` | function | [L30](../../../../../../../../src/app/api/ai/chat/route.ts#L30) | messages |
| `shouldBeBlockquote` | function | [L44](../../../../../../../../src/app/api/ai/chat/route.ts#L44) | text |
| `replaceClaimIdsWithQuotes` | function | [L68](../../../../../../../../src/app/api/ai/chat/route.ts#L68) | content, claimIdToSourceMap |
| `decideCTA` | function | [L219](../../../../../../../../src/app/api/ai/chat/route.ts#L219) | responseText, conversationHistory, listing, hasShownAnyTier, hasShownBlockquote |
| `POST` | function | [L345](../../../../../../../../src/app/api/ai/chat/route.ts#L345) | req |
| `start` | method | [L1189](../../../../../../../../src/app/api/ai/chat/route.ts#L1189) | controller |
| `streamInSmallerChunks` | function | [L1231](../../../../../../../../src/app/api/ai/chat/route.ts#L1231) | text, chunkSize, delayMs |

Imports: `next/server`, `@google-cloud/vertexai`, `@supabase/supabase-js`, `@/lib/gemini-rest-client`

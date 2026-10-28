/**
 * REST API client for Gemini models using API key authentication
 * Uses region-specific endpoint for preview models (us-central1)
 */

export interface GeminiImageInput {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string; // base64 encoded image data
}

interface GeminiRestConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  thinkingConfig?: {
    thinkingBudget?: number;
    thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  // Optional model override, e.g., 'gemini-2.5-pro' or 'gemini-2.5-flash'
  model?: string;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  tools?: Array<{
    googleSearch?: {};
  }>;
  responseMimeType?: string;
  // Structured output schema (Vertex AI schema subset)
  responseSchema?: any;
  // Images to include in the request (base64 encoded)
  images?: GeminiImageInput[];
  // For image generation: return images instead of text
  generateImages?: boolean;
  responseModalities?: string[];
  imageConfig?: {
    aspectRatio?: string;
    imageSize?: string;
    imageOutputOptions?: {
      mimeType?: string;
    };
    personGeneration?: string;
  };
}

interface TokenUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiRestResponse {
  success: boolean;
  text?: string;
  images?: Array<{
    mimeType: string;
    data: string; // base64 encoded
  }>;
  error?: any;
  rawResponse?: string;
  usage?: TokenUsage;
  model?: string; // Model that was actually used
}

/**
 * Call Gemini using REST API with API key authentication
 * Supports preview models via region-specific endpoint
 * Supports images via base64 encoding
 * Supports image generation
 */
export async function callGeminiRest(
  prompt: string,
  config: GeminiRestConfig = {}
): Promise<GeminiRestResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY not set'
    };
  }

  // Build model list: if caller provides a model, use that; otherwise try preview flash then stable flash
  const modelsToTry = config.model ? [config.model] : ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  
  const defaultSafetySettings = [
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
  ];

  // Build parts array: text + images
  const parts: any[] = [{ text: prompt }];
  
  // Add images if provided
  if (config.images && config.images.length > 0) {
    for (const image of config.images) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
    }
    console.log(`📸 Added ${config.images.length} images to request`);
  }

  // If generating images, set response MIME type to image
  const generationConfig: any = {
    temperature: config.temperature ?? 0.1,
    topP: config.topP ?? 0.6,
    topK: config.topK ?? 20,
    maxOutputTokens: config.maxOutputTokens ?? 32000,
    ...(config.thinkingConfig && { thinkingConfig: config.thinkingConfig }),
    ...(config.responseSchema && { responseSchema: config.responseSchema }),
    ...(config.responseModalities && { responseModalities: config.responseModalities }),
    ...(config.imageConfig && { imageConfig: config.imageConfig })
  };

  // Handle response MIME type
  if (config.responseMimeType) {
    generationConfig.responseMimeType = config.responseMimeType;
  } else if (config.generateImages && !config.imageConfig) {
    // Only default to image/jpeg if NO imageConfig is present
    generationConfig.responseMimeType = 'image/jpeg';
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: parts
      }
    ],
    generationConfig,
    safetySettings: config.safetySettings || defaultSafetySettings,
    ...(config.tools && { tools: config.tools })
  };

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      // Always use publisher endpoint (same pattern as zero-shot clustering)
      // This works for all models: gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-flash-lite
      const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;
      
      console.log(`🔌 Connecting to: ${url.replace(apiKey, 'HIDDEN_KEY')}`);

      // Retry logic with exponential backoff for 429 errors
      const MAX_RETRIES = 5;
      const INITIAL_DELAY_MS = 1000; // Start with 1 second
      let retryCount = 0;
      let res: Response | null = null;
      let raw: string = '';

      while (retryCount <= MAX_RETRIES) {
        try {
          res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

          raw = await res.text();
          
          // Success - break out of retry loop
          if (res.ok) {
            break;
          }

          // Handle 429 rate limit errors with exponential backoff
          if (res.status === 429 && retryCount < MAX_RETRIES) {
            const delay = INITIAL_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            const jitter = Math.random() * 1000; // Add up to 1s jitter to avoid thundering herd
            const totalDelay = delay + jitter;
            
            console.log(`⚠️ Rate limit (429) hit, retrying in ${Math.round(totalDelay)}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            await new Promise(resolve => setTimeout(resolve, totalDelay));
            retryCount++;
            continue;
          }

          // For other errors, break and handle below
          break;
        } catch (fetchError) {
          // Network errors - retry with exponential backoff
          if (retryCount < MAX_RETRIES) {
            const delay = INITIAL_DELAY_MS * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000;
            const totalDelay = delay + jitter;
            
            console.log(`⚠️ Network error, retrying in ${Math.round(totalDelay)}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            await new Promise(resolve => setTimeout(resolve, totalDelay));
            retryCount++;
            continue;
          }
          throw fetchError;
        }
      }

      // Handle errors after retries exhausted
      if (!res || !res.ok) {
        let parsed: any = null;
        try { parsed = JSON.parse(raw); } catch {}
        lastError = parsed?.error || { message: `HTTP ${res?.status || 'unknown'}`, details: raw.substring(0, 1000) };
        
        console.error(`❌ Gemini API error (${res?.status}):`, parsed?.error || raw.substring(0, 500));
        
        // If 404 and this is preview model, try next model
        if (res?.status === 404 && model.includes('preview')) {
          continue;
        }
        
        return {
          success: false,
          error: lastError,
          rawResponse: raw.substring(0, 2000)
        };
      }

      // Parse stream response - it's a JSON array of response objects
      // Format: [{candidates: [{content: {parts: [{text: "..."}]}}]}, {...}, ...]
      try {
        let responseArray = JSON.parse(raw);
        
        if (!Array.isArray(responseArray)) {
          // Try to extract from single object
          if (typeof responseArray === 'object' && responseArray !== null && responseArray.candidates) {
            responseArray = [responseArray];
          } else {
            throw new Error('Response is not an array and does not contain candidates');
          }
        }
        
        let fullText = '';
        let images: Array<{ mimeType: string; data: string }> = [];
        
        // Extract text, images, and usage metadata from all chunks in the array
        let totalPromptTokens = 0;
        let totalCandidatesTokens = 0;
        let totalTokens = 0;
        
        for (const chunk of responseArray) {
          // Extract usage metadata if available
          if (chunk?.usageMetadata) {
            totalPromptTokens += chunk.usageMetadata.promptTokenCount || 0;
            totalCandidatesTokens += chunk.usageMetadata.candidatesTokenCount || 0;
            totalTokens += chunk.usageMetadata.totalTokenCount || 0;
          }
          
          const candidates = chunk?.candidates || [];
          for (const candidate of candidates) {
            // Check finishReason to understand why text might be empty
            if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
              console.warn(`⚠️ Candidate finished with reason: ${candidate.finishReason}`);
            }
            
            const parts = candidate?.content?.parts || [];
            for (const part of parts) {
              if (part?.text) {
                fullText += part.text;
              }
              // Extract images (for image generation)
              if (part?.inlineData) {
                images.push({
                  mimeType: part.inlineData.mimeType || 'image/jpeg',
                  data: part.inlineData.data
                });
              }
            }
          }
        }
        
        const usage: TokenUsage | undefined = totalTokens > 0 ? {
          promptTokenCount: totalPromptTokens,
          candidatesTokenCount: totalCandidatesTokens,
          totalTokenCount: totalTokens
        } : undefined;

        console.log(`📝 Extracted ${fullText.length} characters and ${images.length} images from ${responseArray.length} chunks`);

        // If generating images, return images even if no text
        if (config.generateImages && images.length > 0) {
          return {
            success: true,
            images: images,
            text: fullText || undefined,
            rawResponse: raw.substring(0, 500),
            usage: usage,
            model: model
          };
        }

        if (!fullText) {
          // If we got images but no text and weren't expecting images, that's OK
          if (images.length > 0) {
            console.log(`⚠️ Got ${images.length} images but no text. Returning images.`);
            return {
              success: true,
              images: images,
              rawResponse: raw.substring(0, 500)
            };
          }

          // Log more details about why text extraction failed
          const firstCandidate = responseArray[0]?.candidates?.[0];
          const finishReason = firstCandidate?.finishReason;
          const safetyRatings = firstCandidate?.safetyRatings;
          
          console.warn(`⚠️ No text extracted from stream. Raw response length: ${raw.length}, Array length: ${responseArray.length}`);
          console.warn(`   Finish reason: ${finishReason || 'unknown'}`);
          if (safetyRatings && safetyRatings.length > 0) {
            console.warn(`   Safety ratings:`, safetyRatings);
          }
          
          // Try fallback extraction (only if text exists but wasn't parsed correctly)
          const textMatches = raw.match(/"text"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g);
          if (textMatches) {
            let extractedText = '';
            for (const match of textMatches) {
              const textMatch = match.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
              if (textMatch && textMatch[1]) {
                extractedText += JSON.parse(`"${textMatch[1]}"`); // Properly unescape
              }
            }
            if (extractedText) {
              console.log(`✅ Fallback extracted ${extractedText.length} characters`);
              return {
                success: true,
                text: extractedText,
                images: images.length > 0 ? images : undefined,
                rawResponse: raw.substring(0, 500)
              };
            }
          }
          
          // Return error with finishReason details
          return {
            success: false,
            error: finishReason === 'SAFETY' 
              ? 'Content blocked by safety filters'
              : finishReason === 'MAX_TOKENS'
              ? 'Response truncated (max tokens reached)'
              : finishReason === 'RECITATION'
              ? 'Content blocked (recitation detected)'
              : `No text content extracted (finishReason: ${finishReason || 'unknown'})`,
            images: images.length > 0 ? images : undefined,
            rawResponse: raw.substring(0, 1000)
          };
        }

        return {
          success: true,
          text: fullText,
          images: images.length > 0 ? images : undefined,
          rawResponse: raw.substring(0, 500), // First 500 chars for debugging
          usage: usage,
          model: model
        };
      } catch (parseError) {
        // If parsing fails, try to extract text directly from raw response
        console.warn(`⚠️ Failed to parse stream as JSON array, trying fallback:`, parseError);
        
        // Fallback: try to find text patterns in the raw response
        const textMatches = raw.match(/"text"\s*:\s*"([^"]+)"/g);
        if (textMatches) {
          let extractedText = '';
          for (const match of textMatches) {
            const textMatch = match.match(/"text"\s*:\s*"([^"]+)"/);
            if (textMatch && textMatch[1]) {
              extractedText += textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
          }
          if (extractedText) {
            return {
              success: true,
              text: extractedText,
              rawResponse: raw.substring(0, 500)
            };
          }
        }
        
        return {
          success: false,
          error: 'Failed to parse stream response: ' + (parseError instanceof Error ? parseError.message : String(parseError)),
          rawResponse: raw.substring(0, 1000)
        };
      }

    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      
      // Try next model on exception
      if (model.includes('preview')) {
        continue;
      }
      
      return {
        success: false,
        error: lastError
      };
    }
  }

  return {
    success: false,
    error: 'All models failed',
    ...(lastError && { lastError })
  };
}


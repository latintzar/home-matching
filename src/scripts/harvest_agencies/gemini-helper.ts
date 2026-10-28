import { getGenAI } from '@/lib/genaiClient';

const MODEL_NAME = 'gemini-2.0-flash';

export async function generateLocations(
  prompt: string,
  schema: any
): Promise<any> {
  const vertexAI = getGenAI();
  const model = vertexAI.getGenerativeModel({ model: MODEL_NAME });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  if (!result.response.candidates?.[0].content?.parts?.[0].text) {
    throw new Error('Failed to generate locations from Gemini');
  }

  return JSON.parse(result.response.candidates[0].content.parts[0].text);
}


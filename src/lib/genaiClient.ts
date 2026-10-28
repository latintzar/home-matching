import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
});

export function getGenAI() {
  return vertexAI;
}


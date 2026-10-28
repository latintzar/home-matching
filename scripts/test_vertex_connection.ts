import { VertexAI } from '@google-cloud/vertexai';

async function testVertex() {
  console.log('Testing Vertex AI Connection...');
  console.log(`Project: ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
  console.log(`Location: ${process.env.GOOGLE_CLOUD_LOCATION}`);
  console.log(`Creds: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

  try {
    const vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION,
    });

    const model = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash-001',
    });

    console.log('Sending request to gemini-1.5-flash-001...');
    const resp = await model.generateContent('Hello, are you working?');
    const content = resp.response.candidates[0].content;
    console.log('Response:', JSON.stringify(content));
    console.log('✅ Vertex AI Success!');

  } catch (error) {
    console.error('❌ Vertex AI Failed:', error);
  }
}

testVertex();


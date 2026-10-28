/**
 * ElevenLabs Text Chat API
 * 
 * Sends text messages to the ElevenLabs agent and gets text responses.
 * No audio - just text in, text out. Uses the same agent as voice mode.
 */

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const AGENT_ID = (process.env.NEXT_PUBLIC_ELEVENLABS_RENTER_INTAKE_AGENT_ID || ''); // Leo Intake v2

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, conversationId, messages = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    // Build conversation history for context
    const historyText = messages
      .map((m: ConversationMessage) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n');

    // Use ElevenLabs text generation with the agent's prompt
    // Since there's no direct "chat with agent" API, we'll use the conversation endpoint
    
    // Start or continue conversation
    let convId = conversationId;
    
    if (!convId) {
      // Start new conversation
      const startResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: AGENT_ID,
          }),
        }
      );

      if (!startResponse.ok) {
        const error = await startResponse.text();
        console.error('[ElevenLabs Chat] Failed to start conversation:', error);
        return NextResponse.json({ error: 'Failed to start conversation' }, { status: 500 });
      }

      const startData = await startResponse.json();
      convId = startData.conversation_id;
    }

    // Send message to conversation
    const sendResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${convId}/messages`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message,
        }),
      }
    );

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error('[ElevenLabs Chat] Failed to send message:', error);
      
      // Fallback: Use the agent's system prompt with our own LLM
      // This maintains the same personality even if the API fails
      return NextResponse.json({ 
        error: 'ElevenLabs chat API not available',
        fallback: true 
      }, { status: 503 });
    }

    const responseData = await sendResponse.json();
    
    return NextResponse.json({
      success: true,
      conversationId: convId,
      response: responseData.text || responseData.message || '',
      agentId: AGENT_ID,
    });

  } catch (error: any) {
    console.error('[ElevenLabs Chat] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process message' 
    }, { status: 500 });
  }
}

// Get conversation transcript
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      transcript: data.transcript || [],
      status: data.status,
    });

  } catch (error: any) {
    console.error('[ElevenLabs Chat] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


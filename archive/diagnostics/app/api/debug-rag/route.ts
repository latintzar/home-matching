
import { NextRequest, NextResponse } from 'next/server';
import { vertexRAG } from '@/lib/vertex-rag';

export async function GET(req: NextRequest) {
  const logs: string[] = [];
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  // Capture logs
  console.log = (...args) => { logs.push(`[LOG] ${args.join(' ')}`); originalConsoleLog(...args); };
  console.warn = (...args) => { logs.push(`[WARN] ${args.join(' ')}`); originalConsoleWarn(...args); };
  console.error = (...args) => { logs.push(`[ERROR] ${args.join(' ')}`); originalConsoleError(...args); };

  try {
    const query = "presupuestos_proyecto-y-reforma-integral-cocina";
    logs.push(`Testing RAG with query: "${query}"`);
    
    const isConfigured = vertexRAG.isConfigured('pricing');
    logs.push(`Is 'pricing' configured? ${isConfigured}`);
    logs.push(`Project ID: ${process.env.GOOGLE_CLOUD_PROJECT_ID ? 'Set' : 'Missing'}`);
    
    const results = await vertexRAG.search('pricing', query, 3);
    
    return NextResponse.json({
      success: true,
      resultsCount: results.length,
      firstResultTitle: results[0]?.title,
      firstResultContentLength: results[0]?.content?.length,
      firstResultContentPreview: results[0]?.content?.substring(0, 200),
      logs
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      logs
    });
  } finally {
    // Restore console
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
}


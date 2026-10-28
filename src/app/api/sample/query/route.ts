import {NextRequest,NextResponse} from 'next/server';
import {sampleMode,sampleGuest} from '@/lib/sample/server';
import {executeQuery} from '@/lib/sample/store.mjs';
import {appBasePath} from '@/lib/app-path';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
  if(!sampleMode())return NextResponse.json({error:'Sample mode is disabled.'},{status:404});
  if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.get('origin')&&new URL(request.headers.get('origin')!).host!==request.headers.get('host')))return NextResponse.json({error:'Use the application origin.'},{status:403});
  const text=await request.text();if(text.length>24000)return NextResponse.json({error:'Choose a smaller query.'},{status:413});
  try{return NextResponse.json(executeQuery(await sampleGuest(),JSON.parse(text),appBasePath));}
  catch{return NextResponse.json({error:'Check the sample request.'},{status:400});}
}

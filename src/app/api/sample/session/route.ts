import {NextResponse} from 'next/server';
import {sampleMode,sampleGuest} from '@/lib/sample/server';
import {sampleUser,resetGuest} from '@/lib/sample/store.mjs';
export const dynamic='force-dynamic';
export async function GET() {
  if(!sampleMode())return NextResponse.json({error:'Sample mode is disabled.'},{status:404});
  return NextResponse.json({user:sampleUser(await sampleGuest())});
}
export async function DELETE() {
  if(!sampleMode())return NextResponse.json({error:'Sample mode is disabled.'},{status:404});
  resetGuest(await sampleGuest());return NextResponse.json({success:true});
}

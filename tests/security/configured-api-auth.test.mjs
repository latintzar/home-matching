import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {NextRequest} from 'next/server.js';
import {installNetworkFence} from '../../tools/offline-guard.mjs';
const require=createRequire(import.meta.url),fence=installNetworkFence();
const OWNER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const calls=[];
const user=id=>({id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',created_at:'2026-01-01T00:00:00Z'});
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url),headers=new Headers(init.headers);calls.push({path:url.pathname,authorization:headers.get('authorization'),apikey:headers.get('apikey')});
 assert.equal(url.origin,'https://recipient.supabase.invalid','Only the owned fake auth/database transport can run');
 if(url.pathname==='/auth/v1/user') {
  assert.equal(headers.get('apikey'),'recipient-anon-fixture','Identity verification uses the anon key');
  const token=headers.get('authorization');
  if(token==='Bearer verified-owner')return Response.json(user(OWNER));
  if(token==='Bearer verified-other')return Response.json(user(OTHER));
  return Response.json({message:'Invalid JWT',code:'bad_jwt'},{status:401});
 }
 if(url.pathname==='/rest/v1/subscriptions') {
  assert.equal(headers.get('apikey'),'recipient-anon-fixture');return Response.json({plan_id:'free',status:'active'});
 }
 if(url.pathname==='/rest/v1/user_profiles') {
  assert.equal(headers.get('apikey'),'recipient-anon-fixture');assert.equal(url.searchParams.get('id'),'eq.'+OTHER);return Response.json({active_profile_type:'renter'});
 }
 if(url.pathname==='/rest/v1/property_notes') {
  assert.equal(headers.get('apikey'),'recipient-anon-fixture');assert.equal(headers.get('authorization'),'Bearer verified-other');
  if(init.method==='POST') {const record=JSON.parse(init.body);assert.equal(record.user_id,OTHER);return Response.json({...record,id:'fixture-note'});}
  assert.equal(url.searchParams.get('user_id'),'eq.'+OTHER);return Response.json([]);
 }
 if(url.pathname==='/rest/v1/analytics_events') {
  assert.equal(headers.get('apikey'),'recipient-service-fixture');assert.equal(JSON.parse(init.body).user_id,OTHER);return new Response(null,{status:201});
 }
 if(url.pathname==='/rest/v1/deepdives'||url.pathname==='/rest/v1/deepdive_requests') {
  assert.equal(headers.get('apikey'),'recipient-service-fixture');return Response.json([]);
 }
 throw Error('Unexpected provider or data call: '+url.pathname);
};
const built=process.env.AUTH_TEST_BUILD;
const middleware=require(path.join(built,'middleware.js')).middleware;
const routes=Object.fromEntries(['deepdives','images','reno','profile','stripe','notes','analytics','notesProcess'].map(n=>[n,require(path.join(built,n+'.js'))]));
function reset(){calls.length=0;for(const name of ['HOME_MATCHING_OPERATOR_USER_ID','CRON_SECRET','STRIPE_WEBHOOK_SECRET','NEXT_PUBLIC_DEV_BYPASS','NEXT_PUBLIC_ENABLE_TEST_AUTH'])delete process.env[name];Object.assign(process.env,{SAMPLE_MODE:'0',NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://recipient.supabase.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'recipient-anon-fixture',SUPABASE_SERVICE_KEY:'recipient-service-fixture',STRIPE_SECRET_KEY:'sk_test_fixture',NEXT_PUBLIC_BASE_URL:'https://app.example.invalid',NEXT_PUBLIC_BASE_PATH:''});}
function req(url,options={}){const {method='GET',token,body,origin,headers={}}=options;const h=new Headers(headers);if(token)h.set('authorization','Bearer '+token);if(origin)h.set('origin',origin);if(body!==undefined)h.set('content-type','application/json');return new NextRequest('https://app.example.invalid'+url,{method,headers:h,...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});}
function denied(response,status){assert.equal(response.status,status);assert.notEqual(response.headers.get('x-middleware-next'),'1');}
function allowed(response){assert.equal(response.headers.get('x-middleware-next'),'1');}

test('all retained API paths reject an unauthenticated request before provider/data work',async()=>{
 reset();process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;let count=0;
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='route.ts')paths.push(p);}}const paths=[];walk('src/app/api');
 for(const p of paths){const text=fs.readFileSync(p,'utf8');const method=/export (?:async )?function GET\b/.test(text)?'GET':'POST';const url='/api/'+path.relative('src/app/api',path.dirname(p)).replaceAll(path.sep,'/').replace(/\[[^\]]+\]/g,'fixture');const response=await middleware(req(url,{method,origin:'https://app.example.invalid',...(method==='POST'?{body:{}}:{})}));assert.ok([401,403,503].includes(response.status),url+' returned '+response.status);assert.notEqual(response.headers.get('x-middleware-next'),'1',url);count++;}
 assert.ok(count>=183);assert.equal(calls.length,0);assert.equal(fence.attempts.length,0);
});
test('operator routes fail closed until a verified installation operator is configured',async()=>{
 reset();denied(await middleware(req('/api/landing/generate-images',{method:'POST',token:'verified-owner',body:{}})),503);assert.equal(calls.length,0);
 process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;
 denied(await middleware(req('/api/deepdives',{token:'verified-other',headers:{'X-User-Id':OWNER}})),403);
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/auth/v1/user');
 const pass=await middleware(req('/api/deepdives',{token:'verified-owner',headers:{'X-User-Id':OTHER}}));allowed(pass);assert.equal(pass.headers.get('x-middleware-request-x-user-id'),null);
});
test('forged bearer identity and public development flags grant zero provider access',async()=>{
 reset();process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;process.env.NEXT_PUBLIC_DEV_BYPASS='true';process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH='true';process.env.NODE_ENV='development';
 denied(await middleware(req('/api/deepdives',{token:'forged-owner-claims',headers:{'X-User-Id':OWNER}})),401);
 denied(await middleware(req('/api/auth/test-login',{method:'POST',token:'verified-owner',body:{email:'fixture@example.invalid'}})),503);
 assert.equal(calls.filter(x=>x.path.startsWith('/rest/')).length,0);
});
test('cookie user metadata is not authority; Supabase verifies the token owner',async()=>{
 reset();process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;
 const session={access_token:'verified-other',refresh_token:'fixture-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:user(OWNER)};
 const cookie='sb-recipient-auth-token=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
 denied(await middleware(req('/api/deepdives',{headers:{cookie}})),403);assert.equal(calls[0]?.authorization,'Bearer verified-other');
});
test('user-owned APIs accept verified sessions; provider/AI work stays operator scoped',async()=>{
 reset();allowed(await middleware(req('/api/notes',{token:'verified-other'})));allowed(await middleware(req('/api/saved',{token:'verified-other'})));
 denied(await middleware(req('/api/notes/process',{method:'POST',token:'verified-other',body:{noteIds:['other-note']}})),503);
 process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;denied(await middleware(req('/api/notes/process',{method:'POST',token:'verified-other',body:{}})),403);
});
test('mutation origins and body bounds are enforced before authentication/provider calls',async()=>{
 reset();process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;
 denied(await middleware(req('/api/landing/generate-images',{method:'POST',token:'verified-owner',origin:'https://other.example.invalid',body:{}})),403);
 denied(await middleware(req('/api/notes',{method:'POST',origin:'https://app.example.invalid',headers:{'sec-fetch-site':'cross-site'},body:{}})),403);
 denied(await middleware(req('/api/notes',{method:'POST',token:'verified-owner',body:{text:'x'.repeat(32769)}})),413);assert.equal(calls.length,0);
});
test('scheduled jobs require a configured high-entropy secret',async()=>{
 reset();denied(await middleware(req('/api/cron/harvest')),503);process.env.CRON_SECRET='a'.repeat(32);denied(await middleware(req('/api/cron/harvest',{token:'wrong'})),401);allowed(await middleware(req('/api/cron/harvest',{token:'a'.repeat(32)})));assert.equal(calls.length,0);
});
test('direct sensitive handlers reject a missing session before DB/provider invocation',async()=>{
 reset();process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;
 denied(await routes.deepdives.GET(req('/api/deepdives')),401);
 denied(await routes.images.POST(req('/api/landing/generate-images',{method:'POST',origin:'https://app.example.invalid',body:{imageId:'fixture'}})),401);
 denied(await routes.reno.POST(req('/api/landing/generate-reno-after',{method:'POST',origin:'https://app.example.invalid',body:{}})),401);
 denied(await routes.profile.POST(req('/api/agents/update-profile',{method:'POST',origin:'https://app.example.invalid',headers:{'X-User-Id':OWNER},body:{budget_max:1000}})),401);assert.equal(calls.length,0);
});
test('verified operator reaches the actual deepdives handler and its database query',async()=>{
 reset();process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;const response=await routes.deepdives.GET(req('/api/deepdives',{token:'verified-owner'}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{deepdives:[],requests:[]});assert.deepEqual(calls.map(x=>x.path),['/auth/v1/user','/rest/v1/deepdives','/rest/v1/deepdive_requests']);
});
test('Stripe callbacks require the real cryptographic signature before data access',async()=>{
 reset();denied(await routes.stripe.POST(req('/api/stripe/webhook',{method:'POST',body:{}})),503);process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture_signature_secret';
 denied(await routes.stripe.POST(req('/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'forged'},body:{type:'checkout.session.completed'}})),400);assert.equal(calls.length,0);
 const Stripe=require('stripe'),stripe=new Stripe('sk_test_fixture');const body=JSON.stringify({id:'evt_fixture',type:'fixture.unhandled',data:{object:{}}});const signature=stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
 const response=await routes.stripe.POST(req('/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body}));assert.equal(response.status,200);assert.equal(calls.length,0);
});
test('SAMPLE_MODE keeps legacy/provider routes closed and its native guest API intact',async()=>{
 reset();process.env.SAMPLE_MODE='1';denied(await middleware(req('/api/landing/generate-images',{method:'POST',origin:'https://app.example.invalid',body:{}})),503);
 const response=await middleware(req('/api/sample/session'));allowed(response);assert.ok(response.cookies.get('leo_home_sample_guest')?.value);assert.equal(calls.length,0);assert.equal(fence.attempts.length,0);
});

test('real notes handler binds forged body/query user IDs to the verified caller and RLS token',async()=>{
 reset();const get=await routes.notes.GET(req('/api/notes?listingId=44&user_id='+OWNER,{token:'verified-other'}));assert.equal(get.status,200);assert.deepEqual((await get.json()).notes,[]);
 const post=await routes.notes.POST(req('/api/notes',{method:'POST',token:'verified-other',body:{listingId:44,content:'A source fixture note',user_id:OWNER}}));assert.equal(post.status,200);assert.equal((await post.json()).note.user_id,OTHER);
 assert.ok(calls.some(x=>x.path==='/rest/v1/property_notes'));assert.equal(calls.some(x=>x.apikey==='recipient-service-fixture'),false);
});
test('analytics binds actor to verified identity; AI note processing requires operator permission',async()=>{
 reset();const response=await routes.analytics.POST(req('/api/analytics',{method:'POST',token:'verified-other',body:{event:'fixture',user_id:OWNER}}));assert.equal(response.status,200);
 calls.length=0;denied(await routes.notesProcess.POST(req('/api/notes/process',{method:'POST',token:'verified-other',body:{}})),503);assert.equal(calls.length,0);
 process.env.HOME_MATCHING_OPERATOR_USER_ID=OWNER;denied(await routes.notesProcess.POST(req('/api/notes/process',{method:'POST',token:'verified-other',body:{}})),403);assert.deepEqual(calls.map(x=>x.path),['/auth/v1/user']);assert.equal(fence.attempts.length,0);
});

test('a mounted app prefix keeps user/operator admission on the canonical API path',async()=>{
 reset();process.env.NEXT_PUBLIC_BASE_PATH='/apps/home-matching';allowed(await middleware(req('/apps/home-matching/api/notes',{token:'verified-other'})));
 denied(await middleware(req('/apps/home-matching/api/landing/generate-images',{method:'POST',token:'verified-other',body:{}})),503);assert.equal(calls.filter(x=>x.path.startsWith('/rest/')).length,0);
});

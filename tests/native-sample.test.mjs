import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {queryClient} from '../src/lib/sample/query.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'leo-native-sample-test-'));
process.env.SAMPLE_DATA_DIR=directory;
const {executeQuery,sampleUser,resetGuest}=await import('../src/lib/sample/store.mjs');
const guestA=crypto.randomUUID(),guestB=crypto.randomUUID();
const client=guest=>queryClient(query=>executeQuery(guest,query,'/apps/home-matching'),{});
const a=client(guestA),b=client(guestB);
test.after(()=>fs.rmSync(directory,{recursive:true,force:true}));

test('native catalogue and relationships use the retained storage contract',async()=>{
  const listings=await a.from('listings').select('*').gt('price_eur',0).limit(6);
  assert.equal(listings.error,null);assert.equal(listings.data.length,6);
  assert.equal((await a.from('listings').select()).data.length,8);
  assert.ok(listings.data[0].image_urls.every(url=>url.startsWith('/apps/home-matching/images/landing/')));
  const saved=await a.from('saved_properties').select('*,listings(*)');
  assert.equal(saved.data.length,2);assert.ok(saved.data.every(row=>row.listings.id===row.listing_id));
});
test('profile writes persist in the current guest and stay separate from another guest',async()=>{
  const userA=sampleUser(guestA);assert.notEqual(userA.id,guestA);
  const result=await a.from('user_lifestyle_profiles').update({max_budget:225000}).eq('user_id',userA.id).select().single();
  assert.equal(result.data.max_budget,225000);
  assert.equal(result.data.budget_max,225000);
  const native=await a.from('user_lifestyle_profiles').update({budget_max:230000}).eq('user_id',userA.id).select().single();
  assert.equal(native.data.max_budget,230000);
  assert.equal((await a.from('user_lifestyle_profiles').select().single()).data.max_budget,230000);
  assert.equal((await b.from('user_lifestyle_profiles').select().single()).data.max_budget,280000);
  const foreign=await b.from('user_lifestyle_profiles').select().eq('user_id',userA.id);
  assert.deepEqual(foreign.data,[]);
});
test('native notes can be added and deleted; supplied user IDs stay scoped',async()=>{
  const inserted=await a.from('property_notes').insert({listing_id:'1000000002',user_id:sampleUser(guestB).id,content:'Check afternoon light.'}).select().single();
  assert.equal(inserted.data.user_id,sampleUser(guestA).id);
  const absent=await b.from('property_notes').select().eq('id',inserted.data.id);assert.equal(absent.data.length,0);
  await a.from('property_notes').delete().eq('id',inserted.data.id);
  assert.equal((await a.from('property_notes').select().eq('id',inserted.data.id)).data.length,0);
});
test('catalogue writes and unknown tables fail without changing the catalogue',async()=>{
  assert.ok((await a.from('listings').update({price_eur:'1'}).eq('id','1000000001')).error);
  assert.ok((await a.from('provider_keys').select()).error);
  assert.equal((await a.from('listings').select().eq('id','1000000001').single()).data.price_eur,'245000');
});
test('record bounds and unsafe object keys are rejected',async()=>{
  assert.ok((await a.from('property_notes').insert({listing_id:'unknown',content:'Example'})).error);
  assert.ok((await a.from('property_notes').insert({content:'x'.repeat(25000)})).error);
  assert.ok((await a.from('user_profiles').update(JSON.parse('{"__proto__":{"samplePolluted":true}}'))).error);
  assert.equal({}.samplePolluted,undefined);
});
test('reset restores only the selected guest workspace',async()=>{
  resetGuest(guestA);
  assert.equal((await a.from('user_lifestyle_profiles').select().single()).data.max_budget,280000);
  assert.equal((await b.from('user_lifestyle_profiles').select().single()).data.max_budget,280000);
});
test('parallel server processes retain each committed guest note',async()=>{
  const guest=crypto.randomUUID();
  const moduleUrl=new URL('../src/lib/sample/store.mjs',import.meta.url).href;
  const script=`import {executeQuery} from ${JSON.stringify(moduleUrl)};const result=executeQuery(process.env.TEST_GUEST,{table:'property_notes',action:'insert',values:{listing_id:'1000000001',content:'Concurrent note'},filters:[],orders:[],limit:100});if(result.error)process.exit(1);`;
  await Promise.all(Array.from({length:6},()=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--input-type=module','--eval',script],{env:{...process.env,TEST_GUEST:guest},stdio:'ignore'});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Concurrent note write failed')));
  })));
  const notes=await client(guest).from('property_notes').select();
  assert.equal(notes.data.length,7);
});

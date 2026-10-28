import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'leo-native-fit-'));
const output=path.join(directory,'fit.mjs');
await build({stdin:{contents:"export {sampleRecommendations} from './src/lib/sample/recommend'; export {rowToProfile} from './src/lib/recommender/profileStorage'; export {initialTables} from './src/lib/sample/seed.mjs';",resolveDir:root},outfile:output,bundle:true,platform:'node',format:'esm',define:{'process.env.NEXT_PUBLIC_BASE_PATH':JSON.stringify('/apps/home-matching')},tsconfig:path.join(root,'tsconfig.json')});
const {sampleRecommendations,rowToProfile,initialTables}=await import(pathToFileURL(output));
test.after(()=>fs.rmSync(directory,{recursive:true,force:true}));

test('native API results retain property routes, photos and deterministic fit fields',()=>{
  const profile=rowToProfile(initialTables('example-user').user_lifestyle_profiles[0]);
  const result=sampleRecommendations(profile);
  assert.equal(result.success,true);assert.equal(result.results.total,8);
  assert.equal(result.results.listings.length,8);
  for(const item of result.results.listings){
    assert.ok(item.listing.url.startsWith('/apps/home-matching/property/'));
    assert.ok(item.listing.image_urls.every(url=>url.startsWith('/apps/home-matching/images/landing/')));
    assert.ok(item.fitScore>=0&&item.fitScore<=100);
    assert.ok(Array.isArray(item.topReasons)&&Array.isArray(item.concerns));
  }
});
test('changing the native household profile reranks the same cached evidence',()=>{
  const profile=rowToProfile(initialTables('example-user').user_lifestyle_profiles[0]);
  const first=sampleRecommendations(profile).results.listings;
  const outdoor=structuredClone(profile);outdoor.household.workSituation='office';outdoor.lifestyle.mustHaves=['terraza','luz natural'];outdoor.lifestyle.dealbreakers=[];
  const second=sampleRecommendations(outdoor).results.listings;
  assert.notEqual(first[0].listing.listing_id,second[0].listing.listing_id);
  assert.deepEqual(first.map(item=>item.listing.listing_id).sort(),second.map(item=>item.listing.listing_id).sort());
  assert.deepEqual(sampleRecommendations(profile).results.listings,first);
});

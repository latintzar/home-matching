import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {build} from 'esbuild';

const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(import.meta.url);

function initializer(relative,name,context={}) {
  const source=ts.createSourceFile(relative,fs.readFileSync(path.join(root,relative),'utf8'),ts.ScriptTarget.Latest,true);
  let value;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)value=node.initializer;ts.forEachChild(node,visit);}
  visit(source);assert.ok(value,`Missing ${name} in ${relative}`);
  const javascript=ts.transpileModule(`const value=${value.getText(source)};value;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return JSON.parse(JSON.stringify(vm.runInNewContext(javascript,context,{timeout:1000})));
}

test('the provisioning definitions and all four original cache implementations agree',async()=>{
  const names=initializer('src/lib/wpa/table-contracts.ts','WPA_TABLE_NAMES');
  const keys=initializer('src/lib/wpa/table-contracts.ts','WPA_TABLE_KEYS');
  assert.equal(new Set(Object.values(names)).size,4);
  const definitions=initializer('scripts/setup-dynamodb-tables.ts','TABLES',{WPA_TABLE_NAMES:names});
  const schemas=new Map(definitions.map(table=>[table.name,[table.partitionKey,...(table.sortKey?[table.sortKey]:[])]]));
  assert.deepEqual(schemas.get(names.modes),['listing_id','wpa_mode']);
  assert.deepEqual(schemas.get(names.scores),['listing_id']);
  assert.deepEqual(schemas.get(names.shortlist),['listing_id']);
  assert.deepEqual(schemas.get(names.urls),['listing_url']);
  const harvest=initializer('src/scripts/aws/create-dynamodb-tables.ts','TABLES',{WPA_TABLE_NAMES:names,WPA_TABLE_KEYS:keys});
  assert.deepEqual(harvest.find(table=>table.TableName===names.urls).KeySchema.map(key=>key.AttributeName),schemas.get(names.urls));
  const records=new Map();const commands=[];
  globalThis.__atelierDynamo={send:async(command)=>{
    const {TableName,Key,Item}=command.input;const keys=schemas.get(TableName);
    assert.ok(keys,`Unexpected table ${TableName}`);
    const data=command.kind==='PutCommand'?Item:Key;
    if(command.kind!=='PutCommand')assert.deepEqual(Object.keys(data).sort(),[...keys].sort());
    for(const key of keys)assert.equal(typeof data[key],'string',`Missing ${TableName}.${key}`);
    const storageKey=JSON.stringify([TableName,...keys.map(key=>data[key])]);commands.push({table:TableName,kind:command.kind});
    if(command.kind==='PutCommand'){records.set(storageKey,structuredClone(Item));return{};}
    if(command.kind==='DeleteCommand'){records.delete(storageKey);return{};}
    return{Item:structuredClone(records.get(storageKey))};
  }};
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'home-wpa-contract-'));
  const sdk=`export class DynamoDBClient{};export class DynamoDBDocumentClient{static from(){return globalThis.__atelierDynamo;}};`+
    ['GetCommand','PutCommand','QueryCommand','ScanCommand','UpdateCommand','DeleteCommand'].map(name=>`export class ${name}{constructor(input){this.input=input;this.kind='${name}';}}`).join('');
  const entries={modes:'src/lib/wpa/cache.ts',scores:'src/app/api/wpa/score/route.ts',shortlist:'src/lib/recommender/wpaShortlist.ts',urls:'src/lib/dynamodb.ts'};
  try{
    await build({entryPoints:entries,outdir:output,outExtension:{'.js':'.cjs'},bundle:true,platform:'node',format:'cjs',absWorkingDir:root,tsconfig:path.join(root,'tsconfig.json'),logLevel:'silent',plugins:[{name:'offline-cache-contract',setup(plugin){
      plugin.onResolve({filter:/^@aws-sdk\//},args=>({path:args.path,namespace:'offline-sdk'}));
      plugin.onLoad({filter:/.*/,namespace:'offline-sdk'},()=>({contents:sdk,loader:'js'}));
      plugin.onResolve({filter:/gemini-rest-client$/},()=>({path:'model',namespace:'offline-model'}));
      plugin.onLoad({filter:/.*/,namespace:'offline-model'},()=>({contents:'export async function callGeminiRest(){throw Error("Provider calls are fenced in this test");}',loader:'js'}));
      plugin.onResolve({filter:/^next\/server$/},()=>({path:'next',namespace:'offline-next'}));
      plugin.onLoad({filter:/.*/,namespace:'offline-next'},()=>({contents:'export class NextRequest{};export class NextResponse{};',loader:'js'}));
      plugin.onLoad({filter:/(?:wpa\/score\/route|recommender\/wpaShortlist)\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8')+'\nexport { '+(args.path.endsWith('wpaShortlist.ts')?'getCachedWPA, cacheWPA':'getCachedScores, cacheScores')+' };',loader:'ts',resolveDir:path.dirname(args.path)}));
    }}]});
    const modes=require(path.join(output,'modes.cjs'));const scores=require(path.join(output,'scores.cjs'));
    const shortlist=require(path.join(output,'shortlist.cjs'));const urls=require(path.join(output,'urls.cjs'));
    const id='fixture-home';const hash=modes.generatePhotoHash(['https://example.test/photo.jpg']);
    await modes.setWpaCached(id,'scores','Barcelona',hash,{mode:'original-composite'});
    assert.deepEqual(await modes.getWpaCached(id,'scores',hash),{mode:'original-composite'});
    assert.equal(await modes.getWpaCached(id,'scores','changed-photos'),null);
    await scores.cacheScores({listing_id:id,scores:{natural_light_intensity:90}});
    assert.equal((await scores.getCachedScores(id)).scores.natural_light_intensity,90);
    await shortlist.cacheWPA({listing_id:id,scores:{light:70},fixture:'shortlist'});
    assert.equal((await shortlist.getCachedWPA(id)).fixture,'shortlist');
    await urls.putWPA({listing_url:'https://example.test/home',analysis_data:{fixture:'url'}});
    assert.equal((await urls.getWPA('https://example.test/home')).analysis_data.fixture,'url');
    // One implementation cannot overwrite another's record for the same listing.
    assert.deepEqual(await modes.getWpaCached(id,'scores',hash),{mode:'original-composite'});
    assert.equal((await scores.getCachedScores(id)).scores.natural_light_intensity,90);
    assert.equal(new Set(commands.map(command=>command.table)).size,4);
  }finally{delete globalThis.__atelierDynamo;fs.rmSync(output,{recursive:true,force:true});}
});

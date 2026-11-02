/** Generate AWS CLI inputs from the retained literal table definitions; zero AWS calls. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function literal(relative,name,context={}) {
  const source=ts.createSourceFile(relative,fs.readFileSync(path.join(root,relative),'utf8'),ts.ScriptTarget.Latest,true);
  let value;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)value=node.initializer;ts.forEachChild(node,visit);}
  visit(source);if(!value)throw Error(`Missing ${name} in ${relative}`);
  const javascript=ts.transpileModule(`const value=${value.getText(source)};value;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return JSON.parse(JSON.stringify(vm.runInNewContext(javascript,context,{timeout:1000})));
}
function canonical(value){return JSON.stringify(value,(_,item)=>Array.isArray(item)?item: item&&typeof item==='object'?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);}
export function schema(){
  const names=literal('src/lib/wpa/table-contracts.ts','WPA_TABLE_NAMES');
  const keys=literal('src/lib/wpa/table-contracts.ts','WPA_TABLE_KEYS');
  const current=literal('scripts/setup-dynamodb-tables.ts','TABLES',{WPA_TABLE_NAMES:names}).map(item=>({
    TableName:item.name,
    KeySchema:[{AttributeName:item.partitionKey,KeyType:'HASH'},...(item.sortKey?[{AttributeName:item.sortKey,KeyType:'RANGE'}]:[])],
    AttributeDefinitions:[...item.attributes,...(item.extraAttributes||[])],
    ...(item.gsi?.length?{GlobalSecondaryIndexes:item.gsi}:{}),BillingMode:'PAY_PER_REQUEST',
  }));
  const harvest=literal('src/scripts/aws/create-dynamodb-tables.ts','TABLES',{WPA_TABLE_NAMES:names,WPA_TABLE_KEYS:keys});
  const adapterNames=literal('src/lib/data-adapter/dynamodb-adapter.ts','TABLES');
  // Separate retained adapter generation; its point reads use listing_id keys.
  const adapter=[
    {TableName:adapterNames.LISTINGS,KeySchema:[{AttributeName:'listing_id',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'listing_id',AttributeType:'S'},{AttributeName:'city',AttributeType:'S'},{AttributeName:'domain',AttributeType:'S'}],GlobalSecondaryIndexes:['city','domain'].map(name=>({IndexName:name+'-index',KeySchema:[{AttributeName:name,KeyType:'HASH'},{AttributeName:'listing_id',KeyType:'RANGE'}],Projection:{ProjectionType:'ALL'}})),BillingMode:'PAY_PER_REQUEST'},
    {TableName:adapterNames.ANALYSIS,KeySchema:[{AttributeName:'listing_id',KeyType:'HASH'},{AttributeName:'analysis_type',KeyType:'RANGE'}],AttributeDefinitions:[{AttributeName:'listing_id',AttributeType:'S'},{AttributeName:'analysis_type',AttributeType:'S'}],BillingMode:'PAY_PER_REQUEST'},
    {TableName:adapterNames.WPA_CACHE,KeySchema:[{AttributeName:'listing_id',KeyType:'HASH'}],AttributeDefinitions:[{AttributeName:'listing_id',AttributeType:'S'}],BillingMode:'PAY_PER_REQUEST'},
  ];
  const tables=new Map();
  for(const [group,items] of [['current',current],['harvest',harvest],['legacy-adapter',adapter]])for(const item of items){
    const normalized={...item,AttributeDefinitions:[...item.AttributeDefinitions].sort((a,b)=>a.AttributeName.localeCompare(b.AttributeName))};
    const existing=tables.get(item.TableName);
    if(existing&&canonical(existing.input)!==canonical(normalized))throw Error(`Conflicting definitions: ${item.TableName}`);
    if(existing)existing.groups.push(group);else tables.set(item.TableName,{groups:[group],input:normalized});
  }
  for(const {input}of tables.values()){
    const used=new Set(input.KeySchema.map(key=>key.AttributeName));
    for(const index of input.GlobalSecondaryIndexes||[])for(const key of index.KeySchema)used.add(key.AttributeName);
    const attributes=input.AttributeDefinitions.map(attr=>attr.AttributeName);
    if(new Set(attributes).size!==attributes.length||attributes.some(attr=>!used.has(attr))||[...used].some(attr=>!attributes.includes(attr)))throw Error(`Invalid key attributes: ${input.TableName}`);
  }
  for(const kind of Object.keys(names))if(canonical(tables.get(names[kind]).input.KeySchema)!==canonical(keys[kind]))throw Error(`Cache key mismatch: ${kind}`);
  return [...tables.values()].sort((a,b)=>a.input.TableName.localeCompare(b.input.TableName));
}
export function outputs(){
  const tables=schema();const sources=['src/lib/wpa/table-contracts.ts','scripts/setup-dynamodb-tables.ts','src/scripts/aws/create-dynamodb-tables.ts','src/lib/data-adapter/dynamodb-adapter.ts'];
  const files=new Map(tables.map(({input})=>['db/dynamodb/'+input.TableName+'.json',JSON.stringify(input,null,2)+'\n']));
  files.set('db/dynamodb/manifest.json',JSON.stringify({scope:'Current cache/recommender, harvested listings and separate retained adapter contracts. No account access or data import.',legacy_adapter_status:'Fresh source-derived point/index contracts, separate from current leo-* tables; cloud data migration is not implied.',source_inputs:sources.map(relative=>({path:relative,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex')})),tables:tables.map(({input,groups})=>({name:input.TableName,groups,file:input.TableName+'.json'}))},null,2)+'\n');
  return files;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const check=process.argv.includes('--check');
  for(const [relative,content]of outputs()){
    const destination=path.join(root,relative);
    if(check){if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==content)throw Error(`Regenerate ${relative}`);}
    else{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,content);}
  }
  console.log(check?'DynamoDB CLI inputs verified; zero AWS calls.':'DynamoDB CLI inputs generated; zero AWS calls.');
}

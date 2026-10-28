import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {initialTables,sampleHomes,normalizeProfile,sampleUser as seedUser} from './seed.mjs';

export const guestCookie = 'leo_home_sample_guest';
const aliases = {user_saved_properties:'saved_properties',user_viewings:'property_views',user_notes:'property_notes'};
const mutable = new Set(['user_profiles','user_lifestyle_profiles','saved_properties','property_views','property_notes','user_settings']);
const allowed = new Set([...mutable,'subscriptions','agents','listings','listing_photos']);
let database;
function db() {
  if (!database) {
    const directory = process.env.SAMPLE_DATA_DIR || path.join(os.tmpdir(),'leo-home-matching-sample');
    fs.mkdirSync(directory,{recursive:true,mode:0o700});
    database = new DatabaseSync(path.join(directory,'guests.sqlite'));
    database.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS guests(id TEXT PRIMARY KEY, data TEXT NOT NULL, touched INTEGER NOT NULL)');
    try { fs.chmodSync(path.join(directory,'guests.sqlite'),0o600); } catch {}
  }
  return database;
}

function failure(message,code='SAMPLE_QUERY') { return {data:null,error:{message,code},count:null}; }
function matches(row,{operator,column,value}) {
  const actual=row[column];
  if(operator==='eq')return actual===value;
  if(operator==='neq')return actual!==value;
  if(operator==='gt')return actual>value;
  if(operator==='gte')return actual>=value;
  if(operator==='lt')return actual<value;
  if(operator==='lte')return actual<=value;
  if(operator==='in')return Array.isArray(value)&&value.includes(actual);
  if(operator==='is')return actual===value;
  if(operator==='contains')return Array.isArray(actual)&&Array.isArray(value)&&value.every(v=>actual.includes(v));
  throw new Error('Unsupported query filter');
}

export function executeQuery(guest,query,base='') {
  if(!/^[0-9a-f-]{36}$/.test(guest))return failure('A sample guest session is required.');
  if(!query || JSON.stringify(query).length>24000)return failure('Choose a smaller query.');
  const table=aliases[query.table]||query.table;
  if(!allowed.has(table))return failure('This table belongs to the configured recipient service.');
  if(!['select','insert','update','upsert','delete'].includes(query.action))return failure('Unsupported sample operation.');
  if(query.action!=='select'&&!mutable.has(table))return failure('The sample catalogue is read-only.');
  if(!Array.isArray(query.filters)||query.filters.length>20||(query.orders||[]).length>5)return failure('Choose a smaller query.');
  const connection=db();connection.exec('BEGIN IMMEDIATE');
  try {
    const saved=connection.prepare('SELECT data FROM guests WHERE id=?').get(guest);
    const userId=guestUserId(guest);
    const state=saved?JSON.parse(saved.data):initialTables(userId);
    for(const row of state.user_lifestyle_profiles)normalizeProfile(row);
    const homes=sampleHomes(base);
    const catalogue=homes.map(home=>home.listing);
    let rows=table==='listings'?catalogue:table==='listing_photos'?homes.flatMap(home=>home.listing.image_urls.map((url,index)=>({id:home.listing.id+'-'+index,listing_id:home.listing.id,url,caption:null,display_order:index,is_primary:index===0}))):(state[table]||[]);
    const filtered=()=>rows.filter(row=>query.filters.every(filter=>matches(row,filter)));
    let result=filtered();
    if(query.action==='insert'||query.action==='upsert') {
      const values=Array.isArray(query.values)?query.values:[query.values];
      if(!values.length||values.length>10||rows.length+values.length>128)throw new Error('Sample record limit reached.');
      result=values.map(value=>{
        if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>['__proto__','constructor','prototype'].includes(k)))throw new Error('Use a record object.');
        const row={...value,id:value.id||crypto.randomUUID(),user_id:userId,created_at:new Date().toISOString()};
        if(table==='user_profiles')row.id=userId;
        if(row.listing_id&&!catalogue.some(listing=>listing.id===row.listing_id))throw new Error('Choose a sample property.');
        if(table==='user_lifestyle_profiles')normalizeProfile(row,value);
        if(query.action==='upsert') {
          const keys=String(query.onConflict||'id').split(',');
          if(keys.some(key=>!['id','user_id','listing_id','profile_type'].includes(key)))throw new Error('Choose a supported record key.');
          const index=rows.findIndex(existing=>keys.every(key=>existing[key]===row[key]));
          if(index>=0){rows[index]={...rows[index],...row,id:rows[index].id};return rows[index];}
        }
        if(rows.some(existing=>existing.id===row.id))throw new Error('This record already exists.');
        rows.push(row);return row;
      });
    } else if(query.action==='update') {
      if(!query.values||typeof query.values!=='object'||Array.isArray(query.values)||Object.keys(query.values).some(k=>['__proto__','constructor','prototype'].includes(k)))throw new Error('Use a record object.');
      if(query.values.listing_id&&!catalogue.some(listing=>listing.id===query.values.listing_id))throw new Error('Choose a sample property.');
      result=result.map(row=>{const id=row.id;Object.assign(row,query.values,{id,user_id:userId,updated_at:new Date().toISOString()});if(table==='user_lifestyle_profiles')normalizeProfile(row,query.values);return row;});
    } else if(query.action==='delete') {
      rows=rows.filter(row=>!result.includes(row));
    }
    if(mutable.has(table))state[table]=rows;
    if(['saved_properties','property_views'].includes(table))result=result.map(row=>({...row,listings:catalogue.find(listing=>listing.id===row.listing_id)||null}));
    for(const order of (query.orders||[]).toReversed())result.sort((a,b)=>String(a[order.column]??'').localeCompare(String(b[order.column]??''),undefined,{numeric:true})*(order.ascending?1:-1));
    const count=result.length;
    const limit=Math.max(0,Math.min(100,Number.isFinite(Number(query.limit))?Number(query.limit):100));
    const offset=Math.max(0,Math.min(1000,Number(query.offset)||0));
    result=result.slice(offset,offset+limit);
    if(JSON.stringify(state).length>64000)throw new Error('Sample workspace size limit reached.');
    connection.prepare('INSERT INTO guests(id,data,touched) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,touched=excluded.touched').run(guest,JSON.stringify(state),Date.now());
    connection.prepare('DELETE FROM guests WHERE touched < ?').run(Date.now()-12*60*60*1000);
    connection.exec('DELETE FROM guests WHERE id IN (SELECT id FROM guests ORDER BY touched DESC LIMIT -1 OFFSET 512)');
    connection.exec('COMMIT');
    if(query.single&&(result.length>1||(result.length===0&&!query.optional)))return failure('Record not found.','PGRST116');
    return {data:query.head?null:query.single?(result[0]||null):result,error:null,count:query.count?count:null};
  }catch(error){connection.exec('ROLLBACK');return failure(error instanceof Error?error.message:'Sample query failed.');}
}

export function resetGuest(guest) { db().prepare('DELETE FROM guests WHERE id=?').run(guest); }
export function guestUserId(guest) { const h=crypto.createHash('sha256').update('leo-sample-user:'+guest).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32); }
export function sampleUser(guest) { return seedUser(guestUserId(guest)); }

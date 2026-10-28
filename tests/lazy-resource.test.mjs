import test from 'node:test';
import assert from 'node:assert/strict';
import {lazyResource} from '../src/lib/lazy-resource.mjs';

test('optional resources wait for feature use and retain method ownership',()=>{
  let created=0;
  const client=lazyResource(()=>{created++;return {name:'owned service',read(){return this.name;}};});
  assert.equal(created,0);
  assert.equal(client.read(),'owned service');
  client.name='configured service';
  assert.equal(client.read(),'configured service');
  assert.equal(created,1);
});
test('configuration errors remain feature errors and initialization can be retried',()=>{
  let configured=false;
  const client=lazyResource(()=>{if(!configured)throw new Error('Configure this feature.');return {ready:true};});
  assert.throws(()=>client.ready,/Configure this feature/);
  configured=true;assert.equal(client.ready,true);
});

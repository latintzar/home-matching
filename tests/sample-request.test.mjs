import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleBodyWithinLimit,forwardedGuestCookie} from '../src/lib/sample/request.mjs';

test('sample body cap rejects declared, streamed and multibyte oversize before JSON parsing',async()=>{
 assert.equal(await sampleBodyWithinLimit(new Request('http://localhost',{method:'POST',headers:{'content-length':'40000'},body:'{}'})),false);
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(20000));c.enqueue(new Uint8Array(20000));c.close();}});
 assert.equal(await sampleBodyWithinLimit(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'})),false);
 assert.equal(await sampleBodyWithinLimit(new Request('http://localhost',{method:'POST',body:'é'.repeat(20000)})),false);
 assert.equal(await sampleBodyWithinLimit(new Request('http://localhost',{method:'POST',body:'{"profileId":"example"}'})),true);
});
test('renewing a malformed guest cookie replaces its old forwarded pair',()=>{
 const cookie=forwardedGuestCookie('language=es; leo_home_sample_guest=malformed; other=value','new-guest');
 assert.equal(cookie,'language=es; other=value; leo_home_sample_guest=new-guest');
 assert.equal((cookie.match(/leo_home_sample_guest=/g)||[]).length,1);
});

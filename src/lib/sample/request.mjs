/** Bound a sample API body before any route parses JSON. Works in middleware. */
export async function sampleBodyWithinLimit(request, maximum=32768) {
  const length=request.headers.get('content-length');
  if(length && (!/^\d+$/.test(length)||Number(length)>maximum))return false;
  if(!request.body)return true;
  const reader=request.clone().body.getReader();let bytes=0;
  try {
    for(;;){const {done,value}=await reader.read();if(done)return true;bytes+=value.byteLength;if(bytes>maximum)return false;}
  }catch{return false;}
  finally{void reader.cancel().catch(()=>{});}
}
export function forwardedGuestCookie(cookie,guest) {
  return [...(cookie||'').split(';').map(pair=>pair.trim()).filter(pair=>pair&&!/^leo_home_sample_guest\s*=/.test(pair)),'leo_home_sample_guest='+guest].join('; ');
}

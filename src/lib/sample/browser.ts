import {queryClient} from './query.mjs';
import {appFetch} from '../app-path';

async function session() {
  const response=await appFetch('/api/sample/session',{credentials:'same-origin'});
  return response.json();
}
export function sampleBrowserClient(): any {
  const auth={
    getUser:async()=>({data:{user:(await session()).user},error:null}),
    getSession:async()=>({data:{session:{user:(await session()).user}},error:null}),
    onAuthStateChange:(callback:any)=>{let active=true;session().then(data=>{if(active)callback('INITIAL_SESSION',{user:data.user});});return {data:{subscription:{unsubscribe(){active=false;}}}};},
    signOut:async()=>{await appFetch('/api/sample/session',{method:'DELETE'});return {error:null};},
  };
  return queryClient(async (query:any)=>{
    const response=await appFetch('/api/sample/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(query),credentials:'same-origin'});
    return response.json();
  },auth);
}

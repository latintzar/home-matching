import 'server-only';
import {cookies} from 'next/headers';
import {queryClient} from './query.mjs';
import {executeQuery,guestCookie,sampleUser} from './store.mjs';
import {appBasePath} from '../app-path';

export const sampleMode = () => process.env.SAMPLE_MODE === '1';
export async function sampleGuest() {
  const id=(await cookies()).get(guestCookie)?.value;
  if(!id || !/^[0-9a-f-]{36}$/.test(id))throw new Error('A sample guest session is required.');
  return id;
}
export function sampleServerClient(): any {
  return queryClient(async (query:any) => executeQuery(await sampleGuest(),query,appBasePath),{
    getUser:async()=>({data:{user:sampleUser(await sampleGuest())},error:null}),
    getSession:async()=>({data:{session:{user:sampleUser(await sampleGuest())}},error:null}),
  });
}

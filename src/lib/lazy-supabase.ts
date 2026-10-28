import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {lazyResource} from './lazy-resource.mjs';

/** Preserve each owned service's SDK/options and validate only when it is used. */
export function lazySupabaseClient(url:string|undefined,key:string|undefined,options?:Parameters<typeof createClient>[2],validate?:()=>void):SupabaseClient<any> {
  return lazyResource(()=>{
    validate?.();
    if(!url||!key)throw new Error('Configure the recipient Supabase URL and key for this feature.');
    return createClient(url,key,options);
  }) as SupabaseClient<any>;
}

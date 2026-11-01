/** Compile actual Next handlers, then exercise them with real NextRequest objects offline. */
import {buildSync} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');const output=fs.mkdtempSync(path.join(root,'.auth-test-'));
const entries={middleware:'src/middleware.ts',deepdives:'src/app/api/deepdives/route.ts',images:'src/app/api/landing/generate-images/route.ts',reno:'src/app/api/landing/generate-reno-after/route.ts',profile:'src/app/api/agents/update-profile/route.ts',stripe:'src/app/api/stripe/webhook/route.ts',notes:'src/app/api/notes/route.ts',analytics:'src/app/api/analytics/route.ts',notesProcess:'src/app/api/notes/process/route.ts'};
try {
 buildSync({entryPoints:entries,outdir:output,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:path.join(root,'tsconfig.json'),absWorkingDir:root,alias:{'server-only':'next/dist/compiled/server-only/empty.js'},logLevel:'warning'});
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','HOME','LANG','LC_ALL','TMPDIR'].includes(k)));env.AUTH_TEST_BUILD=output;
 const test=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/security/configured-api-auth.test.mjs'],{cwd:root,env,stdio:'inherit'});process.exitCode=test.status??1;
}finally{fs.rmSync(output,{recursive:true,force:true});}

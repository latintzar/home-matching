#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire,isBuiltin} from 'node:module';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require=createRequire(path.join(root,'starter/package.json'));
const ts=require('typescript');
const out=path.join(root,'docs/reference');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const roots=['src','scripts','leo-vibe-extension','gmaps-list-saver','archive'];
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(?:ts|tsx|js|mjs)$/.test(e.name)&&!e.name.endsWith('.d.ts')?[path.join(dir,e.name)]:[]);}
const modules=[],symbols=[],missing=[],syntax=[];
for(const file of roots.flatMap(name=>fs.existsSync(path.join(root,name))?files(path.join(root,name)):[]).sort()){
 const relative=path.relative(root,file);const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);const entries=[],imports=[];
 for(const diag of source.parseDiagnostics||[])syntax.push({path:relative,line:source.getLineAndCharacterOfPosition(diag.start||0).line+1,code:diag.code});
 function visit(node){
  const kinds=new Map([[ts.SyntaxKind.FunctionDeclaration,'function'],[ts.SyntaxKind.MethodDeclaration,'method'],[ts.SyntaxKind.Constructor,'constructor'],[ts.SyntaxKind.ClassDeclaration,'class'],[ts.SyntaxKind.InterfaceDeclaration,'interface'],[ts.SyntaxKind.TypeAliasDeclaration,'type'],[ts.SyntaxKind.EnumDeclaration,'enum']]);
  let kind=kinds.get(node.kind);let name=node.name&&ts.isIdentifier(node.name)?node.name.text:null;
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&(ts.isArrowFunction(node.initializer)||ts.isFunctionExpression(node.initializer))){kind='function';name=node.name.text;}
  if(kind&&(name||kind==='constructor')){
   const item={module:relative,source_path:relative,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,name:name||'constructor',kind,parameters:(node.parameters||node.initializer?.parameters||[]).map(p=>ts.isIdentifier(p.name)?p.name.text:'destructured')};entries.push(item);symbols.push(item);
  }
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
  ts.forEachChild(node,visit);
 }
 visit(source);
 if(relative.startsWith('src/'))for(const name of imports){
  if(!(name.startsWith('.')||name.startsWith('@/')))continue;
  const target=name.startsWith('@/')?path.join(root,'src',name.slice(2)):path.resolve(path.dirname(file),name);
  const options=[target,...['.ts','.tsx','.js','.mjs','.json','.css'].map(x=>target+x),...['.ts','.tsx','.js'].map(x=>path.join(target,'index'+x))];if(!options.some(fs.existsSync))missing.push({module:relative,import:name});
 }
 const reference='modules/'+relative+'.md';const destination=path.join(out,reference);fs.mkdirSync(path.dirname(destination),{recursive:true});
 let sourceLink=path.relative(path.dirname(destination),file).split(path.sep).join('/');if(!sourceLink.startsWith('.'))sourceLink='./'+sourceLink;
 const body=['# '+relative,'','[Source]('+sourceLink+')','', '| Symbol | Kind | Line | Parameters |','|---|---|---:|---|',...entries.map(e=>'| `'+e.name+'` | '+e.kind+' | [L'+e.line+']('+sourceLink+'#L'+e.line+') | '+e.parameters.join(', ')+' |'),'','Imports: '+imports.map(x=>'`'+x+'`').join(', '), ''];
 fs.writeFileSync(destination,body.join('\n'));modules.push({path:relative,reference,symbols:entries.length,imports});
}
const groups=new Map();for(const module of modules){const pieces=module.path.split('/');const area=pieces.slice(0,pieces[0]==='src'?3:2).join('/');if(!groups.has(area))groups.set(area,[]);groups.get(area).push(module);}
const index=['# Source reference','','Generated from the retained source with the TypeScript compiler API. Symbol names, kinds, source paths, one-based lines and parameter names are indexed. The source and its comments carry implementation detail; [architecture](../architecture.md) and [workflows](../workflows.md) explain the system.','','[Machine-readable modules and symbols](symbols.json)','','| Area | Modules | Symbols |','|---|---:|---:|'];
for(const [area,items] of [...groups].sort()){
 const name='areas/'+area.replaceAll('/','-')+'.md';const destination=path.join(out,name);fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.writeFileSync(destination,['# '+area,'','| Module | Symbols |','|---|---:|',...items.map(m=>'| ['+m.path+'](../'+m.reference+') | '+m.symbols+' |'),''].join('\n'));
 index.push('| ['+area+']('+name+') | '+items.length+' | '+items.reduce((sum,m)=>sum+m.symbols,0)+' |');
}
fs.writeFileSync(path.join(out,'README.md'),index.join('\n')+'\n');
fs.writeFileSync(path.join(out,'symbols.json'),JSON.stringify({schema_version:1,source_pin:'d461e9556f09ad526030376ab58643298e3a1fc8',modules,symbols},null,2)+'\n');
fs.writeFileSync(path.join(out,'closure.json'),JSON.stringify({missing_local_imports:missing,syntax_diagnostics:syntax},null,2)+'\n');
console.log(JSON.stringify({modules:modules.length,symbols:symbols.length,missing_local_imports:missing.length,syntax_diagnostics:syntax.length}));
if(missing.length||syntax.length)process.exitCode=1;

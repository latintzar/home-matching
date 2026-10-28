#!/usr/bin/env python3
"""Package the native first-result app and its independently served sales page."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT=Path(__file__).resolve().parents[1]
WEBSITE=Path(__file__).resolve().parent
PREFIX='/apps/home-matching'
TEXT_SUFFIXES={'.html','.js','.css','.json','.txt'}

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--out',type=Path,default=WEBSITE/'dist')
    args=ap.parse_args();out=args.out.absolute()
    if out.is_symlink() or out in [Path('/'),Path.home(),ROOT] or out in ROOT.parents:
        raise SystemExit('Choose a generated output directory.')
    marker=out/'.home-matching-build.json'
    if out.exists() and any(out.iterdir()) and not marker.is_file():
        raise SystemExit('Output contains files from another build.')
    if out.exists():shutil.rmtree(out)
    out.mkdir(parents=True)
    marker.write_text('{"builder":"home-matching-website-v1"}\n')
    starter=ROOT/'starter';built=starter/'.next'
    html=built/'server/app/index.html';static=built/'static'
    if not html.is_file() or not static.is_dir():
        raise SystemExit('Build starter first: npm ci --prefix starter && npm run build --prefix starter')
    public=out/'public';app=public/PREFIX.lstrip('/');app.mkdir(parents=True)
    sources=[];changes=[]
    def write(src,dst):
        data=src.read_bytes();original=hashlib.sha256(data).hexdigest()
        if src.suffix in TEXT_SUFFIXES:
            text=data.decode('utf-8')
            text=text.replace('/_next/',PREFIX+'/_next/').replace('/fonts/',PREFIX+'/fonts/')
            data=text.encode('utf-8')
        dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data)
        sources.append({'source':str(src.relative_to(ROOT)),'path':str(dst.relative_to(public)),'source_sha256':original,'sha256':hashlib.sha256(data).hexdigest()})
        if original!=hashlib.sha256(data).hexdigest():changes.append(str(dst.relative_to(public)))
    write(html,app/'index.html')
    for src in sorted(static.rglob('*')):
        if src.is_file() and src.suffix!='.map':write(src,app/'_next/static'/src.relative_to(static))
    for src in sorted((starter/'public/fonts').rglob('*')):
        if src.is_file():write(src,app/'fonts'/src.relative_to(starter/'public/fonts'))
    site=public/'home-matching';assets=site/'assets';assets.mkdir(parents=True)
    shutil.copyfile(WEBSITE/'index.html',site/'index.html')
    shutil.copyfile(WEBSITE/'site.css',assets/'site.css')
    shutil.copyfile(WEBSITE/'site.js',assets/'site.js')
    font_dir=assets/'fonts';font_dir.mkdir()
    for name in ['PlayfairDisplay-variable.ttf','playfairdisplay-OFL.txt']:
        src=ROOT/'public/fonts'/name
        if not src.is_file():raise SystemExit('Original font file missing: '+name)
        shutil.copyfile(src,font_dir/name)
    try:pin=subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'],text=True).strip()
    except subprocess.CalledProcessError:pin=None
    files=[{'path':str(p.relative_to(public)),'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(public.rglob('*')) if p.is_file()]
    manifest={'schema_version':1,'source_repository':'https://github.com/latintzar/home-matching','source_commit':pin,'native_entry':PREFIX+'/index.html','site_path':'/home-matching','native_source_files':sources,'native_rebased_files':changes,'files':files,'scope':'The original deterministic scorer and recommendation scene with authored fixtures. Full cloud/voice/property analysis commissioning is separate.'}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'files':len(files),'bytes':sum(x['bytes'] for x in files),'native_entry':manifest['native_entry'],'manifest_sha256':digest(out/'manifest.json')}))

if __name__=='__main__':main()

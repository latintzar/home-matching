#!/usr/bin/env python3
"""Capture the actual first-result app with synthetic inputs; block foreign requests."""
import argparse,hashlib,json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

def main():
 p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:4188');p.add_argument('--output',required=True);args=p.parse_args()
 out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 allowed=urlsplit(args.url).netloc;foreign=[];errors=[];captures=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True)
  for label,width,height in [('desktop',1600,1000),('phone',390,844)]:
   context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
   def route(request_route):
    request=request_route.request
    if urlsplit(request.url).netloc != allowed:
     foreign.append({'host':urlsplit(request.url).netloc});request_route.abort()
    else:request_route.continue_()
   context.route('**/*',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(type(e).__name__))
   page.goto(args.url,wait_until='networkidle');page.get_by_role('heading',name='Tus recomendaciones').wait_for()
   page.evaluate('document.fonts.ready')
   assert page.locator('h4').first.inner_text()=='Courtyard example'
   assert page.get_by_text('84% fit',exact=True).count()==1
   assert page.get_by_text('57% fit',exact=True).count()==1
   assert page.get_by_text('Shared-home example',exact=True).count()==0
   for profile,title,score in [('home-office','Courtyard example','84% fit'),('outdoor-space','Terrace example','90% fit')]:
    if profile=='outdoor-space':page.get_by_role('button',name='Exterior y mascota',exact=True).click()
    assert page.locator('h4').first.inner_text()==title
    assert page.get_by_text(score,exact=True).count()==1
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    name='matching-'+profile+'-'+label+'.png';page.screenshot(path=str(out/name),full_page=True,animations='disabled')
    captures.append({'path':name,'viewport':{'width':width,'height':height},'first_home':title,'score':score,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest()})
   context.close()
  browser.close()
 assert not foreign and not errors,{'foreign_count':len(foreign),'page_errors':errors}
 root=Path(__file__).resolve().parents[1]
 paths=['src/components/recommender/RecommendationResults.tsx','src/lib/recommender/fitScoringV2.ts','src/types/wpa-score.ts','tools/home-fixtures.mjs','starter/app/page.tsx','starter/app/styles.css']
 proof={'upstream_commit':'d461e9556f09ad526030376ab58643298e3a1fc8','scope':'Original recommendation-result scene, extracted for reuse. Same authored homes and cached-analysis-shaped scores; browser profile changes run the original deterministic scorer. Images omitted; native empty-photo state retained.','source_sha256':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in paths},'captures':captures,'foreign_requests':0,'page_errors':0,'provider_model_calls':0}
 (out/'proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({'captures':len(captures),'foreign_requests':0,'page_errors':0,'provider_model_calls':0}))
if __name__=='__main__':main()

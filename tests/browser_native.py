import json,os,http.client
from urllib.parse import urlsplit
from pathlib import Path
from playwright.sync_api import sync_playwright
origin=os.environ.get('NATIVE_TEST_ORIGIN','http://127.0.0.1:4189'); base=origin+os.environ.get('NATIVE_TEST_BASE_PATH','/apps/home-matching'); checks={}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 a=b.new_context(viewport={'width':1600,'height':1000}); page=a.new_page(); foreign=[]
 page.route('**/*',lambda route: route.continue_() if route.request.url.startswith((origin,'data:','blob:')) else (foreign.append(route.request.url.split('/')[2]),route.abort())[-1])
 r=page.goto(base,wait_until='networkidle');checks['root_to_native_dashboard']=r.status==200 and page.url==base+'/dashboard'
 if not checks['root_to_native_dashboard']:print(json.dumps({'entry_status':r.status,'entry_path':urlsplit(page.url).path,'entry_host':urlsplit(page.url).netloc}))
 cookies=a.cookies();g=next(c for c in cookies if c['name']=='leo_home_sample_guest');checks['scoped_httponly_cookie']=g['httpOnly'] and g['sameSite']=='Lax' and g['path']==os.environ.get('NATIVE_TEST_BASE_PATH','/apps/home-matching')
 session=a.request.get(base+'/api/sample/session').json(); user=session['user'];checks['bearer_not_public_user_id']=user['id']!=g['value']
 page.goto(base+'/property/1000000001',wait_until='networkidle');page.get_by_placeholder('Escribe una nota...').fill('Review afternoon light during the viewing.');page.get_by_role('button',name='Añadir',exact=True).click();page.get_by_text('Review afternoon light during the viewing.',exact=True).wait_for();page.reload(wait_until='networkidle');checks['native_note_persists']=page.get_by_text('Review afternoon light during the viewing.',exact=True).count()==1
 save=page.get_by_role('button',name='Guardar',exact=True);was_saved=save.count()==0
 page.get_by_role('button',name='Guardado' if was_saved else 'Guardar',exact=True).click();page.reload(wait_until='networkidle');checks['native_save_persists']=page.get_by_role('button',name='Guardar' if was_saved else 'Guardado',exact=True).count()==1
 profile=a.request.get(base+'/api/recommender/profile').json()['profile']; pid=profile['id']; before=a.request.post(base+'/api/recommender/generate',data={'profileId':pid}).json()['results']['listings'];r=a.request.post(base+'/api/recommender/profile',data={'profileId':pid,'constraints':{**profile['constraints'],'maxBudget':205000},'household':{**profile['household'],'workSituation':'office'},'lifestyle':{**profile['lifestyle'],'mustHaves':['terraza','luz natural'],'dealbreakers':[]}});checks['profile_saved']=r.status==200 and r.json()['profile']['constraints']['maxBudget']==205000
 after=a.request.post(base+'/api/recommender/generate',data={'profileId':pid}).json()['results']['listings'];checks['cached_fit_changes_with_profile']=before!=after and len(after)>0
 page.goto(base+'/recommend',wait_until='networkidle');page.get_by_role('heading',name='Tus recomendaciones 🎯').wait_for();checks['native_recommend_renders_updated_fit']=True
 z=b.new_context(); zp=z.new_page();zp.goto(base+'/dashboard',wait_until='networkidle');other=z.request.get(base+'/api/recommender/profile').json()['profile'];checks['separate_guest_defaults']=other['id']!=pid and other['constraints']['maxBudget']==280000
 foreignprofile=z.request.get(base+'/api/recommender/profile?profileId='+pid).json();checks['foreign_profile_excluded']=foreignprofile.get('profile') is None
 checks['csrf_rejected']=a.request.post(base+'/api/recommender/profile',headers={'Origin':'https://foreign.example'},data={'profileId':pid}).status==403
 checks['provider_route_disabled']=a.request.post(base+'/api/listings/example.id/analysis/whole-property',data={}).status==503
 checks['catalogue_readonly']=bool(a.request.post(base+'/api/sample/query',data={'table':'listings','action':'update','values':{'price_eur':'1'},'filters':[],'orders':[],'limit':100}).json().get('error'))
 bad=b.new_context();bad.add_cookies([{'name':'leo_home_sample_guest','value':'malformed','url':base+'/'}]);bp=bad.new_page();br=bp.goto(base+'/profile',wait_until='networkidle');checks['malformed_cookie_renewed']=br.status==200 and bad.request.get(base+'/api/recommender/profile').status==200;bad.close()
 checks['declared_body_cap']=a.request.post(base+'/api/recommender/profile',data='x'*40000,headers={'Content-Type':'application/json'}).status==413
 parsed=urlsplit(origin);connection=(http.client.HTTPSConnection if parsed.scheme=='https' else http.client.HTTPConnection)(parsed.hostname,parsed.port,timeout=10)
 connection.request('POST',urlsplit(base).path+'/api/recommender/profile',body=iter([b'x'*20000,b'x'*20000]),headers={'Content-Type':'application/json'},encode_chunked=True);response=connection.getresponse();checks['streamed_body_cap']=response.status==413;response.read();connection.close()
 checks['no_foreign_requests']=not foreign
 # restore this proof guest only
 a.request.delete(base+'/api/sample/session')
 a.close();z.close();b.close()
Path(os.environ.get('NATIVE_TEST_RESULT','/tmp/home-native-interaction-proof.json')).write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps(checks,indent=2));
if not all(checks.values()):print(json.dumps({'foreign_hosts':foreign}))
assert all(checks.values())

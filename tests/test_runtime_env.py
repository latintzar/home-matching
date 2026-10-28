import contextlib,importlib.util,io,json,os,stat,tempfile,unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('runtime_env',Path(__file__).resolve().parents[1]/'tools/runtime-env.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)

class RuntimeConfigTests(unittest.TestCase):
 def setUp(self):
  self.temporary=tempfile.TemporaryDirectory();self.root=Path(self.temporary.name);self.root.chmod(0o700);self.file=self.root/'runtime.env'
 def tearDown(self):self.temporary.cleanup()
 def write(self,values):runtime.write_config(self.file,values)
 def test_atomic_private_write_and_read(self):
  self.write({'GEMINI_API_KEY':'synthetic fixture value'});self.assertEqual(stat.S_IMODE(self.file.stat().st_mode),0o600);self.assertEqual(runtime.read_config(self.file)['GEMINI_API_KEY'],'synthetic fixture value')
 def test_masked_doctor(self):
  self.write({'ELEVENLABS_API_KEY':'synthetic fixture value'});out=io.StringIO()
  with contextlib.redirect_stdout(out):self.assertEqual(runtime.main(['doctor','--file',str(self.file)]),0)
  self.assertNotIn('synthetic fixture value',out.getvalue());self.assertTrue(json.loads(out.getvalue())['fields']['ELEVENLABS_API_KEY'])
 def test_unknown_and_duplicate_fields_rejected(self):
  for body in ['UNSUPPORTED=value\n','GEMINI_API_KEY=a\nGEMINI_API_KEY=b\n']:
   self.file.write_text(body);self.file.chmod(0o600)
   with self.assertRaises(runtime.ConfigError):runtime.read_config(self.file)
 def test_checkout_and_relative_paths_rejected(self):
  for p in ['runtime.env',str(runtime.ROOT/'runtime.env')]:
   with self.assertRaises(runtime.ConfigError):runtime.private_path(p)
 def test_symlink_and_hardlink_rejected(self):
  self.write({});link=self.root/'link';link.symlink_to(self.file)
  with self.assertRaises(runtime.ConfigError):runtime.private_path(str(link))
  link.unlink();os.link(self.file,link)
  with self.assertRaises(runtime.ConfigError):runtime.private_path(str(self.file))
 def test_public_directory_rejected(self):
  self.root.chmod(0o755)
  with self.assertRaises(runtime.ConfigError):runtime.private_path(str(self.file))
 def test_selected_file_owns_cloud_environment(self):
  child=runtime.child_env({'GEMINI_API_KEY':'selected fixture'},{'AWS_PROFILE':'old','AWS_ACCESS_KEY_ID':'old','GOOGLE_API_KEY':'old','ELEVENLABS_API_KEY':'old','STRIPE_SECRET_KEY':'old','NEXT_PUBLIC_SUPABASE_URL':'old','PATH':'/bin'})
  self.assertEqual(child['GEMINI_API_KEY'],'selected fixture');self.assertEqual(child['PATH'],'/bin')
  for name in ['AWS_PROFILE','AWS_ACCESS_KEY_ID','GOOGLE_API_KEY','ELEVENLABS_API_KEY','STRIPE_SECRET_KEY','NEXT_PUBLIC_SUPABASE_URL']:self.assertNotIn(name,child)
  self.assertEqual(child['AWS_EC2_METADATA_DISABLED'],'true');self.assertEqual(child['AWS_SHARED_CREDENTIALS_FILE'],os.devnull)
 def test_google_adc_guard_and_explicit_selection(self):
  self.assertEqual(runtime.child_env({},{} )['GOOGLE_APPLICATION_CREDENTIALS'],'/recipient-google-credentials-not-configured')
  child=runtime.child_env({'GOOGLE_APPLICATION_CREDENTIALS':'/recipient/owned.json','GOOGLE_CLOUD_PROJECT_ID':'recipient-project'},{});self.assertEqual(child['GOOGLE_APPLICATION_CREDENTIALS'],'/recipient/owned.json');self.assertEqual(child['GOOGLE_CLOUD_PROJECT'],'recipient-project')
 def test_empty_values_keep_guards_and_missing_run_is_masked(self):
  self.assertEqual(runtime.child_env({'GOOGLE_APPLICATION_CREDENTIALS':''},{})['GOOGLE_APPLICATION_CREDENTIALS'],'/recipient-google-credentials-not-configured')
  out=io.StringIO()
  with contextlib.redirect_stderr(out):self.assertEqual(runtime.main(['run','--file',str(self.file),'--','python3','-V']),2)
  self.assertNotIn(str(self.file),out.getvalue())

if __name__=='__main__':unittest.main()

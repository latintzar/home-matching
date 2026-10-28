import {exampleAnalysis} from '../../../tools/home-fixtures.mjs';

export const sampleVersion = 'native-workspace-v1';
export const sampleDate = '2026-01-01T12:00:00.000Z';
/** @type {any[]} */
const definitions = [
  ['1000000001', 'Piso luminoso en Gràcia', 245000, 72, 2, 'Gràcia', 'interior-spanish-apartment', {natural_light_intensity:88,wfh_potential:92,outdoor_space_quality:35,street_exposure:85}],
  ['1000000002', 'Ático con terraza en Poble-sec', 259000, 65, 2, 'Poble-sec', 'renters-balcony-view', {natural_light_intensity:94,wfh_potential:55,outdoor_space_quality:96,street_exposure:65}],
  ['1000000003', 'Piso tranquilo en Sant Antoni', 228000, 78, 3, 'Sant Antoni', 'listing-staged-beautiful', {natural_light_intensity:77,wfh_potential:83,outdoor_space_quality:18,street_exposure:95}],
  ['1000000004', 'Piso con estudio en Poblenou', 275000, 84, 3, 'Poblenou', 'renters-morning-light', {natural_light_intensity:90,wfh_potential:97,outdoor_space_quality:42,street_exposure:82}],
  ['1000000005', 'Apartamento junto al mercado', 198000, 60, 2, 'Sants', 'reality-nice-light', {natural_light_intensity:72,wfh_potential:62,outdoor_space_quality:12,street_exposure:72}],
  ['1000000006', 'Piso para actualizar en Sants', 180000, 92, 3, 'Sants', 'reality-dark-corner', {natural_light_intensity:80,wfh_potential:75,outdoor_space_quality:55,renovation_state:35,signs_of_aging:40}],
  ['1000000007', 'Piso familiar en Les Corts', 279000, 91, 3, 'Les Corts', 'property-card-apartment', {natural_light_intensity:85,wfh_potential:79,outdoor_space_quality:64,balcony_security:92,bedroom_size_fit:90}],
  ['1000000008', 'Piso con balcón en Sagrada Família', 265000, 74, 2, 'Sagrada Família', 'checklist-look-feel', {natural_light_intensity:93,wfh_potential:68,outdoor_space_quality:84,street_exposure:68}],
];

export function sampleHomes(base = '') {
  return definitions.map(([id,title,price,sqm,bedrooms,neighborhood,image,scores]) => {
    const photos = [image, 'building-spanish-facade', 'checklist-look-feel', 'reality-nice-light'];
    const image_urls = photos.map(name => base + '/images/landing/' + name + '.webp');
    const listing = {id,listing_id:id,title,price,price_eur:String(price),sqm,bedrooms,bathrooms:1,
      city:'Barcelona',region:'Barcelona',neighborhood,address:neighborhood,
      url:base+'/property/'+id,source_url:'',image_urls,
      description:'Vivienda con salón, cocina independiente y espacios para trabajar en casa. Revisa las fotografías, compara el encaje con tu perfil y guarda tus notas para la visita.',
      created_at:sampleDate,property_type:'piso',status:'active'};
    return {listing,wpa:exampleAnalysis(id,scores),neighborhood:{scores:{quietness:85,safety_overall:78,digital_nomad:88,family_friendly:80}}};
  });
}

export function sampleUser(id) {
  return {id,aud:'authenticated',role:'authenticated',email:'lucia@example.invalid',
    user_metadata:{full_name:'Lucía Martín',sample:true},app_metadata:{provider:'sample'},
    created_at:sampleDate,is_pro:false,subscription_plan:'personal'};
}

/** Bridge the two retained profile column generations without regenerating WPA. */
export function normalizeProfile(row, changed = row) {
  for(const [legacy,native] of [['max_budget','budget_max'],['min_bedrooms','bedrooms_min'],
    ['min_bathrooms','bathrooms_min'],['preferred_locations','preferred_areas'],['commute_destination','work_location']]) {
    if(Object.hasOwn(changed,legacy))row[native]=row[legacy];
    else if(Object.hasOwn(changed,native))row[legacy]=row[native];
    else if(row[legacy]!==undefined)row[native]=row[legacy];
    else if(row[native]!==undefined)row[legacy]=row[native];
  }
  if(row.budget_max!==undefined)row.budget_min=Math.min(row.budget_min||180000,Number(row.budget_max));
  if(row.intake_completed) {
    const place=Array.isArray(row.preferred_areas)?row.preferred_areas[0]:'';
    row.needs_summary={headline:row.work_situation==='remote'?'Un hogar para trabajar desde casa':'Un hogar'+(place?' en '+place:''),
      bullets:[row.budget_max?'Hasta '+Number(row.budget_max).toLocaleString('es-ES')+' €':null,
        row.bedrooms_min?row.bedrooms_min+' habitaciones o más':null,
        ...(Array.isArray(row.must_haves)?row.must_haves.slice(0,2):[])].filter(Boolean)};
  }
  return row;
}

export function initialTables(userId) {
  const profile = {id:userId,user_id:userId,profile_type:'buyer',language:'es',
    adults:2,children:[],pets:[],work_situation:'remote',morning_routine:'Trabajar desde casa con luz natural',
    evening_routine:'Cocinar y pasear por el barrio',weekend_activities:['cocinar','pasear'],
    dealbreakers:['ruido'],must_haves:['luz natural','espacio para trabajar'],max_budget:280000,
    max_commute_minutes:30,commute_destination:'Barcelona',renovation_appetite:'cosmetic',move_in_date:null,
    tradeoff_space_vs_location:0,tradeoff_new_vs_character:0,tradeoff_quiet_vs_vibrant:-2,tradeoff_views_vs_privacy:0,
    property_types:['piso'],min_bedrooms:2,min_bathrooms:1,min_sqm:60,preferred_locations:['Barcelona'],avoid_locations:[],
    intake_completed:true,intake_step:5,lifestyle_notes:'Trabajamos desde casa y valoramos la luz natural y un barrio tranquilo.',created_at:sampleDate,updated_at:sampleDate};
  normalizeProfile(profile);
  return {user_profiles:[{id:userId,full_name:'Lucía Martín',active_profile_type:'buyer',language:'es'}],
    user_lifestyle_profiles:[profile],subscriptions:[{id:'sample-plan',user_id:userId,plan_id:'personal',status:'active'}],
    saved_properties:[{id:'saved-one',user_id:userId,listing_id:'1000000001',profile_type:'buyer',created_at:sampleDate},
      {id:'saved-two',user_id:userId,listing_id:'1000000002',profile_type:'buyer',created_at:sampleDate}],
    property_views:[{id:'view-one',user_id:userId,listing_id:'1000000001',profile_type:'buyer',viewing_completed:true,viewed_at:sampleDate,viewing_completed_at:sampleDate,created_at:sampleDate}],
    property_notes:[{id:'note-one',user_id:userId,listing_id:'1000000001',profile_type:'buyer',note_type:'text',content:'Comprobar la luz del estudio por la tarde.',created_at:sampleDate}],
    user_settings:[],agents:[]};
}

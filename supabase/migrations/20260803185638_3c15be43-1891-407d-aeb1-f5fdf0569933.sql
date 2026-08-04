
-- ENUMS
CREATE TYPE public.verification_state AS ENUM ('unverified','verified','duplicate_held','rejected','removed');
CREATE TYPE public.camp_status AS ENUM ('active','inactive');
CREATE TYPE public.urgency_level AS ENUM ('normal','high','critical');
CREATE TYPE public.lsg_type AS ENUM ('panchayat','municipality','corporation');
CREATE TYPE public.building_type AS ENUM ('school','college','community_hall','place_of_worship','government_building','other');
CREATE TYPE public.source_type AS ENUM ('public_submission','official_pdf','ksdma_release','news_report','whatsapp_group','phone_tipoff','internal_volunteer');
CREATE TYPE public.verification_method AS ENUM ('phone_call','official_document','site_visit','known_contact','cross_reference');
CREATE TYPE public.reporter_relationship AS ENUM ('resident','volunteer','camp_staff','official','other');
CREATE TYPE public.reporter_gender AS ENUM ('male','female','other','prefer_not_to_say');
CREATE TYPE public.image_quality_status AS ENUM ('pass','warn','fail');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- GEOGRAPHY
CREATE TABLE public.districts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ml TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  sort_order INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.districts TO anon, authenticated;
GRANT ALL ON public.districts TO service_role;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "districts are public" ON public.districts FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.taluks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_code TEXT NOT NULL REFERENCES public.districts(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_ml TEXT,
  UNIQUE (district_code, name)
);
GRANT SELECT ON public.taluks TO anon, authenticated;
GRANT ALL ON public.taluks TO service_role;
ALTER TABLE public.taluks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taluks are public" ON public.taluks FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.lsg_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_code TEXT NOT NULL REFERENCES public.districts(code) ON DELETE CASCADE,
  taluk_name TEXT,
  lsg_type public.lsg_type NOT NULL,
  name TEXT NOT NULL,
  name_ml TEXT,
  verified_source BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (district_code, lsg_type, name)
);
GRANT SELECT ON public.lsg_bodies TO anon, authenticated;
GRANT ALL ON public.lsg_bodies TO service_role;
ALTER TABLE public.lsg_bodies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lsg bodies are public" ON public.lsg_bodies FOR SELECT TO anon, authenticated USING (true);

-- SOURCES
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.source_type NOT NULL,
  label TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  url_or_reference TEXT,
  reliability_note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sources TO anon, authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources are public" ON public.sources FOR SELECT TO anon, authenticated USING (true);

-- CAMPS
CREATE TABLE public.camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ml TEXT,
  building_type public.building_type,
  district_code TEXT NOT NULL REFERENCES public.districts(code),
  taluk TEXT NOT NULL,
  lsg_type public.lsg_type NOT NULL,
  lsg_name TEXT NOT NULL,
  village_or_locality TEXT,
  landmark TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  location_accuracy_m INTEGER,
  camp_incharge_name TEXT,
  camp_phone_primary TEXT,
  camp_phone_secondary TEXT,
  verification_state public.verification_state NOT NULL DEFAULT 'unverified',
  status public.camp_status NOT NULL DEFAULT 'active',
  urgency public.urgency_level NOT NULL DEFAULT 'normal',
  reported_urgency public.urgency_level,
  reported_urgency_reason TEXT,
  status_last_confirmed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  verification_method public.verification_method,
  verification_note TEXT,
  duplicate_of UUID REFERENCES public.camps(id),
  report_count INTEGER NOT NULL DEFAULT 1,
  source_published_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX camps_public_idx ON public.camps (verification_state, status);
CREATE INDEX camps_district_idx ON public.camps (district_code, taluk);
CREATE TRIGGER camps_updated_at BEFORE UPDATE ON public.camps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.camps TO anon, authenticated;
GRANT ALL ON public.camps TO service_role;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publicly listable camps" ON public.camps FOR SELECT TO anon, authenticated
  USING (verification_state IN ('unverified','verified'));

CREATE TABLE public.camp_sources (
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (camp_id, source_id)
);
GRANT SELECT ON public.camp_sources TO anon, authenticated;
GRANT ALL ON public.camp_sources TO service_role;
ALTER TABLE public.camp_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camp sources are public" ON public.camp_sources FOR SELECT TO anon, authenticated USING (true);

-- REPORTS (reporter PII: server-only)
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE,
  camp_id UUID REFERENCES public.camps(id) ON DELETE SET NULL,
  is_correction BOOLEAN NOT NULL DEFAULT false,
  correction_note TEXT,
  reporter_name TEXT NOT NULL,
  reporter_phone_primary TEXT NOT NULL,
  reporter_phone_secondary TEXT,
  reporter_gender public.reporter_gender,
  reporter_relationship public.reporter_relationship,
  phone_verified_at TIMESTAMPTZ,
  phone_unverified BOOLEAN NOT NULL DEFAULT false,
  submitted_lat NUMERIC(9,6),
  submitted_lng NUMERIC(9,6),
  device_location_granted BOOLEAN NOT NULL DEFAULT false,
  reported_status public.camp_status NOT NULL DEFAULT 'active',
  reported_urgency public.urgency_level NOT NULL DEFAULT 'normal',
  reported_urgency_reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ip_hash TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.report_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  camp_id UUID REFERENCES public.camps(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  sha256 TEXT,
  blur_score REAL,
  brightness_score REAL,
  exif_lat NUMERIC(9,6),
  exif_lng NUMERIC(9,6),
  exif_captured_at TIMESTAMPTZ,
  quality_status public.image_quality_status NOT NULL DEFAULT 'pass',
  quality_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT (id, camp_id, storage_path, width, height, created_at, hidden) ON public.report_images TO anon, authenticated;
GRANT ALL ON public.report_images TO service_role;
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camp images are public" ON public.report_images FOR SELECT TO anon, authenticated
  USING (hidden = false AND camp_id IS NOT NULL);

-- OTP
CREATE TABLE public.otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  delivery_failed BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX otp_phone_idx ON public.otp_challenges (phone, created_at DESC);
GRANT ALL ON public.otp_challenges TO service_role;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;

-- EMERGENCY CONTACTS
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('state','district')),
  district_code TEXT REFERENCES public.districts(code) ON DELETE CASCADE,
  label TEXT NOT NULL,
  label_ml TEXT,
  phone TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  last_verified_at TIMESTAMPTZ
);
GRANT SELECT ON public.emergency_contacts TO anon, authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency contacts are public" ON public.emergency_contacts FOR SELECT TO anon, authenticated USING (active);

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin','public','system')),
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  note TEXT
);
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- SETTINGS
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings are public" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.app_settings (key, value, description) VALUES
 ('duplicate_radius_m', '150', 'Geodesic radius for duplicate detection'),
 ('name_similarity_threshold', '0.85', 'Normalised camp-name similarity threshold'),
 ('blur_threshold', '100', 'Laplacian variance floor for image blur warning'),
 ('staleness_caution_hours', '24', 'Hours after which a camp shows a caution indicator'),
 ('staleness_warning_hours', '72', 'Hours after which a camp shows a strong staleness warning');

-- DISTRICTS
INSERT INTO public.districts (code, name, name_ml, latitude, longitude, sort_order) VALUES
 ('TVM','Thiruvananthapuram','തിരുവനന്തപുരം',8.5241,76.9366,1),
 ('KLM','Kollam','കൊല്ലം',8.8932,76.6141,2),
 ('PTA','Pathanamthitta','പത്തനംതിട്ട',9.2648,76.7870,3),
 ('ALP','Alappuzha','ആലപ്പുഴ',9.4981,76.3388,4),
 ('KTM','Kottayam','കോട്ടയം',9.5916,76.5222,5),
 ('IDK','Idukki','ഇടുക്കി',9.8497,76.9784,6),
 ('EKM','Ernakulam','എറണാകുളം',9.9816,76.2999,7),
 ('TSR','Thrissur','തൃശ്ശൂർ',10.5276,76.2144,8),
 ('PKD','Palakkad','പാലക്കാട്',10.7867,76.6548,9),
 ('MPM','Malappuram','മലപ്പുറം',11.0510,76.0711,10),
 ('KKD','Kozhikode','കോഴിക്കോട്',11.2588,75.7804,11),
 ('WYD','Wayanad','വയനാട്',11.6854,76.1320,12),
 ('KNR','Kannur','കണ്ണൂർ',11.8745,75.3704,13),
 ('KSD','Kasaragod','കാസർഗോഡ്',12.4996,74.9869,14);

INSERT INTO public.taluks (district_code, name) VALUES
 ('TVM','Thiruvananthapuram'),('TVM','Chirayinkeezhu'),('TVM','Nedumangad'),('TVM','Neyyattinkara'),('TVM','Kattakada'),('TVM','Varkala'),
 ('KLM','Kollam'),('KLM','Karunagappally'),('KLM','Kottarakkara'),('KLM','Kunnathur'),('KLM','Pathanapuram'),('KLM','Punalur'),
 ('PTA','Adoor'),('PTA','Konni'),('PTA','Kozhencherry'),('PTA','Mallappally'),('PTA','Ranni'),('PTA','Thiruvalla'),
 ('ALP','Ambalappuzha'),('ALP','Chengannur'),('ALP','Cherthala'),('ALP','Karthikappally'),('ALP','Kuttanad'),('ALP','Mavelikkara'),
 ('KTM','Changanassery'),('KTM','Kottayam'),('KTM','Vaikom'),('KTM','Meenachil'),('KTM','Kanjirappally'),
 ('IDK','Devikulam'),('IDK','Udumbanchola'),('IDK','Thodupuzha'),('IDK','Peermade'),('IDK','Idukki'),
 ('EKM','Aluva'),('EKM','Kanayannur'),('EKM','Kochi'),('EKM','Kothamangalam'),('EKM','Kunnathunad'),('EKM','Muvattupuzha'),('EKM','Paravur'),
 ('TSR','Chalakudy'),('TSR','Chavakkad'),('TSR','Kodungallur'),('TSR','Mukundapuram'),('TSR','Thalapilly'),('TSR','Thrissur'),('TSR','Kunnamkulam'),
 ('PKD','Alathur'),('PKD','Chittur'),('PKD','Mannarkkad'),('PKD','Ottappalam'),('PKD','Palakkad'),('PKD','Pattambi'),('PKD','Thrithala'),
 ('MPM','Eranad'),('MPM','Nilambur'),('MPM','Perinthalmanna'),('MPM','Ponnani'),('MPM','Tirur'),('MPM','Tirurangadi'),('MPM','Kondotty'),
 ('KKD','Koyilandy'),('KKD','Kozhikode'),('KKD','Thamarassery'),('KKD','Vatakara'),
 ('WYD','Mananthavady'),('WYD','Sulthan Bathery'),('WYD','Vythiri'),
 ('KNR','Kannur'),('KNR','Taliparamba'),('KNR','Thalassery'),('KNR','Payyanur'),('KNR','Iritty'),
 ('KSD','Kasaragod'),('KSD','Hosdurg'),('KSD','Manjeshwaram'),('KSD','Vellarikundu');

-- STATEWIDE EMERGENCY NUMBERS
INSERT INTO public.emergency_contacts (scope, label, label_ml, phone, sort_order) VALUES
 ('state','State Emergency Operations Centre','സംസ്ഥാന എമർജൻസി ഓപ്പറേഷൻസ് സെന്റർ','1070',1),
 ('state','District Emergency Operations Centre','ജില്ലാ എമർജൻസി ഓപ്പറേഷൻസ് സെന്റർ','1077',2),
 ('state','Emergency Response Support System','എമർജൻസി റെസ്പോൺസ് സപ്പോർട്ട് സിസ്റ്റം','112',3),
 ('state','Fire and Rescue','ഫയർ ആൻഡ് റെസ്ക്യൂ','101',4),
 ('state','Ambulance','ആംബുലൻസ്','108',5),
 ('state','Childline','ചൈൽഡ്‌ലൈൻ','1098',6),
 ('state','Women''s Helpline','വനിതാ ഹെൽപ്‌ലൈൻ','1091',7);

-- SEED SOURCE + PRE-DESIGNATED CAMP BUILDINGS (closed until confirmed)
INSERT INTO public.sources (id, type, label, url_or_reference, reliability_note) VALUES
 ('11111111-1111-4111-8111-111111111111','official_pdf','Pathanamthitta Collectorate — taluk-wise proposed relief camps','https://pathanamthitta.nic.in/en/relief-camps/','Pre-designated buildings published pre-monsoon. Not live camp status.');

INSERT INTO public.camps (id, name, building_type, district_code, taluk, lsg_type, lsg_name, village_or_locality, verification_state, status, verification_method, verified_at, report_count)
VALUES
 ('22222222-2222-4222-8222-000000000001','Govt. HSS Vadasserikkara','school','PTA','Ranni','panchayat','Ranni-Pazhavangadi','Vadasserikkara','verified','inactive','official_document', now(), 0),
 ('22222222-2222-4222-8222-000000000002','St. Thomas HSS Ranni','school','PTA','Ranni','panchayat','Ranni','Ranni Town','verified','inactive','official_document', now(), 0),
 ('22222222-2222-4222-8222-000000000003','Govt. VHSS Kozhencherry','school','PTA','Kozhencherry','panchayat','Kozhencherry','Kozhencherry','verified','inactive','official_document', now(), 0),
 ('22222222-2222-4222-8222-000000000004','Govt. Boys HSS Adoor','school','PTA','Adoor','municipality','Adoor','Adoor','verified','inactive','official_document', now(), 0),
 ('22222222-2222-4222-8222-000000000005','Marthoma HSS Thiruvalla','school','PTA','Thiruvalla','municipality','Thiruvalla','Thiruvalla','verified','inactive','official_document', now(), 0),
 ('22222222-2222-4222-8222-000000000006','Govt. UPS Mallappally','school','PTA','Mallappally','panchayat','Mallappally','Mallappally','verified','inactive','official_document', now(), 0),
 ('22222222-2222-4222-8222-000000000007','Govt. HSS Konni','school','PTA','Konni','panchayat','Konni','Konni','verified','inactive','official_document', now(), 0);

INSERT INTO public.camp_sources (camp_id, source_id)
SELECT id, '11111111-1111-4111-8111-111111111111' FROM public.camps;

INSERT INTO public.lsg_bodies (district_code, taluk_name, lsg_type, name, verified_source)
SELECT DISTINCT district_code, taluk, lsg_type, lsg_name, false FROM public.camps;

/**
 * Supabase Configuration — Yeremchuk Dental Training
 *
 * SETUP STEPS:
 * 1. Go to https://supabase.com/dashboard → Create project "yeremchuk-dental"
 * 2. In SQL Editor run the schema from dashboard.html (or copy from below)
 * 3. Go to Project Settings → API → copy URL and anon key
 * 4. Replace the two values below
 * 5. Redeploy: netlify deploy --prod --dir=. (from D:/cloude agents/dental_training/course)
 *
 * SQL SCHEMA (run in Supabase SQL Editor):
 * ─────────────────────────────────────────
 * CREATE TABLE doctors (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   clinic TEXT NOT NULL,
 *   pin TEXT NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * CREATE TABLE progress (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
 *   module_key TEXT NOT NULL,
 *   score INTEGER,
 *   completed_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(doctor_id, module_key)
 * );
 * ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "anon_all_doctors"  ON doctors  FOR ALL USING (true) WITH CHECK (true);
 * CREATE POLICY "anon_all_progress" ON progress FOR ALL USING (true) WITH CHECK (true);
 * ─────────────────────────────────────────
 */

window.DENTAL_SUPABASE_URL  = 'https://vzqjirjvoqcxetcaggan.supabase.co';
window.DENTAL_SUPABASE_KEY  = 'sb_publishable_7CtOW0T6vfnGhsw78SJIWw_43ERPQpA';

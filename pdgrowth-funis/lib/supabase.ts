import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy init evita crash em build-time (page data collection) quando as env
// vars ainda não estão presentes. Em runtime as vars vêm do Vercel.

let _service: SupabaseClient | null = null;
let _public:  SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (_service) return _service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  _service = createClient(url, key);
  return _service;
}

export function getSupabase(): SupabaseClient {
  if (_public) return _public;
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase env vars missing.");
  _public = createClient(url, anon);
  return _public;
}

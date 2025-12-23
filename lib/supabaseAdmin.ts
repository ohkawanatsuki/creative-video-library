// lib/supabaseAdmin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRole) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

// サーバー側のみで使うこと（Client Component から import しない）
export const supabaseAdmin = createClient(url, serviceRole, {
  auth: { persistSession: false },
});
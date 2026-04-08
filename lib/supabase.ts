import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("SUPABASE URL =", url);
console.log("SUPABASE KEY EXISTS =", !!key);

if (!url) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL");
}

if (!key) {
  throw new Error("缺少 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 或 NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, key);
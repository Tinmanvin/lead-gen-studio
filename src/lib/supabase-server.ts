import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — defers creation until first use so module import during
// Trigger.dev's index phase doesn't fail if env vars aren't set yet.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    const c = getClient();
    const val = (c as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") return (val as Function).bind(c);
    return val;
  },
});

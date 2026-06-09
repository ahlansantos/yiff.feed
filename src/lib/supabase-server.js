import { createServerClient } from "@supabase/ssr";

// Builds a Supabase server client wired to a cookie store.
// Used by the auth callback route and the middleware so the
// createServerClient({ cookies: { getAll, setAll } }) wiring lives in one place.
export function createServerClientWithCookies({ getAll, setAll }) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: { getAll, setAll },
    }
  );
}

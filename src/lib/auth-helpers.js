// Email-free auth helpers.
//
// Supabase Auth requires an email under the hood, but users only ever
// deal with a username + password. We synthesize a stable, non-routable
// email from the username so Supabase is happy while no real email is
// ever sent (no confirmation mail, no rate limits).

// Non-routable domain — RFC 6761 reserves .local-style names for this;
// these addresses can never receive mail, which is exactly what we want.
const SYNTHETIC_EMAIL_DOMAIN = "users.yiff.local";

// Normalize a username the same way everywhere (signup + login) so the
// synthetic email is deterministic.
export function normalizeUsername(username) {
  return username.toLowerCase().trim();
}

// username -> hidden email used internally by Supabase Auth.
export function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

// A readable one-time recovery code, e.g. "yf-8F3K-92AB-7QZM".
export function generateToken() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    if (i > 0 && i % 4 === 0) out += "-";
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `yf-${out}`;
}

// SHA-256 hash of a token, hex-encoded — we store the hash, never the
// plaintext token.
export async function hashToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

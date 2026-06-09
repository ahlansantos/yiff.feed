"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  usernameToEmail,
  normalizeUsername,
  generateToken,
  hashToken,
} from "@/lib/auth-helpers";

export default function AuthModal({ mode, onClose, onSwitch }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // After a successful signup we show the recovery code once.
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  async function handleGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const clean = normalizeUsername(username);
    if (!clean) {
      setError("Pick a username");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // Synthetic email — the user never sees or types this.
    const email = usernameToEmail(clean);

    if (mode === "login") {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) {
        // Supabase reports the synthetic email; keep the message about
        // the username instead so it makes sense to the user.
        setError("Wrong username or password");
      } else {
        onClose();
      }
      setLoading(false);
      return;
    }

    // --- Register ---
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError) {
      setError(
        /already registered/i.test(signUpError.message)
          ? "That username is taken"
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    // Generate the one-time recovery code and store only its hash.
    const token = generateToken();
    const recovery_token_hash = await hashToken(token);

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        username: clean,
        fursona_name: clean,
        display_name: clean,
        recovery_token_hash,
      });
    }

    // Make sure we're actually signed in (works once email confirmation
    // is disabled in Supabase; harmless otherwise).
    if (!data.session) {
      await supabase.auth.signInWithPassword({ email, password });
    }

    // Show the recovery code once. Closing logs the user in (the
    // session already exists; the homepage auth listener picks it up).
    setRecoveryCode(token);
    setLoading(false);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; user can still select the text */
    }
  }

  const inputClass =
    "bg-muted rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring transition-shadow";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={recoveryCode ? undefined : onClose}
    >
      <div
        className="surface p-6 w-full max-w-sm flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {recoveryCode ? (
          <>
            <div>
              <h2 className="text-xl font-semibold">Save your recovery code</h2>
              <p className="text-muted-foreground text-sm mt-1">
                This is the only time you&apos;ll see it. Keep it somewhere
                safe — it&apos;s a backup in case you forget your password.
              </p>
            </div>

            <div className="bg-muted rounded-lg px-4 py-3 text-center font-mono text-base tracking-wide select-all break-all">
              {recoveryCode}
            </div>

            <Button variant="outline" className="w-full" onClick={copyCode}>
              {copied ? "Copied!" : "Copy code"}
            </Button>

            <Button className="w-full" onClick={onClose}>
              I&apos;ve saved it — continue
            </Button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-semibold">
                {mode === "login" ? "Welcome back" : "Join yiff.feed"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {mode === "login"
                  ? "Log in with your username"
                  : "Create your free account — no email needed"}
              </p>
            </div>

            {error && (
              <div className="text-destructive text-xs text-center bg-destructive/10 rounded-lg px-4 py-3 border border-destructive/20">
                {error}
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={handleGitHub}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Continue with GitHub
            </Button>

            <Button variant="outline" className="w-full" onClick={handleDiscord}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Continue with Discord
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex flex-col gap-2.5">
              <input
                className={inputClass}
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <input
                className={inputClass}
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {mode === "register" && (
              <p className="text-xs text-muted-foreground text-center -mt-1">
                You&apos;ll get a one-time recovery code. No email required.
              </p>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={loading}>
              {loading ? "..." : mode === "login" ? "Log in" : "Create account"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {mode === "login" ? "No account? " : "Already have one? "}
              <button
                onClick={() => onSwitch(mode === "login" ? "register" : "login")}
                className="underline underline-offset-2 text-foreground hover:text-accent transition-colors"
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

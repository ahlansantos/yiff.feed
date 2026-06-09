"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export default function AuthModal({ mode, onClose, onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    if (mode === "login") {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) setError(loginError.message);
      else onClose();
    } else {
      if (!username.trim()) {
        setError("Pick a username");
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        const cleanUsername = username.toLowerCase().trim();
        await supabase.from("profiles").upsert({
          id: data.user.id,
          username: cleanUsername,
          fursona_name: cleanUsername,
          display_name: cleanUsername,
        });
        setSuccess(true);
      }
    }

    setLoading(false);
  }

  const inputClass =
    "bg-muted rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-ring transition-shadow";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="surface p-6 w-full max-w-sm flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-xl font-semibold">
            {success
              ? "Welcome to the pack!"
              : mode === "login"
              ? "Welcome back"
              : "Join yiff.feed"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {success
              ? "Check your email to activate your account."
              : mode === "login"
              ? "Log in to your account"
              : "Create your free account"}
          </p>
        </div>

        {success ? (
          <Button className="w-full" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
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

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex flex-col gap-2.5">
              <input
                className={inputClass}
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {mode === "register" && (
                <input
                  className={inputClass}
                  placeholder="Username (e.g. wolfpaw)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              )}
            </div>

            {mode === "register" && (
              <p className="text-xs text-muted-foreground text-center -mt-1">
                You can set your fursona name, species, and photo later on your profile.
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

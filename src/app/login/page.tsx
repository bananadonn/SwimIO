"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorParam ?? null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setMessage(null);
    const supabase = createClient();
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      if (mode === "sign_up") {
        if (!username.trim()) { setError("Username is required."); setLoading(false); return; }
        const { error: e } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { username: username.trim() } },
        });
        if (e) { setError(e.message); return; }
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) { setError(e.message); return; }
        router.push("/");
      }
    } finally {
      setLoading(false);
    }
  }, [mode, email, password, username, router]);

  const handleGoogle = useCallback(async () => {
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (e) setError(e.message);
  }, []);

  const switchMode = (m: Mode) => { setMode(m); setError(null); setMessage(null); };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-base">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <Link href="/" className="self-start text-xs text-muted hover:text-text transition-colors duration-150">
            ← Home
          </Link>
          <h1 className="font-display text-4xl tracking-wide text-text">
            {mode === "sign_in" ? "SIGN IN" : "JOIN UP"}
          </h1>
          <p className="text-muted text-sm">
            {mode === "sign_in" ? "Welcome back. Let's race." : "Create your athlete profile."}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <p className="text-sm text-coral bg-coral/10 border border-coral/20 rounded-xl px-4 py-3">
            {error === "auth_failed" ? "Authentication failed. Try again." : error}
          </p>
        )}
        {message && (
          <p className="text-sm text-green-400 bg-green-900/10 border border-green-900/30 rounded-xl px-4 py-3">
            {message}
          </p>
        )}

        {/* Fields */}
        <div className="flex flex-col gap-2.5">
          {mode === "sign_up" && (
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              maxLength={24}
              className="rounded-xl bg-surface border border-surface-2 px-4 py-3 text-sm text-text placeholder-muted outline-none focus:border-pool/50 transition-colors duration-150"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="Email"
            className="rounded-xl bg-surface border border-surface-2 px-4 py-3 text-sm text-text placeholder-muted outline-none focus:border-pool/50 transition-colors duration-150"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            placeholder="Password"
            className="rounded-xl bg-surface border border-surface-2 px-4 py-3 text-sm text-text placeholder-muted outline-none focus:border-pool/50 transition-colors duration-150"
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-pool hover:bg-[#1ABEF5] disabled:opacity-40 py-3 font-display text-lg tracking-wide text-base transition-colors duration-150 mt-1"
          >
            {loading ? "…" : mode === "sign_in" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-surface-2" />
          <span className="text-xs text-muted/40 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-surface-2" />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          className="rounded-xl bg-surface hover:bg-surface-2 border border-surface-2 py-3 text-sm font-medium text-text transition-colors duration-150 flex items-center justify-center gap-2.5"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Switch mode */}
        <p className="text-center text-xs text-muted/50">
          {mode === "sign_in" ? (
            <>No account?{" "}
              <button onClick={() => switchMode("sign_up")} className="text-pool hover:text-[#1ABEF5] transition-colors">
                Create one
              </button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => switchMode("sign_in")} className="text-pool hover:text-[#1ABEF5] transition-colors">
                Sign in
              </button>
            </>
          )}
        </p>

      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

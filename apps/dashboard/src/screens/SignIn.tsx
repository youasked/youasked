import { useState, type FormEvent } from "react";
import { api, signInUrl } from "../api";
import { mockEnabled } from "../mock";
import { Button, ErrorState, GitHubMark, GoogleG, Icon, Mark, Spinner, useFail, useLoad } from "../ui";

type Providers = { google: boolean; github: boolean; email: boolean };

const LOGIN_ERRORS: Record<string, string> = {
  link_expired: "That sign-in link has expired. Request a new one below.",
  link_invalid: "That sign-in link isn't valid, or it was already used. Request a new one below.",
  bad_state: "Sign-in took too long or was opened in a different browser. Please try again.",
  denied: "Sign-in was canceled. You can try again whenever you like.",
  provider_unavailable: "That sign-in option isn't available right now. Try another way.",
  provider_error: "The provider had a problem signing you in. Try again, or use another way.",
  email_unverified: "That account's email isn't verified with the provider. Verify it there, or use an email link instead.",
};

export function SignIn({ next, onSignedIn, error }: { next: string; onSignedIn: () => void; error?: string | null }) {
  const providers = useLoad(() => api<Providers>("/v1/auth/providers"), []);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const fail = useFail();
  const mock = mockEnabled();

  const oauth = async (p: "google" | "github") => {
    if (mock) {
      await api("/v1/auth/mock-login");
      onSignedIn();
    } else location.href = signInUrl(p, next);
  };
  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/v1/auth/email", { method: "POST", body: { email: email.trim(), next } });
      setSent(true);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const p = providers.data;
  return (
    <div className="signin">
      <div className="signin-card">
        <Mark className="signin-mark" />
        {sent ? (
          <div className="sent" role="status">
            <h1>Check your email</h1>
            <p>
              We sent a sign-in link to <b>{email}</b>. It works for 15 minutes. If it doesn't show up, look in spam, or{" "}
              <button className="linklike" onClick={() => setSent(false)}>try a different address</button>.
            </p>
            {mock && <Button onClick={() => oauth("google")}>Mock: open the link</Button>}
          </div>
        ) : (
          <>
            <h1>Sign in to YouAsked</h1>
            <p className="sub">Feature requests that tell people when you ship.</p>
            {error && <p className="inline-error" role="alert"><Icon name="warn" size={16} /> {LOGIN_ERRORS[error] ?? "Sign-in didn't work. Try again."}</p>}
            {providers.loading && !p && <Spinner />}
            {providers.error != null && <ErrorState error={providers.error} retry={providers.retry} />}
            {p && (
              <div className="signin-actions">
                {p.google && (
                  <Button className="btn-wide" onClick={() => oauth("google")}>
                    <GoogleG /> Continue with Google
                  </Button>
                )}
                {p.github && (
                  <Button className="btn-wide" onClick={() => oauth("github")}>
                    <GitHubMark /> Continue with GitHub
                  </Button>
                )}
                {p.email && (p.google || p.github) && <div className="or"><span>or</span></div>}
                {p.email && (
                  <form onSubmit={sendLink}>
                    <label htmlFor="email" className="sr-only">Email address</label>
                    <input id="email" className="input" type="email" required placeholder="you@company.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Button kind="primary" type="submit" busy={busy} className="btn-wide">
                      <Icon name="mail" size={16} /> Email me a sign-in link
                    </Button>
                  </form>
                )}
                {!p.google && !p.github && !p.email && (
                  <p className="hint">Sign-in isn't set up on this server yet. If you run it yourself, add a Google, GitHub or email provider.</p>
                )}
              </div>
            )}
          </>
        )}
        <p className="legal">New here? Signing in creates your account. Test mode is free; plans come with a 14-day money-back guarantee.</p>
      </div>
    </div>
  );
}

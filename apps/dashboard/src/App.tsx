import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type Me } from "./api";
import { navigate, useRoute } from "./router";
import { SessionCtx, appUrl, findApp, useSession, useTheme, useWorkspace } from "./session";
import { Empty, ErrorState, Mark, Toasts } from "./ui";
import { Shell } from "./Shell";
import { SignIn } from "./screens/SignIn";
import { Claim, CreateApp, Invite } from "./screens/FirstRun";
import { Install } from "./screens/Install";
import { Inbox } from "./screens/Inbox";
import { RequestDetail } from "./screens/Detail";
import { Duplicates } from "./screens/Duplicates";
import { Heard } from "./screens/Heard";
import { Integrations } from "./screens/Integrations";
import { Board } from "./screens/Board";
import { Settings } from "./screens/Settings";
import { Team } from "./screens/Team";
import { Billing } from "./screens/Billing";

export function App() {
  return (
    <Toasts>
      <Root />
    </Toasts>
  );
}

function Splash() {
  return (
    <div className="splash">
      <Mark className="splash-mark" />
    </div>
  );
}

function Root() {
  const { path, key, query } = useRoute();
  const [me, setMe] = useState<Me>();
  const [meError, setMeError] = useState<unknown>();
  const [theme, setTheme] = useTheme();
  const [version, setVersion] = useState(0);

  const loadMe = useCallback(async () => {
    try {
      setMe(await api<Me>("/v1/dash/me"));
      setMeError(undefined);
    } catch (e) {
      setMe(undefined);
      setMeError(e);
    }
  }, []);
  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const { wid, setWid, ws, reloadWs, wsError } = useWorkspace(me);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const session = useMemo(
    () =>
      me
        ? {
            me,
            wid,
            setWid,
            ws,
            reloadWs,
            version,
            bump,
            signOut: async () => {
              await api("/v1/auth/logout", { method: "POST" }).catch(() => {});
              setMe(undefined);
              setMeError(new ApiError(401, "unauthorized"));
              navigate("/login", true);
            },
          }
        : null,
    [me, wid, setWid, ws, reloadWs, version, bump],
  );

  // Signed out (or the sign-in page itself).
  if (!me) {
    if (!meError) return <Splash />;
    if (meError instanceof ApiError && meError.status !== 401) return <div className="center-page"><ErrorState error={meError} retry={loadMe} /></div>;
    const next = path === "/login" ? "/" : key;
    return <SignIn error={query.get("error")} next={next} onSignedIn={async () => { await loadMe(); navigate(next, true); }} />;
  }
  if (path === "/login") {
    navigate("/", true);
    return <Splash />;
  }
  if (!ws) {
    if (wsError) return <div className="center-page"><ErrorState error={wsError} retry={reloadWs} /></div>;
    return <Splash />;
  }

  return (
    <SessionCtx.Provider value={session}>
      <Shell theme={theme} setTheme={setTheme}>
        <Page path={path} />
      </Shell>
    </SessionCtx.Provider>
  );
}

function Page({ path }: { path: string }) {
  const { ws } = useSession();
  const seg = path.split("/").filter(Boolean);

  if (seg.length === 0) return <Redirect to={ws!.apps[0] ? appUrl(ws!.apps[0].id) : "/new"} />;
  if (seg[0] === "new") return <CreateApp />;
  if (seg[0] === "claim") return <Claim />;
  if (seg[0] === "invite") return <Invite />;
  if (seg[0] === "billing") return <Billing />;
  if (seg[0] === "team") return <Team />;
  if (seg[0] === "a" && seg[1]) {
    const app = findApp(ws, seg[1]);
    if (!app) {
      return (
        <Empty icon="warn" title="We can't find that app" action={<a className="btn btn-default" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Back to your apps</a>}>
          It may have been deleted, or it belongs to a different workspace.
        </Empty>
      );
    }
    const sub = seg[2];
    if (!sub) return <Inbox app={app} />;
    if (sub === "r" && seg[3]) return <RequestDetail app={app} requestId={seg[3]} />;
    if (sub === "duplicates") return <Duplicates app={app} />;
    if (sub === "heard") return <Heard app={app} />;
    if (sub === "integrations") return <Integrations app={app} />;
    if (sub === "board") return <Board app={app} />;
    if (sub === "settings") return <Settings app={app} />;
    if (sub === "install") return <Install app={app} />;
  }
  return <Empty icon="warn" title="That page doesn't exist" action={<a className="btn btn-default" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Go to your inbox</a>} />;
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to, true);
  }, [to]);
  return null;
}

import { useEffect, useState, type ReactNode } from "react";
import { appApi, type Req } from "./api";
import { Link, navigate, useRoute } from "./router";
import { appUrl, findApp, useSession } from "./session";
import { Icon, Mark, Menu, MenuItem, useLoad } from "./ui";

type Theme = "system" | "light" | "dark";

export function Shell({ children, theme, setTheme }: { children: ReactNode; theme: Theme; setTheme: (t: Theme) => void }) {
  const { path } = useRoute();
  const { ws, me, signOut, version } = useSession();
  const [sheet, setSheet] = useState(false);
  const seg = path.split("/").filter(Boolean);
  const appId = seg[0] === "a" ? seg[1] : undefined;
  const app = findApp(ws, appId ?? "") ?? ws!.apps[0];
  const hasApps = ws!.apps.length > 0;
  const live = ws!.workspace.live;
  const bare = !hasApps && (seg[0] === "new" || seg[0] === "claim");

  useEffect(() => setSheet(false), [path]);

  // Sidebar counts: requests waiting for approval and suggested duplicates.
  const counts = useLoad(
    async () => {
      if (!app) return { pending: 0, dupes: 0 };
      const [p, d] = await Promise.all([
        appApi<{ requests: Req[] }>(app.id, "/requests?status=pending").catch(() => ({ requests: [] })),
        appApi<{ pairs: unknown[] }>(app.id, "/duplicates").catch(() => ({ pairs: [] })),
      ]);
      return { pending: p.requests.length, dupes: d.pairs.length };
    },
    [app?.id, version],
  );
  const pending = counts.data?.pending ?? 0;
  const dupes = counts.data?.dupes ?? 0;

  if (bare) {
    return (
      <div className="bare">
        <header className="bare-head">
          <span className="brand"><Mark className="brand-mark" /> YouAsked</span>
          <Menu label="Account" align="right" trigger={() => <span className="avatar">{initials(me.account.name ?? me.account.email)}</span>}>
            {(close) => (
              <>
                <div className="menu-note">{me.account.email}</div>
                <MenuItem icon="logout" onClick={() => { close(); signOut(); }}>Sign out</MenuItem>
              </>
            )}
          </Menu>
        </header>
        <main className="bare-main">{children}</main>
      </div>
    );
  }

  const nav = app
    ? [
        { to: appUrl(app.id), label: "Inbox", icon: "inbox", badge: pending ? { n: pending, hint: "waiting for approval" } : undefined, exact: true },
        { to: appUrl(app.id, "/duplicates"), label: "Duplicates", icon: "dup", badge: dupes ? { n: dupes, hint: "suggested" } : undefined },
        { to: appUrl(app.id, "/heard"), label: "Heard elsewhere", icon: "ear" },
        { to: appUrl(app.id, "/integrations"), label: "Integrations", icon: "plug" },
        { to: appUrl(app.id, "/board"), label: "Public board", icon: "globe" },
        { to: appUrl(app.id, "/settings"), label: "Settings", icon: "cog" },
      ]
    : [];
  const wsNav = [
    { to: "/team", label: "Team", icon: "users" },
    { to: "/billing", label: "Billing", icon: "card" },
  ];
  const active = (to: string, exact?: boolean) => (exact ? path === to || path.startsWith(to + "/r/") : path === to || path.startsWith(to + "/"));

  const appSwitcher = (
    <Menu
      label="Switch app"
      trigger={() => (
        <span className="switcher">
          <span className="app-dot">{(app?.name ?? "?").slice(0, 1).toUpperCase()}</span>
          <span className="switcher-text">
            <b>{app?.name ?? "No app yet"}</b>
            <small>{ws!.workspace.name}</small>
          </span>
          <Icon name="down" size={15} />
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="menu-note">Apps in {ws!.workspace.name}</div>
          {ws!.apps.map((a) => (
            <MenuItem key={a.id} active={a.id === app?.id} onClick={() => { close(); navigate(appUrl(a.id)); }}>
              {a.name}
            </MenuItem>
          ))}
          <div className="menu-sep" />
          <MenuItem icon="plus" onClick={() => { close(); navigate("/new"); }}>New app</MenuItem>
        </>
      )}
    </Menu>
  );

  const account = (
    <Menu
      label="Account"
      align="left"
      trigger={() => (
        <span className="account">
          <span className="avatar">{initials(me.account.name ?? me.account.email)}</span>
          <span className="switcher-text">
            <b>{me.account.name ?? me.account.email}</b>
            <small>{me.account.email}</small>
          </span>
          <Icon name="more" size={16} />
        </span>
      )}
    >
      {(close) => (
        <>
          <div className="menu-note">Appearance</div>
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <MenuItem key={t} icon={t === "dark" ? "moon" : "sun"} active={theme === t} onClick={() => setTheme(t)}>
              {t === "system" ? "Match my system" : t === "light" ? "Light" : "Dark"}
            </MenuItem>
          ))}
          <div className="menu-sep" />
          <MenuItem icon="logout" onClick={() => { close(); signOut(); }}>Sign out</MenuItem>
        </>
      )}
    </Menu>
  );

  return (
    <div className="shell">
      <aside className="side">
        <Link to="/" className="brand"><Mark className="brand-mark" /> YouAsked</Link>
        {appSwitcher}
        <nav aria-label="App">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="nav-item" aria-current={active(n.to, n.exact) ? "page" : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.badge && <em className="count" title={`${n.badge.n} ${n.badge.hint}`}>{n.badge.n}</em>}
            </Link>
          ))}
        </nav>
        <div className="side-label">Workspace</div>
        <nav aria-label="Workspace">
          {wsNav.map((n) => (
            <Link key={n.to} to={n.to} className="nav-item" aria-current={active(n.to) ? "page" : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-foot">{account}</div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <Link to="/" className="brand"><Mark className="brand-mark" /></Link>
          {appSwitcher}
          <button className="icon-btn" aria-label="Menu" onClick={() => setSheet(true)}>
            <Icon name="menu" size={20} />
          </button>
        </header>
        {!live && (
          <div className="banner" role="note">
            <span><b>Test mode.</b> YouAsked works on localhost until you pick a plan.</span>
            <Link to="/billing" className="banner-link">Pick a plan <Icon name="right" size={14} /></Link>
          </div>
        )}
        <main className="main">{children}</main>
      </div>

      <nav className="tabbar" aria-label="Main">
        {nav.slice(0, 3).map((n) => (
          <Link key={n.to} to={n.to} className="tab" aria-current={active(n.to, n.exact) ? "page" : undefined}>
            <span className="tab-icon">
              <Icon name={n.icon} size={21} />
              {n.badge && <em className="dot" />}
            </span>
            {n.label === "Heard elsewhere" ? "Heard" : n.label}
          </Link>
        ))}
        <Link to={appUrl(app?.id ?? "", "/integrations")} className="tab" aria-current={path.endsWith("/integrations") ? "page" : undefined}>
          <span className="tab-icon"><Icon name="plug" size={21} /></span>
          Integrations
        </Link>
        <button className="tab" onClick={() => setSheet(true)}>
          <span className="tab-icon"><Icon name="menu" size={21} /></span>
          More
        </button>
      </nav>

      {sheet && (
        <div className="scrim sheet-scrim" onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="sheet" role="dialog" aria-label="More">
            <div className="sheet-grab" />
            <div className="sheet-group">
              <div className="side-label">Apps</div>
              {ws!.apps.map((a) => (
                <Link key={a.id} to={appUrl(a.id)} className="nav-item" aria-current={a.id === app?.id ? "page" : undefined}>
                  <span className="app-dot sm">{a.name.slice(0, 1).toUpperCase()}</span>
                  <span>{a.name}</span>
                </Link>
              ))}
              <Link to="/new" className="nav-item"><Icon name="plus" /><span>New app</span></Link>
            </div>
            <div className="sheet-group">
              <div className="side-label">{app?.name ?? "App"}</div>
              {nav.slice(3).map((n) => (
                <Link key={n.to} to={n.to} className="nav-item" aria-current={active(n.to) ? "page" : undefined}>
                  <Icon name={n.icon} /><span>{n.label}</span>
                </Link>
              ))}
            </div>
            <div className="sheet-group">
              <div className="side-label">Workspace</div>
              {wsNav.map((n) => (
                <Link key={n.to} to={n.to} className="nav-item" aria-current={active(n.to) ? "page" : undefined}>
                  <Icon name={n.icon} /><span>{n.label}</span>
                </Link>
              ))}
            </div>
            <div className="sheet-group row">
              <div className="seg" role="group" aria-label="Appearance">
                {(["system", "light", "dark"] as Theme[]).map((t) => (
                  <button key={t} data-on={theme === t || undefined} onClick={() => setTheme(t)}>
                    {t === "system" ? "Auto" : t === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
              <button className="btn btn-quiet btn-sm" onClick={signOut}><Icon name="logout" size={15} /> Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

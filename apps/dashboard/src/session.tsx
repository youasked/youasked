import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type Me, type WorkspaceApp, type WorkspaceDetail } from "./api";

export type Session = {
  me: Me;
  wid: string;
  setWid: (id: string) => void;
  ws: WorkspaceDetail | undefined;
  reloadWs: () => Promise<void>;
  /** Bumps when requests change, so sidebar counts refresh. */
  version: number;
  bump: () => void;
  signOut: () => Promise<void>;
};

export const SessionCtx = createContext<Session | null>(null);
export function useSession() {
  const s = useContext(SessionCtx);
  if (!s) throw new Error("no session");
  return s;
}

export function useWorkspace(me: Me | undefined) {
  const [wid, setWidState] = useState(() => {
    try {
      return localStorage.getItem("ya_ws") ?? "";
    } catch {
      return "";
    }
  });
  const [ws, setWs] = useState<WorkspaceDetail>();
  const [error, setError] = useState<unknown>();
  const valid = me?.workspaces.find((w) => w.id === wid) ? wid : me?.workspaces[0]?.id ?? "";

  const reloadWs = useCallback(async () => {
    if (!valid) return;
    try {
      setWs(await api<WorkspaceDetail>(`/v1/dash/workspaces/${valid}`));
      setError(undefined);
    } catch (e) {
      setError(e);
    }
  }, [valid]);

  useEffect(() => {
    setWs(undefined);
    reloadWs();
  }, [reloadWs]);

  const setWid = (id: string) => {
    setWidState(id);
    try {
      localStorage.setItem("ya_ws", id);
    } catch {
      /* storage blocked */
    }
  };
  return { wid: valid, setWid, ws, reloadWs, wsError: error };
}

export const appUrl = (id: string, sub = "") => `/a/${id}${sub}`;
export const findApp = (ws: WorkspaceDetail | undefined, id: string): WorkspaceApp | undefined => ws?.apps.find((a) => a.id === id);

/** Light, dark, or follow the system. */
export function useTheme() {
  const [pref, setPref] = useState<"system" | "light" | "dark">(() => {
    try {
      const t = localStorage.getItem("ya_theme");
      return t === "light" || t === "dark" ? t : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const el = document.documentElement;
    if (pref === "system") delete el.dataset.theme;
    else el.dataset.theme = pref;
    try {
      if (pref === "system") localStorage.removeItem("ya_theme");
      else localStorage.setItem("ya_theme", pref);
    } catch {
      /* storage blocked */
    }
    const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0f1c" : "#f6f7fb");
  }, [pref]);
  return [pref, setPref] as const;
}

"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Map, Bell, MessageSquarePlus, ClipboardList, RadioTower, Sparkles, BookOpen, ChevronDown, Menu, X, ArrowUpRight, LogOut, LockKeyhole, RefreshCw, Shield, WifiOff, MapPin } from "lucide-react";
import { useApp } from "./provider";
import { districtNames } from "@/lib/domain";
import { relativeTime } from "./ui";
const navigation = [
  { href: "/dashboard", label: "Situation room", icon: LayoutDashboard },
  { href: "/map", label: "Risk map", icon: Map },
  { href: "/alerts", label: "Alert center", icon: Bell },
  { href: "/incidents", label: "Incidents", icon: ClipboardList },
  { href: "/response", label: "Response teams", icon: RadioTower },
  { href: "/assistant", label: "Gemma assistant", icon: Sparkles },
  { href: "/preparedness", label: "Preparedness", icon: BookOpen },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data, online, responder, demoLogin, region, setRegion, refreshAuth, refresh, lastSynced } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [login, setLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!login) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const controls = () => dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]');
    controls()?.[0]?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLogin(false);
      if (event.key !== "Tab") return;
      const items = controls(); if (!items?.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [login]);
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: demoLogin ? "demo" : password }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await refreshAuth(); setLogin(false); setPassword(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to sign in."); } finally { setBusy(false); }
  }
  async function signOut() { await fetch("/api/auth", { method: "DELETE" }); await refreshAuth(); }
  const pending = data?.incidents.filter(item => ["unverified", "under_review"].includes(item.verification)).length || 0;
  return <div className="app-shell"><a href="#main" className="skip-link">Skip to content</a>{drawer && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setDrawer(false)}/>}<aside className={`sidebar ${drawer ? "is-open" : ""}`}><Link className="brand" href="/" onClick={() => setDrawer(false)}><Image src="/icon.svg" width={36} height={36} alt=""/><div>Brahma<span>Shield</span><small>DISASTER RESILIENCE PLATFORM</small></div></Link><div className="workspace-label">OPERATIONS WORKSPACE</div><nav aria-label="Main navigation">{navigation.map(item => <Link key={item.href} className={`nav-item ${path.startsWith(item.href) ? "active" : ""}`} href={item.href} onClick={() => setDrawer(false)}><item.icon size={18}/><span>{item.label}</span>{item.href === "/incidents" && pending > 0 && <span className="nav-count">{pending}</span>}{item.href === "/assistant" && <span className="ai-tag">AI</span>}</Link>)}</nav><div className="sidebar-bottom"><div className="region-card"><div className="eyebrow"><MapPin size={12}/> MONITORING REGION</div><strong>Northeast India</strong><p>Assam · Brahmaputra basin</p><span className="small teal"><span className="status-dot"/> Prototype workspace</span></div><Link className="button report-nav" href="/report" onClick={() => setDrawer(false)}><MessageSquarePlus size={17}/> Report a hazard <ArrowUpRight size={16}/></Link><div className="sidebar-foot"><Shield size={13}/> Community first. Always.</div></div></aside><div className="app-main"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setDrawer(true)}><Menu size={20}/></button><span className="breadcrumb">Workspace <span>/</span> <strong>{navigation.find(item => path.startsWith(item.href))?.label || (path === "/report" ? "Community report" : "Overview")}</strong></span></div><div className="topbar-right"><span className="connection-status">{online ? <span className="status-dot"/> : <WifiOff size={13}/>} {online && lastSynced ? "Connected" : online ? "Connecting" : "Offline"}</span><button className="icon-button refresh-top" aria-label="Refresh shared data" onClick={() => void refresh()}><RefreshCw size={15}/></button><div className="notification-wrap"><button className="icon-button notification-button" aria-label="View alert notifications" aria-expanded={notifications} onClick={() => setNotifications(!notifications)}><Bell size={18}/>{!!data?.alerts.length && <i/>}</button>{notifications && <div className="notification-popover"><strong>Workspace alerts</strong><p className="small muted">Simulated advisories · not emergency notifications</p>{data?.alerts.map(alert => <Link key={alert.id} href="/alerts" onClick={() => setNotifications(false)}>{alert.title}<small>{alert.district} · {relativeTime(alert.issuedAt)}</small></Link>)}</div>}</div><button className="profile-button" onClick={() => responder ? void signOut() : setLogin(true)} aria-label={responder ? "Sign out of responder account" : "Sign in as responder"}><span className="avatar">{responder ? "OP" : "OB"}</span><span>{responder ? "Responder" : "Observer"}</span>{responder ? <LogOut size={14}/> : <ChevronDown size={14}/>}</button></div></header><div className="context-bar"><span><span className="demo-chip">PROTOTYPE</span> Simulated alerts & resources · community reports require review</span><label className="region-select"><MapPin size={13}/><select aria-label="Filter district" value={region} onChange={event => setRegion(event.target.value)}>{districtNames.map(name => <option key={name}>{name}</option>)}</select></label></div><main id="main" className="main-content">{children}</main><footer className="app-footer"><span>BrahmaShield <span className="muted">/</span> See risk early. Coordinate with confidence.</span><span>No live monitoring or emergency dispatch · All times IST</span></footer></div>{login && <div className="modal-backdrop"><section ref={dialogRef} className="modal panel" role="dialog" aria-modal="true" aria-labelledby="login-title"><button className="modal-close icon-button" aria-label="Close sign-in" onClick={() => setLogin(false)}><X size={18}/></button><LockKeyhole className="teal" size={28}/><h2 id="login-title">Responder workspace</h2><p>Sign in to review evidence, assign teams, and record response actions.</p>{demoLogin && <div className="notice warning">Local demo access is enabled. Actions are recorded in the prototype; no real response team is dispatched.</div>}<form onSubmit={signIn}>{!demoLogin && <label>Responder password<input type="password" autoComplete="current-password" autoFocus required value={password} onChange={event => setPassword(event.target.value)}/></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full-width" disabled={busy}>{busy ? "Signing in…" : demoLogin ? "Enter local demo workspace" : "Sign in"}</button></form></section></div>}</div>;
}

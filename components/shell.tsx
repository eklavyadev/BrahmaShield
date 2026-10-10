"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Map,
  Bell,
  MessageSquarePlus,
  ClipboardList,
  RadioTower,
  Sparkles,
  BookOpen,
  Menu,
  ArrowUpRight,
  RefreshCw,
  WifiOff,
  MapPin,
} from "lucide-react";
import { useApp } from "./provider";
import { districtNames } from "@/lib/domain";
import { relativeTime } from "./ui";
const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Map },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/incidents", label: "Incidents", icon: ClipboardList },
  { href: "/response", label: "Responders", icon: RadioTower },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/preparedness", label: "Preparedness", icon: BookOpen },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data, online, region, setRegion, refresh, lastSynced } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const pending =
    data?.incidents.filter((item) => ["unverified", "under_review"].includes(item.verification))
      .length || 0;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={`sidebar ${drawer ? "is-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setDrawer(false)}>
          <Image src="/icon.svg" width={36} height={36} alt="" />
          <div>
            Brahma<span>Shield</span>
            <small>NORTHEAST INDIA</small>
          </div>
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              className={`nav-item ${path.startsWith(item.href) ? "active" : ""}`}
              href={item.href}
              onClick={() => setDrawer(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.href === "/incidents" && pending > 0 && (
                <span className="nav-count">{pending}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="button report-nav" href="/report" onClick={() => setDrawer(false)}>
            <MessageSquarePlus size={17} /> Report a hazard <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setDrawer(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {navigation.find((item) => path.startsWith(item.href))?.label ||
                  (path === "/report" ? "Community report" : "Overview")}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="connection-status">
              {online ? <span className="status-dot" /> : <WifiOff size={13} />}{" "}
              {online && lastSynced ? "Connected" : online ? "Connecting" : "Offline"}
            </span>
            <button
              className="icon-button refresh-top"
              aria-label="Refresh shared data"
              onClick={() => void refresh()}
            >
              <RefreshCw size={15} />
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button notification-button"
                aria-label="View alert notifications"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={18} />
                {!!data?.alerts.length && <i />}
              </button>
              {notifications && (
                <div className="notification-popover">
                  <strong>Workspace alerts</strong>
                  <p className="small muted">Simulated advisories · not emergency notifications</p>
                  {data?.alerts.map((alert) => (
                    <Link key={alert.id} href="/alerts" onClick={() => setNotifications(false)}>
                      {alert.title}
                      <small>
                        {alert.district} · {relativeTime(alert.issuedAt)}
                      </small>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="context-bar">
          <span>
            <span className="demo-chip">PROTOTYPE</span> Demo alerts · reports need review
          </span>
          <label className="region-select">
            <MapPin size={13} />
            <select
              aria-label="Filter district"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            >
              {districtNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>BrahmaShield · Northeast India</span>
          <span>No live monitoring or emergency dispatch · All times IST</span>
        </footer>
      </div>
    </div>
  );
}

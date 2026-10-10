"use client";
import dynamic from "next/dynamic";
export const IncidentMap = dynamic(() => import("./map-view").then((module) => module.MapView), {
  ssr: false,
  loading: () => <div className="map-placeholder">Loading map…</div>,
});

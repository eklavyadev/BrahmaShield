"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Expand, Layers, MapPin, List, X } from "lucide-react";
import type { Incident, Shelter, Hazard } from "@/lib/domain";
import { label } from "@/lib/domain";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

const colors: Record<Hazard, string> = {
  flood: "#5ba7ff",
  landslide: "#eda85e",
  waterlogging: "#5ad6c0",
  extreme_weather: "#b29aff",
};
const allLayers = ["flood", "waterlogging", "landslide", "extreme_weather", "shelters"];
export function MapView({
  incidents,
  shelters = [],
  height = 410,
  picker,
  selected,
}: {
  incidents: Incident[];
  shelters?: Shelter[];
  height?: number;
  picker?: (lat: number, lng: number) => void;
  selected?: [number, number];
}) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const pickerRef = useRef(picker);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [layers, setLayers] = useState(allLayers);
  const [layerOpen, setLayerOpen] = useState(false);
  const [listView, setListView] = useState(false);
  const selectedLat = selected?.[0];
  const selectedLng = selected?.[1];
  useEffect(() => {
    pickerRef.current = picker;
  }, [picker]);
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (cancelled || !root.current) return;
        lib.current = L;
        const instance = L.map(root.current, {
          zoomControl: false,
          scrollWheelZoom: false,
        }).setView([26.9, 93.0], 7);
        L.control.zoom({ position: "bottomright" }).addTo(instance);
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
          maxZoom: 19,
        });
        tiles.on("tileerror", () => setTileError(true));
        tiles.addTo(instance);
        markers.current = L.layerGroup().addTo(instance);
        map.current = instance;
        instance.on("click", (event: Leaflet.LeafletMouseEvent) =>
          pickerRef.current?.(
            Number(event.latlng.lat.toFixed(5)),
            Number(event.latlng.lng.toFixed(5)),
          ),
        );
        observer = new ResizeObserver(() => instance.invalidateSize());
        observer.observe(root.current);
        setReady(true);
      })
      .catch(() => setMapError(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);
  useEffect(() => {
    const L = lib.current;
    const group = markers.current;
    if (!ready || !L || !group) return;
    group.clearLayers();
    incidents
      .filter((item) => layers.includes(item.hazard) && item.verification !== "rejected")
      .forEach((item) => {
        const marker = L.marker([item.lat, item.lng], {
          icon: L.divIcon({
            className: "custom-map-marker",
            html: `<span style="--marker-color:${colors[item.hazard]}" class="map-point ${item.verification === "verified" ? "confirmed" : "unconfirmed"}">${item.priority === "critical" ? "!" : ""}</span>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        });
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = item.title;
        popup.appendChild(title);
        const status = document.createElement("p");
        status.textContent = `${item.district} · ${label(item.verification)}${item.demo ? " · DEMO" : " · Community report"}`;
        popup.appendChild(status);
        const link = document.createElement("a");
        link.href = `/incidents/${encodeURIComponent(item.id)}`;
        link.textContent = "Open incident →";
        popup.appendChild(link);
        marker.bindPopup(popup).addTo(group);
        marker
          .getElement()
          ?.setAttribute(
            "aria-label",
            `${item.title} · ${item.verification}${item.demo ? " · demo" : ""}`,
          );
      });
    if (layers.includes("shelters"))
      shelters.forEach((shelter) => {
        const marker = L.marker([shelter.lat, shelter.lng], {
          icon: L.divIcon({
            className: "custom-map-marker",
            html: '<span class="shelter-point">⌂</span>',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        });
        const popup = document.createElement("div");
        popup.textContent = `${shelter.name} · DEMO shelter. Capacity and access require confirmation.`;
        marker.bindPopup(popup).addTo(group);
        marker.getElement()?.setAttribute("aria-label", `${shelter.name} · demo shelter`);
      });
    if (selected)
      L.marker(selected, {
        icon: L.divIcon({
          className: "custom-map-marker",
          html: '<span class="selected-point">+</span>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(group);
  }, [incidents, shelters, ready, layers, selected]);
  useEffect(() => {
    if (ready && selectedLat !== undefined && selectedLng !== undefined) {
      map.current?.setView([selectedLat, selectedLng], 10, { animate: false });
    }
  }, [ready, selectedLat, selectedLng]);
  function fit() {
    const points: [number, number][] = incidents
      .filter((item) => item.verification !== "rejected")
      .map((item) => [item.lat, item.lng]);
    if (points.length) map.current?.fitBounds(points, { padding: [40, 40], maxZoom: 11 });
    else map.current?.setView(selected || [26.9, 93], selected ? 10 : 7);
  }
  return (
    <div className={`map-frame ${picker ? "map-picker" : ""}`} style={{ height }}>
      <div
        ref={root}
        className="leaflet-root"
        aria-label={
          picker
            ? "Click map to select report location; coordinates can also be entered below"
            : selected
              ? "Read-only map of your device GPS location"
              : "OpenStreetMap of incidents in Assam"
        }
      />
      {!ready && !mapError && <div className="map-loading">Loading OpenStreetMap…</div>}
      {mapError && (
        <div className="map-loading">
          Map unavailable. Use the incident list or coordinate fields.
        </div>
      )}
      <div className="map-controls">
        <button className="map-control" onClick={fit} aria-label="Fit map to incidents">
          <Expand size={16} />
        </button>
        <button
          className={`map-control ${layerOpen ? "selected" : ""}`}
          onClick={() => setLayerOpen(!layerOpen)}
          aria-label="Choose map layers"
          aria-expanded={layerOpen}
        >
          <Layers size={16} />
        </button>
        {!picker && (
          <button
            className="map-control"
            onClick={() => setListView(!listView)}
            aria-label="Open map incident list"
          >
            <List size={16} />
          </button>
        )}
      </div>
      {layerOpen && (
        <div className="map-layer-panel">
          <strong>Map layers</strong>
          {allLayers.map((layer) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={layers.includes(layer)}
                onChange={() =>
                  setLayers((previous) =>
                    previous.includes(layer)
                      ? previous.filter((item) => item !== layer)
                      : [...previous, layer],
                  )
                }
              />
              <span
                className="legend-dot"
                style={{ background: layer === "shelters" ? "#c8d8e8" : colors[layer as Hazard] }}
              />
              {label(layer)}
            </label>
          ))}
          <small>
            Solid: human reviewed
            <br />
            Dashed: awaiting review
            <br />
            No forecast polygons loaded
          </small>
        </div>
      )}
      {listView && (
        <div className="map-list">
          <div className="panel-heading">
            <strong>Mapped incidents</strong>
            <button
              className="icon-button"
              aria-label="Close incident list"
              onClick={() => setListView(false)}
            >
              <X size={15} />
            </button>
          </div>
          {incidents
            .filter((item) => layers.includes(item.hazard) && item.verification !== "rejected")
            .map((item) => (
              <Link key={item.id} href={`/incidents/${item.id}`}>
                {item.title}
                <small>
                  {item.district} · {label(item.verification)}
                </small>
              </Link>
            ))}
        </div>
      )}
      <div className="map-region-label">
        <MapPin size={13} /> ASSAM · NORTHEAST INDIA
      </div>
      {tileError && (
        <div className="map-tile-error" role="status">
          OSM tiles unavailable. Markers remain; use the list view or location fields.
        </div>
      )}
      <div className="map-legend">
        {(["flood", "landslide", "extreme_weather", "waterlogging"] as Hazard[]).map((hazard) => (
          <span key={hazard}>
            <i style={{ background: colors[hazard] }} />
            {label(hazard)}
          </span>
        ))}
      </div>
    </div>
  );
}

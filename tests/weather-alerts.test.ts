import test from "node:test";
import assert from "node:assert/strict";
import { forecastAdvisories, parseWeatherFeed, forecastLocations } from "../lib/weather-alerts";
import {
  alertVersion,
  newAlertNotifications,
  notificationContent,
} from "../lib/alert-notifications";
const now = "2026-10-10T08:00:00Z";
const sample = () =>
  forecastLocations.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
    daily_units: { precipitation_sum: "mm", wind_gusts_10m_max: "km/h" },
    daily: {
      time: ["2026-10-10", "2026-10-11", "2026-10-12"],
      weather_code: [3, 95, null],
      precipitation_sum: [0, 100, null],
      wind_gusts_10m_max: [20, 50, null],
    },
  }));
test("live forecasts preserve missing readings, source attribution and stable advisory identities", () => {
  const feed = parseWeatherFeed(sample(), now);
  assert.equal(feed.forecasts.length, 24);
  assert.equal(feed.forecasts[2].rainMm, null);
  assert.equal(feed.alerts[0].severity, "orange");
  assert.equal(feed.alerts[0].sourceType, "forecast");
  assert.equal(feed.alerts[0].demo, false);
  assert.match(feed.alerts[0].original, /not an IMD\/NDMA warning/);
  assert.equal(feed.alerts[0].id, parseWeatherFeed(sample(), "2026-10-10T08:15:00Z").alerts[0].id);
});
test("reject incomplete locations, incorrect units, mismatched coordinates and stale forecast dates", () => {
  assert.throws(() => parseWeatherFeed(sample().slice(1), now));
  const wrongUnit = sample();
  wrongUnit[0].daily_units.precipitation_sum = "inch";
  assert.throws(() => parseWeatherFeed(wrongUnit, now));
  const wrongLocation = sample();
  wrongLocation[0].latitude = 20;
  assert.throws(() => parseWeatherFeed(wrongLocation, now));
  assert.throws(() => parseWeatherFeed(sample(), "2026-10-12T08:00:00Z"));
});
test("quiet and missing weather never become fabricated disaster warnings", () => {
  const row = {
    district: "Dibrugarh",
    date: "2026-10-10",
    rainMm: 49,
    gustKmh: 49,
    weatherCode: 3,
  };
  assert.deepEqual(
    forecastAdvisories([row, { ...row, rainMm: null, gustKmh: null, weatherCode: null }], now),
    [],
  );
  const alerts = forecastAdvisories([{ ...row, rainMm: 150, gustKmh: 90 }], now);
  assert.equal(alerts.length, 2);
  assert.ok(alerts.every((a) => a.severity === "red" && a.hazard === "extreme_weather"));
});
test("notifications respect expiry, district selection, demo status, and previous delivery", () => {
  const alert = parseWeatherFeed(sample(), now).alerts[0];
  assert.equal(newAlertNotifications([alert], [], "Dibrugarh", Date.parse(now)).length, 1);
  assert.equal(
    newAlertNotifications([alert], [alertVersion(alert)], "All districts", Date.parse(now)).length,
    0,
  );
  assert.equal(newAlertNotifications([alert], [], "Cachar", Date.parse(now)).length, 0);
  assert.equal(
    newAlertNotifications([{ ...alert, demo: true }], [], "All districts", Date.parse(now)).length,
    0,
  );
  assert.equal(
    newAlertNotifications([alert], [], "All districts", Date.parse(alert.expiresAt) + 1).length,
    0,
  );
  assert.equal(newAlertNotifications([alert], [], "All districts", Date.parse(now) - 1).length, 0);
  const refreshed = {
    ...alert,
    issuedAt: "2026-10-10T08:15:00Z",
    original: "Updated rain estimate",
  };
  assert.equal(alertVersion(refreshed), alertVersion(alert));
  assert.notEqual(alertVersion({ ...alert, severity: "red" }), alertVersion(alert));
  assert.match(notificationContent([alert]).body, /not an official warning/);
});

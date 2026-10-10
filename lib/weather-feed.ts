import { forecastLocations, parseWeatherFeed } from "./weather-alerts";
import type { WeatherFeed } from "./domain";
const REFRESH_MS = 15 * 60_000;
const MAX_STALE_MS = 45 * 60_000;
let cached: WeatherFeed | undefined;
let nextFetchAt = 0;
let pending: Promise<WeatherFeed> | undefined;
export async function weatherFeed(): Promise<WeatherFeed> {
  if (cached && Date.now() < nextFetchAt) return cached;
  if (pending) return pending;
  pending = fetchFeed().finally(() => {
    pending = undefined;
  });
  return pending;
}
async function fetchFeed(): Promise<WeatherFeed> {
  try {
    const params = new URLSearchParams({
      latitude: forecastLocations.map((p) => p.lat).join(","),
      longitude: forecastLocations.map((p) => p.lng).join(","),
      daily: "weather_code,precipitation_sum,wind_gusts_10m_max",
      forecast_days: "3",
      timezone: "Asia/Kolkata",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Forecast provider unavailable");
    cached = parseWeatherFeed(await response.json(), new Date().toISOString());
    nextFetchAt = Date.now() + REFRESH_MS;
  } catch {
    const previousAge = cached?.fetchedAt ? Date.now() - Date.parse(cached.fetchedAt) : Infinity;
    cached =
      previousAge < MAX_STALE_MS && cached
        ? {
            ...cached,
            status: "stale",
            message: "Forecast refresh failed. Showing earlier data; check official sources.",
          }
        : {
            status: "unavailable",
            fetchedAt: null,
            message:
              "Live forecasts are unavailable. This does not mean conditions are safe. Check SACHET and IMD.",
            forecasts: [],
            alerts: [],
          };
    nextFetchAt = Date.now() + 60_000;
  }
  return cached;
}

import { z } from "zod";
import type { WeatherFeed, WeatherForecast, Alert } from "./domain";

// Representative district centres, not district-wide observations or report locations.
export const forecastLocations = [
  { district: "Dibrugarh", lat: 27.47, lng: 94.91 },
  { district: "Lakhimpur", lat: 27.24, lng: 94.1 },
  { district: "Dhemaji", lat: 27.48, lng: 94.58 },
  { district: "Kamrup Metro", lat: 26.14, lng: 91.74 },
  { district: "Morigaon", lat: 26.25, lng: 92.35 },
  { district: "Jorhat", lat: 26.75, lng: 94.22 },
  { district: "Cachar", lat: 24.83, lng: 92.78 },
  { district: "Dima Hasao", lat: 25.17, lng: 93.02 },
];
const numberOrMissing = z.number().nonnegative().nullable();
const responseSchema = z
  .array(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
      daily_units: z.object({
        precipitation_sum: z.literal("mm"),
        wind_gusts_10m_max: z.literal("km/h"),
      }),
      daily: z.object({
        time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).length(3),
        weather_code: z.array(numberOrMissing).length(3),
        precipitation_sum: z.array(numberOrMissing).length(3),
        wind_gusts_10m_max: z.array(numberOrMissing).length(3),
      }),
    }),
  )
  .length(forecastLocations.length);

export function forecastAdvisories(forecasts: WeatherForecast[], fetchedAt: string): Alert[] {
  return forecasts.flatMap((row) => {
    const risks: { kind: string; severity: Alert["severity"]; text: string }[] = [];
    if (row.rainMm !== null && row.rainMm >= 50)
      risks.push({
        kind: "rain",
        severity: row.rainMm >= 150 ? "red" : row.rainMm >= 100 ? "orange" : "yellow",
        text: `${row.rainMm.toFixed(1)} mm of precipitation forecast for this calendar day`,
      });
    if (row.gustKmh !== null && row.gustKmh >= 50)
      risks.push({
        kind: "wind",
        severity: row.gustKmh >= 90 ? "red" : row.gustKmh >= 70 ? "orange" : "yellow",
        text: `Peak wind gusts of ${row.gustKmh.toFixed(1)} km/h forecast`,
      });
    if (row.weatherCode !== null && [95, 96, 99].includes(row.weatherCode))
      risks.push({
        kind: "thunderstorm",
        severity: "yellow",
        text: "Thunderstorm conditions forecast by the weather model",
      });
    return risks.map((risk) => ({
      id: `om-${row.district.replaceAll(" ", "-")}-${row.date}-${risk.kind}`,
      hazard: "extreme_weather" as const,
      title: `${risk.kind === "rain" ? "Rainfall" : risk.kind === "wind" ? "Strong gust" : "Thunderstorm"} forecast · ${row.district}`,
      district: row.district,
      severity: risk.severity,
      authority: "Open-Meteo · BrahmaShield forecast rule",
      issuedAt: fetchedAt,
      expiresAt: new Date(`${row.date}T23:59:59+05:30`).toISOString(),
      original: `${risk.text} on ${row.date} near the district centre. This is a model forecast and an application-generated advisory, not an IMD/NDMA warning or confirmation of flooding or landslides. Check official warnings and local conditions.`,
      sourceUrl: "https://open-meteo.com/en/docs",
      demo: false,
      sourceType: "forecast" as const,
    }));
  });
}

export function parseWeatherFeed(input: unknown, fetchedAt: string): WeatherFeed {
  const rows = responseSchema.parse(input);
  const forecasts = rows.flatMap((row, index) => {
    const location = forecastLocations[index];
    if (Math.abs(row.latitude - location.lat) > 0.4 || Math.abs(row.longitude - location.lng) > 0.4)
      throw new Error("Forecast location mismatch");
    for (const [day, date] of row.daily.time.entries()) {
      const expected = new Date(Date.parse(fetchedAt) + 5.5 * 3600_000 + day * 86400_000)
        .toISOString()
        .slice(0, 10);
      if (date !== expected) throw new Error("Forecast dates are out of date");
    }
    return row.daily.time.map((date, day) => ({
      district: location.district,
      date,
      rainMm: row.daily.precipitation_sum[day],
      gustKmh: row.daily.wind_gusts_10m_max[day],
      weatherCode: row.daily.weather_code[day],
    }));
  });
  return {
    status: "live",
    fetchedAt,
    message: "Live model forecasts · representative district centres",
    forecasts,
    alerts: forecastAdvisories(forecasts, fetchedAt),
  };
}

export function currentReportLocation(): Promise<{
  lat: number;
  lng: number;
  gpsAccuracyM: number;
  gpsCapturedAt: string;
  locationMethod: "gps";
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Device GPS is required. Enable location access on a supported browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(accuracy) || accuracy > 200) {
          reject(
            new Error("GPS accuracy must be within 200 metres. Stay somewhere safe and retry."),
          );
          return;
        }
        if (latitude < 20 || latitude > 30 || longitude < 88 || longitude > 98) {
          reject(
            new Error(
              "Your device location is outside the supported Northeast India reporting area.",
            ),
          );
          return;
        }
        resolve({
          lat: latitude,
          lng: longitude,
          gpsAccuracyM: accuracy,
          gpsCapturedAt: new Date(position.timestamp).toISOString(),
          locationMethod: "gps",
        });
      },
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Location access is required to report from the site. Enable it in your browser settings."
              : "Device GPS is unavailable. Stay safe and retry when location reception improves.",
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}
export function nearby(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const value =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) <= 200;
}

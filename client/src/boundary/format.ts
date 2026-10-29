/** Hours and minutes in Singapore time, e.g. "20:50", whatever time zone the phone is set to. */
export const clock = new Intl.DateTimeFormat("en-SG", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Singapore",
});

/** A distance as a driver reads it: "350 m" to the nearest 10 m, or "1.2 km" from a kilometre on. */
export function distance(metres: number): string {
  const rounded = Math.round(metres / 10) * 10;
  return rounded < 1000 ? `${rounded} m` : `${(metres / 1000).toFixed(1)} km`;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type WeeklyHours = Record<Weekday, { from: string; to: string } | null>;

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Current weekday and "HH:MM" in North Macedonia, regardless of the visitor's time zone. */
export function skopjeNow(date = new Date()): { day: Weekday; time: string } {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Skopje",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return { day: get("weekday").toLowerCase().slice(0, 3) as Weekday, time: `${get("hour")}:${get("minute")}` };
}

export type OpenStatus =
    | { kind: "unknown" }
    | { kind: "open"; closesAt: string }
    | { kind: "closed"; opensAt?: string };

export function openStatus(hours: WeeklyHours | null, date = new Date()): OpenStatus {
    if (!hours) return { kind: "unknown" };
    const { day, time } = skopjeNow(date);
    const today = hours[day];
    if (today && time >= today.from && time < today.to) return { kind: "open", closesAt: today.to };
    if (today && time < today.from) return { kind: "closed", opensAt: today.from };
    return { kind: "closed" };
}

export const directionsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

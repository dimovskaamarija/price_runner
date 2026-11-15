import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { FaDirections, FaExternalLinkAlt, FaLocationArrow, FaPhoneAlt } from "react-icons/fa";
import Spinner from "../components/Spinner";
import OpenStatusBadge from "../components/OpenStatusBadge";
import { chainColor, useStoreLocations, type StoreLocation } from "../hooks/useStoreLocations";
import { useStoreLookup } from "../hooks/useStoreLookup";
import { useI18n } from "../i18n";
import { directionsUrl, distanceKm, formatAddress, skopjeNow, WEEKDAYS } from "../utils/geo";
import "../styles/StoreMap.css";

const MK_CENTER: [number, number] = [41.6, 21.7];

type GeoState = { status: "idle" | "locating" | "denied" | "unavailable" } | { status: "ok"; lat: number; lng: number };

/** Fits the map to the user and their nearest stores once a location is known. */
function FitToUser({ user, nearest }: { user: { lat: number; lng: number } | null; nearest: StoreLocation[] }) {
    const map = useMap();
    useEffect(() => {
        if (!user) return;
        const points: [number, number][] = [[user.lat, user.lng], ...nearest.map((s) => [s.lat, s.lng] as [number, number])];
        map.flyToBounds(points, { padding: [40, 40], maxZoom: 14, duration: 0.8 });
    }, [map, user, nearest]);
    return null;
}

export default function StoreMap() {
    const { t, locale } = useI18n();
    const { data: locations = [], isLoading } = useStoreLocations();
    const { getStore } = useStoreLookup();
    const [chain, setChain] = useState<string | null>(null);
    const [geo, setGeo] = useState<GeoState>({ status: "idle" });
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRefs = useRef(new Map<string, LeafletCircleMarker>());

    const chains = useMemo(() => {
        const counts = new Map<string, number>();
        locations.forEach((l) => counts.set(l.store, (counts.get(l.store) || 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    }, [locations]);

    const user = useMemo(() => (geo.status === "ok" ? { lat: geo.lat, lng: geo.lng } : null), [geo]);

    const visible = useMemo(() => {
        const list = locations
            .filter((l) => !chain || l.store === chain)
            .map((l) => ({ ...l, distance: user ? distanceKm(user, l) : null }));
        if (user) return list.sort((a, b) => a.distance! - b.distance!);
        // No location: cities with the most shops first (Скопје), then alphabetically.
        const perCity = new Map<string, number>();
        list.forEach((l) => perCity.set(l.city || "", (perCity.get(l.city || "") || 0) + 1));
        return list.sort(
            (a, b) =>
                (perCity.get(b.city || "") || 0) - (perCity.get(a.city || "") || 0) ||
                (a.city || "").localeCompare(b.city || "") ||
                a.name.localeCompare(b.name),
        );
    }, [locations, chain, user]);

    const nearest = useMemo(() => (user ? visible.slice(0, 5) : []), [user, visible]);

    const weekdayNames = useMemo(() => {
        const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
        // 1 Jan 2024 was a Monday.
        return WEEKDAYS.map((_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i, 12))));
    }, [locale]);

    const locate = () => {
        if (!("geolocation" in navigator)) return setGeo({ status: "unavailable" });
        setGeo({ status: "locating" });
        navigator.geolocation.getCurrentPosition(
            (pos) => setGeo({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => setGeo({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
        );
    };

    const focus = (l: StoreLocation) => {
        mapRef.current?.flyTo([l.lat, l.lng], 15, { duration: 0.6 });
        setTimeout(() => markerRefs.current.get(l.id)?.openPopup(), 650);
        if (window.innerWidth < 900) mapRef.current?.getContainer().scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const chainName = (store: string) => getStore(store)?.name || store;
    const today = skopjeNow().day;


    const details = (l: StoreLocation & { distance: number | null }) => (
        <>
            <div className="store-card__head">
                <span className="store-dot" style={{ background: chainColor(l.store) }} aria-hidden="true" />
                <div>
                    <div className="store-card__name">{l.name}</div>
                    <div className="store-card__chain">{chainName(l.store)}</div>
                </div>
                {l.distance != null && <span className="store-card__distance">{t("stores.km", { km: l.distance.toFixed(1) })}</span>}
            </div>
            {(l.address || l.city) && (
                <div className="store-card__address">
                    {formatAddress(l.address, l.city)}
                    {l.approximate && <span className="store-card__approx"> · {t("stores.approximate")}</span>}
                </div>
            )}
            <OpenStatusBadge hours={l.hours} />
        </>
    );

    if (isLoading) return <Spinner />;

    return (
        <div className="stores-page">
            <div className="stores-header">
                <div>
                    <h1>{t("stores.title")}</h1>
                    <p className="stores-subtitle">{t("stores.subtitle", { count: locations.length })}</p>
                </div>
                <div className="stores-locate">
                    <button type="button" className="stores-locate__btn" onClick={locate} disabled={geo.status === "locating"}>
                        <FaLocationArrow aria-hidden="true" />
                        {geo.status === "locating" ? t("stores.locating") : t("stores.useLocation")}
                    </button>
                    <span className="stores-locate__note">
                        {geo.status === "denied"
                            ? t("stores.locationDenied")
                            : geo.status === "unavailable"
                              ? t("stores.locationUnavailable")
                              : t("stores.locationPrivacy")}
                    </span>
                </div>
            </div>

            <div className="stores-chips" role="group">
                <button type="button" className={`stores-chip ${!chain ? "is-active" : ""}`} aria-pressed={!chain} onClick={() => setChain(null)}>
                    {t("stores.all")} <span className="stores-chip__count">{locations.length}</span>
                </button>
                {chains.map(([store, count]) => (
                    <button
                        key={store}
                        type="button"
                        className={`stores-chip ${chain === store ? "is-active" : ""}`}
                        aria-pressed={chain === store}
                        onClick={() => setChain(chain === store ? null : store)}>
                        <span className="store-dot" style={{ background: chainColor(store) }} aria-hidden="true" />
                        {chainName(store)} <span className="stores-chip__count">{count}</span>
                    </button>
                ))}
            </div>

            <div className="stores-layout">
                <ul className="stores-list">
                    {visible.length === 0 && <li className="stores-empty">{t("stores.empty")}</li>}
                    {visible.map((l) => (
                        <li key={l.id} className="store-card">
                            {details(l)}
                            <div className="store-card__actions">
                                <button type="button" onClick={() => focus(l)}>
                                    {t("stores.showOnMap")}
                                </button>
                                <a href={directionsUrl(l.lat, l.lng)} target="_blank" rel="noreferrer">
                                    <FaDirections aria-hidden="true" /> {t("stores.directions")}
                                </a>
                                {l.phone && (
                                    <a href={`tel:${l.phone.replace(/\s/g, "")}`}>
                                        <FaPhoneAlt aria-hidden="true" /> {l.phone}
                                    </a>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="stores-map">
                    <MapContainer ref={mapRef} center={MK_CENTER} zoom={8} scrollWheelZoom className="stores-map__leaflet">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <FitToUser user={user} nearest={nearest} />
                        {user && (
                            <CircleMarker center={[user.lat, user.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}>
                                <Popup>{t("stores.youAreHere")}</Popup>
                            </CircleMarker>
                        )}
                        {visible.map((l) => (
                            <CircleMarker
                                key={l.id}
                                ref={(m) => {
                                    if (m) markerRefs.current.set(l.id, m);
                                    else markerRefs.current.delete(l.id);
                                }}
                                center={[l.lat, l.lng]}
                                radius={8}
                                pathOptions={{ color: "#fff", weight: 2, fillColor: chainColor(l.store), fillOpacity: 0.95 }}>
                                <Popup>
                                    <div className="store-popup">
                                        {details(l)}
                                        {l.hours && (
                                            <table className="store-hours">
                                                <tbody>
                                                    {WEEKDAYS.map((d, i) => (
                                                        <tr key={d} className={d === today ? "is-today" : ""}>
                                                            <th>{weekdayNames[i]}</th>
                                                            <td>{l.hours![d] ? `${l.hours![d]!.from}–${l.hours![d]!.to}` : t("stores.closed")}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                        <div className="store-card__actions">
                                            <a href={directionsUrl(l.lat, l.lng)} target="_blank" rel="noreferrer">
                                                <FaDirections aria-hidden="true" /> {t("stores.directions")}
                                            </a>
                                            {l.url && (
                                                <a href={l.url} target="_blank" rel="noreferrer">
                                                    <FaExternalLinkAlt aria-hidden="true" /> {t("stores.storePage")}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
}

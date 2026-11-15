import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { FaDirections, FaExternalLinkAlt, FaLocationArrow, FaPhoneAlt } from "react-icons/fa";
import { api } from "../utils/api";
import { useI18n } from "../i18n";
import { useStoreLookup } from "../hooks/useStoreLookup";
import { chainColor, type StoreLocation } from "../hooks/useStoreLocations";
import { directionsUrl, distanceKm, formatAddress } from "../utils/geo";
import OpenStatusBadge from "./OpenStatusBadge";
import SizeGuide from "./SizeGuide";
import "../styles/StoreMap.css";
import "../styles/Availability.css";

interface AvailabilityResponse {
    size: string | null;
    sizes: string[];
    chains: Array<{
        store: string;
        status: "ok" | "error" | "unsupported";
        url: string;
        sizes: Array<{ size: string; level?: string }>;
        onlineOnly?: boolean;
    }>;
    locations: StoreLocation[];
}

type SizeGroup = "groupEU" | "groupUS" | "groupClothing" | "groupOther";

/** Numeric sizes < 20 are US/UK shoe sizes, larger ones EU; letters are clothing sizes. */
function sizeGroup(size: string): SizeGroup {
    const n = Number(size);
    if (!Number.isNaN(n)) return n >= 20 ? "groupEU" : "groupUS";
    if (/^(\d?X{0,3}[SML]|XL|\d?XL)$/.test(size)) return "groupClothing";
    return "groupOther";
}

const MK_CENTER: [number, number] = [41.6, 21.7];

/** Zooms to the shops once the map box has its final size (fitting earlier uses a wrong size). */
function FitToShops({ points }: { points: [number, number][] }) {
    const map = useMap();
    const key = points.map((p) => p.join(",")).join("|");
    useEffect(() => {
        const fit = () => {
            map.invalidateSize();
            if (points.length === 1) map.setView(points[0], 14);
            else if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 14 });
        };
        fit();
        const timer = setTimeout(fit, 250); // after layout settles (grid / mobile reflow)
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, key]);
    return null;
}

/**
 * "Which stores have it in my size?" on the product page. Nothing is requested from the
 * stores until the visitor clicks "Check availability".
 */
export default function StoreAvailability({ productId }: { productId: string }) {
    const { t } = useI18n();
    const { getStore } = useStoreLookup();
    const [enabled, setEnabled] = useState(false);
    const [size, setSize] = useState<string | null>(null);
    const [user, setUser] = useState<{ lat: number; lng: number } | null>(null);

    const query = useQuery<AvailabilityResponse>({
        queryKey: ["availability", productId, size],
        queryFn: () =>
            api.get<AvailabilityResponse>(
                `/products/${productId}/availability${size ? `?size=${encodeURIComponent(size)}` : ""}`,
            ),
        enabled,
        staleTime: 5 * 60 * 1000,
        placeholderData: (prev) => prev,
    });
    const data = query.data;

    const groups = useMemo(() => {
        const out = new Map<SizeGroup, string[]>();
        for (const s of data?.sizes || []) {
            const g = sizeGroup(s);
            out.set(g, [...(out.get(g) || []), s]);
        }
        return [...out.entries()];
    }, [data]);

    const shops = useMemo(() => {
        const list = (size && data?.size === size ? data.locations : []).map((l) => ({
            ...l,
            distance: user ? distanceKm(user, l) : null,
        }));
        return user ? list.sort((a, b) => a.distance! - b.distance!) : list;
    }, [data, size, user]);

    const chainName = (store: string) => getStore(store)?.name || store;
    const sizeHint = (s: string) =>
        (data?.chains || [])
            .filter((c) => c.sizes.some((x) => x.size === s))
            .map((c) => {
                const level = c.sizes.find((x) => x.size === s)?.level;
                return `${chainName(c.store)}${level ? ` – ${level}` : ""}`;
            })
            .join("\n");

    const locate = () =>
        navigator.geolocation?.getCurrentPosition(
            (pos) => setUser({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => undefined,
            { timeout: 10_000, maximumAge: 5 * 60_000 },
        );

    return (
        <section className="availability-box">
            <h3>{t("availability.title")}</h3>

            {!enabled ? (
                <>
                    <p className="availability-intro">{t("availability.intro")}</p>
                    <button type="button" className="availability-check" onClick={() => setEnabled(true)}>
                        {t("availability.check")}
                    </button>
                </>
            ) : query.isLoading && !data ? (
                <p className="availability-intro">{t("availability.loading")}</p>
            ) : (
                <>
                    {data && data.sizes.length === 0 && <p className="availability-intro">{t("availability.noSizes")}</p>}

                    {groups.length > 0 && (
                        <div className="availability-label">
                            {t("availability.pickSize")}
                            {/* Only shoe sizes need converting between systems. */}
                            {groups.some(([g]) => g === "groupEU" || g === "groupUS") && <SizeGuide selected={size} />}
                        </div>
                    )}
                    {groups.map(([group, sizes]) => (
                        <div key={group} className="availability-group">
                            {groups.length > 1 && <span className="availability-group__name">{t(`availability.${group}`)}</span>}
                            <div className="availability-sizes" role="group">
                                {sizes.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        title={sizeHint(s)}
                                        aria-pressed={size === s}
                                        className={`availability-size ${size === s ? "is-active" : ""}`}
                                        onClick={() => setSize(size === s ? null : s)}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}

                    {size && data?.size === size && (
                        <div className="availability-result">
                            <div className="availability-result__head">
                                <strong>
                                    {shops.length
                                        ? t("availability.inStock", { size, count: shops.length })
                                        : t("availability.none", { size })}
                                </strong>
                                {shops.length > 1 && !user && (
                                    <button type="button" className="availability-link" onClick={locate}>
                                        <FaLocationArrow aria-hidden="true" /> {t("availability.nearest")}
                                    </button>
                                )}
                            </div>

                            {shops.length > 0 && (
                                <div className="availability-layout">
                                    <ul className="availability-shops">
                                        {shops.map((l) => (
                                            <li key={l.id} className="store-card">
                                                <div className="store-card__head">
                                                    <span className="store-dot" style={{ background: chainColor(l.store) }} aria-hidden="true" />
                                                    <div>
                                                        <div className="store-card__name">{l.name}</div>
                                                        <div className="store-card__chain">{chainName(l.store)}</div>
                                                    </div>
                                                    {l.distance != null && (
                                                        <span className="store-card__distance">{t("stores.km", { km: l.distance.toFixed(1) })}</span>
                                                    )}
                                                </div>
                                                <div className="store-card__address">{formatAddress(l.address, l.city)}</div>
                                                <OpenStatusBadge hours={l.hours} />
                                                <div className="store-card__actions">
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
                                    <div className="availability-map">
                                        <MapContainer center={MK_CENTER} zoom={8} scrollWheelZoom={false} className="availability-map__leaflet">
                                            <FitToShops points={shops.map((l) => [l.lat, l.lng] as [number, number])} />
                                            <TileLayer
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            />
                                            {user && (
                                                <CircleMarker center={[user.lat, user.lng]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}>
                                                    <Popup>{t("stores.youAreHere")}</Popup>
                                                </CircleMarker>
                                            )}
                                            {shops.map((l) => (
                                                <CircleMarker
                                                    key={l.id}
                                                    center={[l.lat, l.lng]}
                                                    radius={8}
                                                    pathOptions={{ color: "#fff", weight: 2, fillColor: chainColor(l.store), fillOpacity: 0.95 }}>
                                                    <Popup>
                                                        <strong>{l.name}</strong>
                                                        <br />
                                                        {formatAddress(l.address, l.city)}
                                                    </Popup>
                                                </CircleMarker>
                                            ))}
                                        </MapContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {data && (
                        <ul className="availability-notes">
                            {data.chains
                                .filter((c) => c.onlineOnly && size)
                                .map((c) => (
                                    <li key={`online-${c.store}`}>{t("availability.onlineOnly", { store: chainName(c.store) })}</li>
                                ))}
                            {data.chains
                                .filter((c) => c.status !== "ok")
                                .map((c) => (
                                    <li key={c.store}>
                                        {t(c.status === "unsupported" ? "availability.unsupported" : "availability.failed", { store: chainName(c.store) })}{" "}
                                        <a href={c.url} target="_blank" rel="noreferrer">
                                            {t("availability.checkSite")} <FaExternalLinkAlt aria-hidden="true" />
                                        </a>
                                    </li>
                                ))}
                        </ul>
                    )}

                    <p className="availability-disclaimer">
                        {t("availability.disclaimer")} <Link to="/stores">{t("availability.allStores")}</Link>
                    </p>
                </>
            )}
        </section>
    );
}

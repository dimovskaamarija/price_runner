import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { FaExternalLinkAlt } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import Spinner from "../components/Spinner";
import { useCompare } from "../context/compare";
import { useStoreLookup } from "../hooks/useStoreLookup";
import type { Product } from "../hooks/useProducts";
import { api } from "../utils/api";
import { capitalizeBrand, formatNumber } from "../utils/formatting";
import "../styles/Compare.css";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface CompareResponse {
    products: Product[];
    history: { productId: string; price: number; date: string }[];
}

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#7e22ce"];

const SPECS: { key: keyof Product; label: string; format?: (v: string) => string }[] = [
    { key: "brand", label: "Бренд", format: capitalizeBrand },
    { key: "category", label: "Категорија" },
    { key: "subcategory", label: "Поткатегорија" },
    { key: "gender", label: "Пол" },
    { key: "age", label: "Возраст" },
    { key: "color", label: "Боја" },
];

const lowest = (p: Product) => {
    const prices = Object.values(p.priceMap || {}).filter((v): v is number => v != null);
    return prices.length ? Math.min(...prices) : null;
};

const price = (v: number | null | undefined) => (v != null ? `${formatNumber(v)} ден` : "—");

export default function Compare() {
    const { items, ids, remove, clear, replace } = useCompare();
    const { getStore } = useStoreLookup();
    const [searchParams, setSearchParams] = useSearchParams();
    const [onlyDifferences, setOnlyDifferences] = useState(false);

    // Shared links (/compare?ids=a,b) load into the compare list once.
    useEffect(() => {
        const shared = searchParams.get("ids");
        if (shared) {
            const sharedIds = shared.split(",").filter(Boolean);
            if (sharedIds.join(",") !== ids.join(",")) replace(sharedIds.map((id) => ({ id, name: "" })));
            setSearchParams({}, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { data, isLoading, isError } = useQuery<CompareResponse>({
        queryKey: ["compare", ids],
        queryFn: () => api.get<CompareResponse>(`/products/compare?ids=${ids.map(encodeURIComponent).join(",")}`),
        enabled: ids.length > 0,
        placeholderData: (prev) => prev,
    });

    // Keep the user's selection order; drop products that no longer exist.
    const products = useMemo(() => {
        const byId = new Map((data?.products || []).map((p) => [p.id, p]));
        return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
    }, [data, ids]);

    // Fill in names/images for items added via a shared link.
    useEffect(() => {
        if (products.length && items.some((i) => !i.name)) {
            replace(products.map((p) => ({ id: p.id, name: p.name, image: p.image })));
        }
    }, [products, items, replace]);

    const stores = useMemo(
        () => [...new Set(products.flatMap((p) => Object.keys(p.priceMap || {})))].sort((a, b) => a.localeCompare(b)),
        [products],
    );
    const lowestPrices = products.map(lowest);
    const cheapest = Math.min(...lowestPrices.filter((v): v is number => v != null));

    const chart = useMemo(() => {
        const history = data?.history || [];
        const dates = [...new Set(history.map((h) => h.date))].sort();
        if (dates.length < 2) return null;
        return {
            labels: dates.map((d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })),
            datasets: products.map((p, i) => {
                const byDate = new Map(history.filter((h) => h.productId === p.id).map((h) => [h.date, h.price]));
                return {
                    label: p.name,
                    data: dates.map((d) => byDate.get(d) ?? null),
                    borderColor: COLORS[i % COLORS.length],
                    backgroundColor: COLORS[i % COLORS.length] + "20",
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: dates.length > 45 ? 0 : 3,
                    spanGaps: true,
                };
            }),
        };
    }, [data, products]);

    if (!ids.length) {
        return (
            <div className="compare-page">
                <h1>Споредба на производи</h1>
                <div className="compare-empty">
                    <p>Немате избрано производи за споредба.</p>
                    <p>Кликнете „Спореди“ на производите што ве интересираат (до 4).</p>
                    <Link to="/products" className="compare-tray__go">
                        Кон производите
                    </Link>
                </div>
            </div>
        );
    }

    if (isLoading && !data) return <Spinner />;
    if (isError) return <div className="compare-page compare-empty">Грешка при вчитување. Обидете се повторно.</div>;

    const allSame = (values: string[]) => values.every((v) => v === values[0]);
    const specRows = SPECS.filter(({ key }) => !onlyDifferences || !allSame(products.map((p) => String(p[key] ?? ""))));
    const storeRows = stores.filter(
        (s) => !onlyDifferences || !allSame(products.map((p) => String(p.priceMap?.[s] ?? ""))),
    );

    return (
        <div className="compare-page">
            <div className="compare-header">
                <h1>Споредба на производи</h1>
                <div className="compare-header__actions">
                    <label className="compare-diff-toggle">
                        <input type="checkbox" checked={onlyDifferences} onChange={(e) => setOnlyDifferences(e.target.checked)} />
                        Прикажи само разлики
                    </label>
                    <button type="button" className="compare-tray__clear" onClick={clear}>
                        Исчисти сè
                    </button>
                </div>
            </div>

            {products.length < 2 && <p className="compare-hint">Додадете уште најмалку еден производ за споредба.</p>}

            <div className="compare-table-wrapper">
                <table className="compare-table" style={{ ["--cols" as string]: products.length }}>
                    <thead>
                        <tr>
                            <th className="compare-table__label" />
                            {products.map((p) => (
                                <th key={p.id} className="compare-product">
                                    <button
                                        type="button"
                                        className="compare-product__remove"
                                        aria-label={`Отстрани ${p.name}`}
                                        onClick={() => remove(p.id)}>
                                        <IoClose />
                                    </button>
                                    <Link to={`/product/${p.id}`} className="compare-product__link">
                                        {p.image && <img src={p.image} alt={p.name} referrerPolicy="no-referrer" />}
                                        <span>{p.name}</span>
                                    </Link>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        <tr className="compare-row--highlight">
                            <th className="compare-table__label">Најниска цена</th>
                            {products.map((p, i) => (
                                <td key={p.id} className={lowestPrices[i] === cheapest && products.length > 1 ? "is-best" : ""}>
                                    <strong>{price(lowestPrices[i])}</strong>
                                    {lowestPrices[i] === cheapest && products.length > 1 && <span className="compare-badge">Најевтино</span>}
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <th className="compare-table__label">Продавници</th>
                            {products.map((p) => (
                                <td key={p.id}>{Object.keys(p.priceMap || {}).length}</td>
                            ))}
                        </tr>

                        {storeRows.length > 0 && (
                            <tr className="compare-section">
                                <th colSpan={products.length + 1}>Цени по продавници</th>
                            </tr>
                        )}
                        {storeRows.map((store) => {
                            const rowPrices = products.map((p) => p.priceMap?.[store] ?? null);
                            const priced = rowPrices.filter((v): v is number => v != null);
                            // Highlight only when at least two products are sold in this store.
                            const rowBest = priced.length >= 2 ? Math.min(...priced) : null;
                            const meta = getStore(store);
                            return (
                                <tr key={store}>
                                    <th className="compare-table__label">
                                        <span className="compare-store">
                                            {meta?.logo_url && (
                                                <img src={meta.logo_url} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                                            )}
                                            {meta?.name || store}
                                        </span>
                                    </th>
                                    {products.map((p, i) => {
                                        const v = rowPrices[i];
                                        const link = p.storeLinks?.[store];
                                        return (
                                            <td key={p.id} className={v != null && v === rowBest ? "is-best" : ""}>
                                                {v != null ? (
                                                    <>
                                                        {price(v)}
                                                        {link && (
                                                            <a href={link} target="_blank" rel="noreferrer" className="compare-visit" title="Посети">
                                                                <FaExternalLinkAlt />
                                                            </a>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="compare-missing">Нема</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}

                        {specRows.length > 0 && (
                            <tr className="compare-section">
                                <th colSpan={products.length + 1}>Спецификации</th>
                            </tr>
                        )}
                        {specRows.map(({ key, label, format }) => (
                            <tr key={key}>
                                <th className="compare-table__label">{label}</th>
                                {products.map((p) => {
                                    const v = p[key] as string | undefined;
                                    return <td key={p.id}>{v ? (format ? format(v) : v) : "—"}</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {onlyDifferences && !specRows.length && !storeRows.length && (
                <p className="compare-hint">Производите имаат исти спецификации и цени по продавници.</p>
            )}

            <div className="compare-chart">
                <h3>Најниска цена низ времето (последни 3 месеци)</h3>
                {chart ? (
                    <Line
                        data={chart}
                        height={90}
                        options={{
                            plugins: { legend: { display: true } },
                            scales: { y: { beginAtZero: false } },
                        }}
                    />
                ) : (
                    <p className="compare-hint">Графиконот ќе се прикаже кога ќе има цени од повеќе денови.</p>
                )}
            </div>
        </div>
    );
}

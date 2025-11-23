import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface PriceHistory {
    store: string;
    price: number;
    date: string;
}

interface Store {
    id: string;
    name: string;
    logo_url?: string;
}

interface Props {
    productId: string;
    storesMap: Record<string, Store | undefined>;
}

export default function PriceHistoryChart({ productId, storesMap }: Props) {
    const [history, setHistory] = useState<PriceHistory[]>([]);
    const [selectedStores, setSelectedStores] = useState<string[]>([]);

    useEffect(() => {
        if (!productId) return;

        const load = async () => {
            const res = await fetch(`http://localhost:3000/products/${productId}/history`);
            const data: PriceHistory[] = await res.json();
            setHistory(data);

            const uniqueStores = [...new Set(data.map((i) => i.store))];
            setSelectedStores(uniqueStores);
        };

        load();
    }, [productId]);

    if (history.length === 0) return null;

    const getStoreData = (storeName: string) => {
        const lower = storeName.toLowerCase();

        let s =
            storesMap[storeName] ||
            storesMap[lower];

        if (s) return s;

        return Object.values(storesMap).find(
            (x) =>
                x &&
                (
                    x.name.toLowerCase().includes(lower) ||
                    lower.includes(x.name.toLowerCase())
                )
        );
    };

    const allDates = [...new Set(history.map((i) => i.date))].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    const labels = allDates.map((date) =>
        new Date(date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
        })
    );

    const priceMap: Record<string, Record<string, number>> = {};
    history.forEach((entry) => {
        if (!priceMap[entry.date]) {
            priceMap[entry.date] = {};
        }
        priceMap[entry.date][entry.store] = entry.price;
    });

    const datasets = selectedStores.map((store, index) => {
        const data = allDates.map((date) => priceMap[date]?.[store] ?? null);

        const storeData = getStoreData(store);
        const colors = ["#2563eb", "#16a34a", "#d97706", "#7e22ce", "#dc2626", "#059669"];
        const color = colors[index % colors.length];

        return {
            label: storeData?.name || store,
            data: data,
            tension: 0.3,
            borderWidth: 2,
            borderColor: color,
            backgroundColor: color + "20",
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
        };
    });

    return (
        <div className="history-box">
            <h3>Историја на цени</h3>

            <div className="store-buttons">
                {history.map((h) => h.store).filter((v, i, arr) => arr.indexOf(v) === i).map((store) => {
                    const storeData = getStoreData(store);
                    const isActive = selectedStores.includes(store);

                    return (
                        <button
                            key={store}
                            className={`store-toggle ${isActive ? "active" : ""}`}
                            onClick={() =>
                                setSelectedStores((prev) =>
                                    isActive
                                        ? prev.filter((s) => s !== store)
                                        : [...prev, store]
                                )
                            }
                        >
                            <div className="store-btn-content">
                                {storeData?.logo_url && (
                                    <img
                                        src={storeData.logo_url}
                                        alt={storeData.name}
                                        className="store-logo-small"
                                    />
                                )}
                                <span>{storeData?.name || store}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <Line data={{ labels, datasets }} height={80} />
        </div>
    );
}

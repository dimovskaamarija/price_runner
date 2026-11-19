import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FaTrash } from "react-icons/fa";
import Spinner from "../components/Spinner";
import { api } from "../utils/api";
import { useI18n } from "../i18n";
import { useUser } from "../hooks/useUser";
import "../styles/PriceAlerts.css";

interface MyAlert {
    id: number;
    type: "target" | "change";
    targetPrice: number | null;
    productId: string;
    productName: string;
    productImage: string | null;
    minPrice: number | null;
}

/** "My price alerts" for logged-in users. Guests manage alerts through the links in their emails. */
export default function MyAlerts() {
    const { t, price } = useI18n();
    const { user } = useUser();
    const queryClient = useQueryClient();

    const { data = [], isLoading } = useQuery<MyAlert[]>({
        queryKey: ["my-alerts", user?.id],
        queryFn: () => api.get<MyAlert[]>("/alerts"),
        enabled: !!user,
    });

    const remove = useMutation({
        mutationFn: (id: number) => api.delete(`/alerts/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-alerts"] }),
    });

    if (!user) {
        return (
            <div className="alert-page">
                <div className="alert-page__card">
                    <h1>{t("alerts.myTitle")}</h1>
                    <p>{t("alerts.myLogin")}</p>
                </div>
            </div>
        );
    }
    if (isLoading) return <Spinner />;

    return (
        <div className="my-alerts">
            <h1>{t("alerts.myTitle")}</h1>
            {data.length === 0 ? (
                <p className="my-alerts__empty">{t("alerts.myEmpty")}</p>
            ) : (
                <ul className="my-alerts__list">
                    {data.map((a) => (
                        <li key={a.id} className="my-alerts__item">
                            <Link to={`/product/${a.productId}`} className="my-alerts__product">
                                {a.productImage && <img src={a.productImage} alt="" referrerPolicy="no-referrer" />}
                                <span>{a.productName}</span>
                            </Link>
                            <span className="my-alerts__rule">
                                {a.type === "target" ? t("alerts.myTarget", { price: price(a.targetPrice) }) : t("alerts.myChange")}
                            </span>
                            <span className="my-alerts__now">{t("alerts.myCurrent", { price: price(a.minPrice) })}</span>
                            <button type="button" className="my-alerts__delete" onClick={() => remove.mutate(a.id)} disabled={remove.isPending}>
                                <FaTrash aria-hidden="true" /> {t("alerts.delete")}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

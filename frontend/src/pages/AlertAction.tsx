import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../utils/api";
import { useI18n } from "../i18n";
import "../styles/PriceAlerts.css";

type Action = "confirm" | "unsubscribe";
type Response = { status: "confirmed" | "unsubscribed"; productId?: string; productName?: string };

/** Landing page for the links in alert emails: /alerts/confirm/:token and /alerts/unsubscribe/:token. */
export default function AlertAction({ action }: { action: Action }) {
    const { token } = useParams<{ token: string }>();
    const { t } = useI18n();
    const [state, setState] = useState<{ loading: boolean; data?: Response; failed?: boolean }>({ loading: true });

    useEffect(() => {
        if (!token) return;
        api.post<Response>(`/alerts/${action}/${encodeURIComponent(token)}`)
            .then((data) => setState({ loading: false, data }))
            .catch(() => setState({ loading: false, failed: true }));
    }, [action, token]);

    const message = state.loading
        ? t(action === "confirm" ? "alerts.confirming" : "alerts.unsubscribing")
        : state.failed
          ? t("alerts.notFound")
          : state.data?.status === "confirmed"
            ? t("alerts.confirmed")
            : t("alerts.unsubscribed");

    return (
        <div className="alert-page">
            <div className={`alert-page__card ${state.failed ? "is-error" : ""}`}>
                <h1>{t("alerts.title")}</h1>
                {state.data?.productName && <p className="alert-page__product">{state.data.productName}</p>}
                <p role="status">{message}</p>
                {state.data?.productId && (
                    <Link className="alert-primary" to={`/product/${state.data.productId}`}>
                        {t("alerts.toProduct")}
                    </Link>
                )}
            </div>
        </div>
    );
}

import { useI18n } from "../i18n";
import { openStatus, type WeeklyHours } from "../utils/geo";
import "../styles/StoreMap.css";

/** "Отворено · до 22:00" / "Затворено · отвора во 10:00", in Skopje time. */
export default function OpenStatusBadge({ hours }: { hours: WeeklyHours | null }) {
    const { t } = useI18n();
    const s = openStatus(hours);
    if (s.kind === "open") {
        return (
            <span className="store-status is-open">
                {t("stores.openNow")} · {t("stores.closesAt", { time: s.closesAt })}
            </span>
        );
    }
    if (s.kind === "closed") {
        return (
            <span className="store-status is-closed">
                {t("stores.closedNow")}
                {s.opensAt && ` · ${t("stores.opensAt", { time: s.opensAt })}`}
            </span>
        );
    }
    return <span className="store-status is-unknown">{t("stores.hoursUnknown")}</span>;
}

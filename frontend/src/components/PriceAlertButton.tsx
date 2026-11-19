import { useEffect, useRef, useState } from "react";
import { FaBell } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { api } from "../utils/api";
import { useI18n } from "../i18n";
import { useUser } from "../hooks/useUser";
import "../styles/PriceAlerts.css";

const EMAIL_KEY = "alertEmail";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Result = { status: "active" | "confirm-email"; updated: boolean };

/** Bell button on the product page that opens the "price alert" dialog. */
export default function PriceAlertButton({ productId, lowestPrice }: { productId: string; lowestPrice: number | null }) {
    const { t, price, lang } = useI18n();
    const { user } = useUser();
    const [open, setOpen] = useState(false);
    const [type, setType] = useState<"target" | "change">("target");
    const [target, setTarget] = useState("");
    const [email, setEmail] = useState(() => {
        try {
            return localStorage.getItem(EMAIL_KEY) || "";
        } catch {
            return "";
        }
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    const openDialog = () => {
        // Suggest 10% below today's lowest price.
        setTarget(lowestPrice ? String(Math.round((lowestPrice * 0.9) / 10) * 10) : "");
        setError(null);
        setResult(null);
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("keydown", onKey);
        dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const targetPrice = Number(target);
        if (type === "target" && (!Number.isFinite(targetPrice) || targetPrice <= 0)) return setError(t("alerts.errorPrice"));
        if (!user && !EMAIL_RE.test(email.trim())) return setError(t("alerts.errorEmail"));

        setSaving(true);
        try {
            const res = await api.post<Result>("/alerts", {
                productId,
                type,
                targetPrice: type === "target" ? targetPrice : null,
                email: user ? undefined : email.trim(),
                lang,
            });
            if (!user) {
                try {
                    localStorage.setItem(EMAIL_KEY, email.trim());
                } catch {
                    /* ignore */
                }
            }
            setResult(res);
        } catch {
            setError(t("alerts.errorGeneric"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <button type="button" className="alert-btn" onClick={openDialog} title={t("alerts.button")}>
                <FaBell aria-hidden="true" />
                <span>{t("alerts.button")}</span>
            </button>

            {open && (
                <div className="alert-overlay" onMouseDown={() => setOpen(false)}>
                    <div
                        className="alert-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="alert-dialog-title"
                        ref={dialogRef}
                        onMouseDown={(e) => e.stopPropagation()}>
                        <div className="alert-dialog__head">
                            <h2 id="alert-dialog-title">{t("alerts.title")}</h2>
                            <button type="button" className="alert-dialog__close" aria-label={t("alerts.close")} onClick={() => setOpen(false)}>
                                <IoClose />
                            </button>
                        </div>

                        {result ? (
                            <div className="alert-dialog__done">
                                <p>
                                    {result.status === "confirm-email"
                                        ? t("alerts.successConfirm")
                                        : result.updated
                                          ? t("alerts.successUpdated")
                                          : t("alerts.successActive")}
                                </p>
                                <button type="button" className="alert-primary" onClick={() => setOpen(false)}>
                                    {t("alerts.close")}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={submit} noValidate>
                                {lowestPrice != null && <p className="alert-current">{t("alerts.current", { price: price(lowestPrice) })}</p>}

                                <label className={`alert-option ${type === "target" ? "is-selected" : ""}`}>
                                    <input type="radio" name="alert-type" checked={type === "target"} onChange={() => setType("target")} />
                                    <span className="alert-option__body">
                                        <span className="alert-option__title">{t("alerts.typeTarget")}</span>
                                        <span className="alert-target">
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                value={target}
                                                onFocus={() => setType("target")}
                                                onChange={(e) => setTarget(e.target.value)}
                                                aria-label={t("alerts.typeTarget")}
                                            />
                                            <span>{t("common.currency")}</span>
                                        </span>
                                        {type === "target" && Number(target) > 0 && (
                                            <span className="alert-option__hint">{t("alerts.targetHint", { price: price(Number(target)) })}</span>
                                        )}
                                    </span>
                                </label>

                                <label className={`alert-option ${type === "change" ? "is-selected" : ""}`}>
                                    <input type="radio" name="alert-type" checked={type === "change"} onChange={() => setType("change")} />
                                    <span className="alert-option__body">
                                        <span className="alert-option__title">{t("alerts.typeChange")}</span>
                                        <span className="alert-option__hint">{t("alerts.typeChangeHint")}</span>
                                    </span>
                                </label>

                                {user ? (
                                    <p className="alert-sendto">{t("alerts.sendTo", { email: user.email })}</p>
                                ) : (
                                    <label className="alert-email">
                                        <span>{t("alerts.email")}</span>
                                        <input
                                            type="email"
                                            autoComplete="email"
                                            placeholder={t("alerts.emailPlaceholder")}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </label>
                                )}

                                {error && (
                                    <p className="alert-error" role="alert">
                                        {error}
                                    </p>
                                )}

                                <div className="alert-actions">
                                    <button type="button" className="alert-secondary" onClick={() => setOpen(false)}>
                                        {t("alerts.cancel")}
                                    </button>
                                    <button type="submit" className="alert-primary" disabled={saving}>
                                        {saving ? t("alerts.saving") : t("alerts.submit")}
                                    </button>
                                </div>
                                <p className="alert-privacy">{t("alerts.privacy")}</p>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

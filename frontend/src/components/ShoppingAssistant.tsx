import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoChatbubbleEllipses, IoClose, IoRefresh, IoSend } from "react-icons/io5";
import { useCompare } from "../context/compare";
import type { Product } from "../hooks/useProducts";
import { useI18n } from "../i18n";
import type { User } from "../types/user";
import { api } from "../utils/api";
import { formatNumber } from "../utils/formatting";
import { getMinPrice } from "../utils/pricing";
import "../styles/ShoppingAssistant.css";

interface Filters {
    search: string;
    category: string[];
    subcategory: string[];
    brand: string[];
    age: string[];
    gender: string[];
    color: string[];
    minPrice: number;
    maxPrice: number;
    sort: string;
}

interface Reply {
    kind: "results" | "none" | "help" | "text";
    reply?: string;
    products: Product[];
    total: number;
    relaxed: string[];
    personalized: boolean;
    filters: Filters | null;
}

interface Message {
    id: number;
    role: "user" | "assistant";
    text: string;
    result?: Reply;
}

/** Same query string ProductList writes, so "see all" opens exactly these filters. */
function listUrl(f: Filters): string {
    const q = new URLSearchParams({ page: "1", sort: f.sort });
    if (f.search) q.set("search", f.search);
    for (const k of ["category", "subcategory", "brand", "age", "gender", "color"] as const) {
        if (f[k].length) q.set(k, f[k].join(","));
    }
    q.set("minPrice", String(f.minPrice));
    q.set("maxPrice", String(f.maxPrice));
    return `/products?${q}`;
}

function guestFavorites(): string[] {
    try {
        const ids = JSON.parse(localStorage.getItem("favorites") || "[]");
        return Array.isArray(ids) ? ids.slice(-50) : [];
    } catch {
        return [];
    }
}

let nextId = 1;

export default function ShoppingAssistant({ user }: { user: User | null }) {
    const { t, price, lang } = useI18n();
    const navigate = useNavigate();
    const { items: compared } = useCompare();
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const bodyRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const chatRef = useRef(0); // bumped by "new chat" so a late answer is ignored

    useEffect(() => {
        // Show an answer from its start (its products can be taller than the panel); otherwise follow the end.
        const body = bodyRef.current;
        if (!body) return;
        const turns = body.querySelectorAll<HTMLElement>(".assistant__turn");
        const last = turns[turns.length - 1];
        const answered = messages[messages.length - 1]?.role === "assistant";
        body.scrollTop = last && answered ? last.offsetTop - body.offsetTop - 8 : body.scrollHeight;
    }, [messages, busy, open]);

    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus();
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const describe = (r: Reply): string => {
        if (r.kind === "text") return r.reply || t("assistant.help");
        if (r.kind === "none") return t("assistant.none");
        if (r.kind === "help") return t("assistant.help");
        const found = t("assistant.found", { count: r.total, formatted: formatNumber(r.total) });
        if (r.personalized) return `${t("assistant.personalized")} ${found}`;
        return r.relaxed.length ? `${t("assistant.relaxed")} ${found}` : found;
    };

    const send = async (raw: string) => {
        const text = raw.trim();
        if (!text || busy) return;
        const chat = chatRef.current;
        const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
        const previous = [...messages].reverse().find((m) => m.result?.filters)?.result?.filters;
        setMessages((m) => [...m, { id: nextId++, role: "user", text }]);
        setInput("");
        setBusy(true);
        let answer: Message;
        try {
            const result = await api.post<Reply>("/assistant/chat", {
                message: text,
                history,
                previous,
                lang,
                favoriteIds: user ? [] : guestFavorites(),
            });
            answer = { id: nextId++, role: "assistant", text: describe(result), result };
        } catch {
            answer = { id: nextId++, role: "assistant", text: t("assistant.error") };
        }
        if (chat !== chatRef.current) return;
        setMessages((m) => [...m, answer]);
        setBusy(false);
    };

    const reset = () => {
        chatRef.current++;
        setMessages([]);
        setBusy(false);
        inputRef.current?.focus();
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        send(input);
    };

    /** On phones the panel covers the page, so get out of the way after navigating. */
    const afterNavigate = () => {
        if (window.matchMedia("(max-width: 600px)").matches) setOpen(false);
    };

    if (!open) {
        return (
            <button
                type="button"
                className={`assistant-fab${compared.length ? " assistant-fab--raised" : ""}`}
                aria-label={t("assistant.open")}
                title={t("assistant.title")}
                onClick={() => setOpen(true)}>
                <IoChatbubbleEllipses />
            </button>
        );
    }

    return (
        <section className="assistant" role="dialog" aria-label={t("assistant.title")}>
            <header className="assistant__head">
                <strong>{t("assistant.title")}</strong>
                <button type="button" onClick={reset} aria-label={t("assistant.reset")} title={t("assistant.reset")}>
                    <IoRefresh />
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label={t("assistant.close")} title={t("assistant.close")}>
                    <IoClose />
                </button>
            </header>

            <div className="assistant__body" ref={bodyRef} aria-live="polite">
                <p className="assistant__msg">{t("assistant.welcome")}</p>
                {!messages.length && (
                    <div className="assistant__chips">
                        {[t("assistant.s1"), t("assistant.s2"), t("assistant.s3")].map((s) => (
                            <button type="button" key={s} onClick={() => send(s)}>
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {messages.map((m) => (
                    <div key={m.id} className="assistant__turn">
                        <p className={`assistant__msg${m.role === "user" ? " assistant__msg--user" : ""}`}>{m.text}</p>
                        {m.result?.products.map((p) => (
                            <Link key={p.id} to={`/product/${p.id}`} className="assistant__product" onClick={afterNavigate}>
                                {p.image && <img src={p.image} alt="" referrerPolicy="no-referrer" loading="lazy" />}
                                <span>
                                    <span className="assistant__name">{p.name}</span>
                                    <span className="assistant__price">{price(getMinPrice(p.priceMap))}</span>
                                </span>
                            </Link>
                        ))}
                        {m.result?.filters && m.result.total > m.result.products.length && (
                            <button
                                type="button"
                                className="assistant__all"
                                onClick={() => {
                                    navigate(listUrl(m.result!.filters!));
                                    afterNavigate();
                                }}>
                                {t("assistant.seeAll", { formatted: formatNumber(m.result.total) })}
                            </button>
                        )}
                    </div>
                ))}
                {busy && <p className="assistant__msg">{t("assistant.thinking")}</p>}
            </div>

            <form className="assistant__form" onSubmit={submit}>
                <input
                    ref={inputRef}
                    value={input}
                    maxLength={500}
                    placeholder={t("assistant.placeholder")}
                    aria-label={t("assistant.placeholder")}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button type="submit" disabled={busy || !input.trim()} aria-label={t("assistant.send")}>
                    <IoSend />
                </button>
            </form>
            <small className="assistant__privacy">{t("assistant.privacy")}</small>
        </section>
    );
}

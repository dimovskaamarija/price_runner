import { useEffect, useRef, useState } from "react";
import { IoGlobeOutline, IoCheckmark, IoChevronDown } from "react-icons/io5";
import { LANGUAGES, useI18n, type Language } from "../i18n";

/** Each language is shown in its own language, so people can always find theirs. */
const OPTIONS: Record<Language, { short: string; name: string }> = {
    mk: { short: "МК", name: "Македонски" },
    en: { short: "EN", name: "English" },
};

/** Globe button in the navigation bar with a dropdown to pick the language. */
export default function LanguageSwitch() {
    const { lang, setLanguage, t } = useI18n();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Close on click outside or Escape.
    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="lang-menu" ref={rootRef}>
            <button
                type="button"
                className="lang-menu__toggle"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${t("nav.language")}: ${OPTIONS[lang].name}`}
                title={t("nav.language")}
                onClick={() => setOpen((o) => !o)}>
                <IoGlobeOutline className="lang-menu__globe" aria-hidden="true" />
                {/* Both codes share one cell so the button keeps the same width in every language. */}
                <span className="lang-menu__code stable-label" aria-hidden="true">
                    {LANGUAGES.map((l) => (
                        <span key={l} className={l === lang ? undefined : "stable-label__ghost"}>
                            {OPTIONS[l].short}
                        </span>
                    ))}
                </span>
                <IoChevronDown className={`lang-menu__chevron ${open ? "is-open" : ""}`} aria-hidden="true" />
            </button>

            {open && (
                <ul className="lang-menu__list" role="menu">
                    {LANGUAGES.map((l) => (
                        <li key={l} role="none">
                            <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={lang === l}
                                lang={l}
                                className={`lang-menu__item ${lang === l ? "is-active" : ""}`}
                                onClick={() => {
                                    setLanguage(l);
                                    setOpen(false);
                                }}>
                                <span>{OPTIONS[l].name}</span>
                                {lang === l && <IoCheckmark aria-hidden="true" />}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

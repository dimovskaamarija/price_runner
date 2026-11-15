import { LANGUAGES, useI18n, type Language } from "../i18n";

const LABELS: Record<Language, string> = { mk: "МК", en: "EN" };

/** МК | EN toggle in the navigation bar. The choice is remembered in the browser. */
export default function LanguageSwitch() {
    const { lang, setLanguage, t } = useI18n();

    return (
        <div className="lang-switch" role="group" aria-label={t("nav.language")}>
            {LANGUAGES.map((l) => (
                <button
                    key={l}
                    type="button"
                    lang={l}
                    className={`lang-switch__btn ${lang === l ? "is-active" : ""}`}
                    aria-pressed={lang === l}
                    onClick={() => setLanguage(l)}>
                    {LABELS[l]}
                </button>
            ))}
        </div>
    );
}

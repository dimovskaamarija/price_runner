import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { mk } from "./locales/mk";
import { en } from "./locales/en";
import { TAXONOMY_EN } from "./taxonomy";
import { formatNumber } from "../utils/formatting";

export const LANGUAGES = ["mk", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = "lang";

const isLanguage = (v: unknown): v is Language => LANGUAGES.includes(v as Language);

/** ?lang=en in the URL (shareable links) > saved choice > Macedonian. */
function detectLanguage(): Language {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get("lang");
        if (isLanguage(fromUrl)) return fromUrl;
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isLanguage(saved)) return saved;
    } catch {
        /* storage unavailable */
    }
    return "mk";
}

i18n.use(initReactI18next).init({
    resources: { mk: { translation: mk }, en: { translation: en } },
    lng: detectLanguage(),
    fallbackLng: "mk",
    interpolation: { escapeValue: false }, // React already escapes
});

const applyLanguage = (lng: string) => {
    document.documentElement.lang = lng;
    try {
        localStorage.setItem(STORAGE_KEY, lng);
    } catch {
        /* storage unavailable */
    }
};
applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);

export default i18n;

/**
 * Translation helpers for components:
 *   t      - UI text
 *   tv     - catalog value (category, subcategory, gender, age, colour) for display
 *   price  - "1 499 ден" / "1 499 MKD"
 *   locale - for dates
 */
export function useI18n() {
    const { t, i18n: inst } = useTranslation();
    const lang = (isLanguage(inst.language) ? inst.language : "mk") as Language;
    const tv = (value?: string | null) => (value && lang === "en" ? TAXONOMY_EN[value] || value : value || "");
    const price = (n: number | null | undefined) => (n != null ? `${formatNumber(n)} ${t("common.currency")}` : t("common.noPrice"));
    return {
        t,
        tv,
        price,
        lang,
        locale: lang === "en" ? "en-GB" : "mk-MK",
        setLanguage: (l: Language) => inst.changeLanguage(l),
    };
}

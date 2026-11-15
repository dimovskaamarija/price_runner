import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";

/**
 * Text that is always as wide as its longest translation, so switching language doesn't
 * shift the layout. All translations are stacked in one grid cell and only the current one
 * is visible; the others only reserve space and are hidden from screen readers.
 */
export default function StableLabel({ k }: { k: string }) {
    const { i18n } = useTranslation();
    return (
        <span className="stable-label">
            {LANGUAGES.map((l) => {
                const active = l === i18n.language;
                return (
                    <span key={l} className={active ? undefined : "stable-label__ghost"} aria-hidden={!active || undefined}>
                        {i18n.getFixedT(l)(k)}
                    </span>
                );
            })}
        </span>
    );
}

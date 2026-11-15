import { useEffect, useRef, useState } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useI18n } from "../i18n";

/** Standard adult sneaker chart (men's / unisex; Nike-style). Brands can differ by half a size. */
const CHART: Array<{ us: string; uk: string; eu: string; cm: string }> = [
    { us: "6", uk: "5.5", eu: "38.5", cm: "24" },
    { us: "6.5", uk: "6", eu: "39", cm: "24.5" },
    { us: "7", uk: "6", eu: "40", cm: "25" },
    { us: "7.5", uk: "6.5", eu: "40.5", cm: "25.5" },
    { us: "8", uk: "7", eu: "41", cm: "26" },
    { us: "8.5", uk: "7.5", eu: "42", cm: "26.5" },
    { us: "9", uk: "8", eu: "42.5", cm: "27" },
    { us: "9.5", uk: "8.5", eu: "43", cm: "27.5" },
    { us: "10", uk: "9", eu: "44", cm: "28" },
    { us: "10.5", uk: "9.5", eu: "44.5", cm: "28.5" },
    { us: "11", uk: "10", eu: "45", cm: "29" },
    { us: "11.5", uk: "10.5", eu: "45.5", cm: "29.5" },
    { us: "12", uk: "11", eu: "46", cm: "30" },
    { us: "12.5", uk: "11.5", eu: "47", cm: "30.5" },
    { us: "13", uk: "12", eu: "47.5", cm: "31" },
];

/**
 * ⓘ next to the size picker: hover (desktop) or tap (phone) shows a US / UK / EU / cm table,
 * with the row of the selected size highlighted.
 */
export default function SizeGuide({ selected }: { selected: string | null }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent | TouchEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const isSelected = (row: (typeof CHART)[number]) => !!selected && (row.us === selected || row.eu === selected);

    return (
        <div className="size-guide" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button
                type="button"
                className="size-guide__toggle"
                aria-label={t("availability.sizeGuide")}
                aria-expanded={open}
                aria-controls="size-guide-panel"
                // Hover already opens it on desktop; a click/tap only opens (outside tap or Escape closes).
                onClick={() => setOpen(true)}>
                <IoInformationCircleOutline aria-hidden="true" />
            </button>

            {open && (
                <div id="size-guide-panel" className="size-guide__panel" role="dialog" aria-label={t("availability.sizeGuide")}>
                    <div className="size-guide__title">{t("availability.sizeGuide")}</div>
                    <table className="size-guide__table">
                        <thead>
                            <tr>
                                <th>US</th>
                                <th>UK</th>
                                <th>EU</th>
                                <th>{t("availability.footLength")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CHART.map((row) => (
                                <tr key={row.us} className={isSelected(row) ? "is-selected" : undefined}>
                                    <td>{row.us}</td>
                                    <td>{row.uk}</td>
                                    <td>{row.eu}</td>
                                    <td>{row.cm}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="size-guide__note">{t("availability.sizeGuideNote")}</p>
                </div>
            )}
        </div>
    );
}

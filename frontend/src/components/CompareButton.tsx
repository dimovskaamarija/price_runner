import { MdCompareArrows } from "react-icons/md";
import { MAX_COMPARE, useCompare, type CompareItem } from "../context/compare";
import "../styles/Compare.css";
import { useI18n } from "../i18n";

interface Props {
    product: CompareItem;
    variant?: "detail";
}

export default function CompareButton({ product, variant = "detail" }: Props) {
    const { has, toggle, isFull } = useCompare();
    const { t } = useI18n();
    const selected = has(product.id);
    const disabled = !selected && isFull;

    const title = selected ? t("compare.removeFrom") : disabled ? t("compare.full", { max: MAX_COMPARE }) : t("compare.add");

    return (
        <button
            type="button"
            className={`compare-btn compare-btn--${variant} ${selected ? "is-selected" : ""}`}
            aria-pressed={selected}
            disabled={disabled}
            title={title}
            onClick={(e) => {
                e.preventDefault();
                toggle(product);
            }}>
            <MdCompareArrows aria-hidden="true" />
            <span>{selected ? t("compare.selected") : t("compare.button")}</span>
        </button>
    );
}

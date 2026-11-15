import { MdCompareArrows } from "react-icons/md";
import { MAX_COMPARE, useCompare, type CompareItem } from "../context/compare";
import "../styles/Compare.css";

interface Props {
    product: CompareItem;
    variant?: "detail";
}

export default function CompareButton({ product, variant = "detail" }: Props) {
    const { has, toggle, isFull } = useCompare();
    const selected = has(product.id);
    const disabled = !selected && isFull;

    const title = selected
        ? "Отстрани од споредба"
        : disabled
          ? `Можете да споредите најмногу ${MAX_COMPARE} производи`
          : "Додај во споредба";

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
            <span>{selected ? "Во споредба" : "Спореди"}</span>
        </button>
    );
}

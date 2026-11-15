import "../styles/ProductList.css";
import { useI18n } from "../i18n";

export type SortOption =
    | "price-asc"
    | "price-desc"
    | "newest"
    | "popular"
    | "name-asc"
    | "name-desc"
    | "available-desc";

interface Props {
    value: SortOption;
    onChange: (v: SortOption) => void;
}

export default function SortBar({ value, onChange }: Props) {
    const { t } = useI18n();
    return (
        <label className="sort-wrapper">
            <select
                className="sort-select"
                value={value}
                onChange={(e) => onChange(e.target.value as SortOption)}
            >
                <option value="price-asc">{t("sort.priceAsc")}</option>
                <option value="price-desc">{t("sort.priceDesc")}</option>
                <option value="newest">{t("sort.newest")}</option>
                <option value="available-desc">{t("sort.available")}</option>
                <option value="name-asc">{t("sort.nameAsc")}</option>
                <option value="name-desc">{t("sort.nameDesc")}</option>
            </select>
        </label>
    );
}

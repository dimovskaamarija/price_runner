import "../styles/ProductList.css";

export type SortOption =
    | "price-asc"
    | "price-desc"
    | "newest"
    | "popular"
    | "name-asc"
    | "name-desc";

interface Props {
    value: SortOption;
    onChange: (v: SortOption) => void;
}

export default function SortBar({ value, onChange }: Props) {
    return (
        <label className="sort-wrapper">
            <select
                className="sort-select"
                value={value}
                onChange={(e) => onChange(e.target.value as SortOption)}
            >
                <option value="price-asc">Цена: од ниска кон висока</option>
                <option value="price-desc">Цена: од висока кон ниска</option>
                <option value="newest">Најнови</option>
                <option value="popular">Најбарани</option>
                <option value="name-asc">Име: растечки</option>
                <option value="name-desc">Име: опаѓачки</option>
            </select>
        </label>
    );
}

import React, { useEffect, useState, useMemo } from "react";
import "../styles/FiltersPanel.css";
import { IoMdArrowDropright, IoMdArrowDropdown } from "react-icons/io";
import { capitalizeBrand, capitalizeFirstLetter } from "../utils/formatting";

export type Filters = {
    category: string[];
    subcategory: string[];
    brand: string[];
    age: string[];
    gender: string[];
    color: string[];
    price: [number, number];
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    filters: Filters;
    setFilters: React.Dispatch<React.SetStateAction<Filters>>;
    filterOptions: {
        categories: string[];
        subcategories: string[];
        brands: string[];
        ages: string[];
        genders: string[];
        colors: string[];
    };
}

export default function FiltersPanel({ isOpen, onClose, filters, setFilters, filterOptions}: Props) {
    const [temp, setTemp] = useState(filters);
    const [openSection, setOpenSection] = useState<string | null>(null);

    const formattedFilterOptions = useMemo(() => ({
        ...filterOptions,
        brands: filterOptions.brands.map(b => capitalizeBrand(b)),
        colors: filterOptions.colors.map(c => capitalizeFirstLetter(c)),
    }), [filterOptions]);

    useEffect(() => {
        if (isOpen) setTemp(filters);
    }, [isOpen, filters]);

    type Keys = Exclude<keyof Filters, "price">;

    const toggle = (k: Keys, v: string) => {
        setTemp((p) => {
            const arr = p[k];
            const next = arr.includes(v)
                ? arr.filter((x) => x !== v)
                : [...arr, v];
            return { ...p, [k]: next };
        });
    };

    const min = (e: any) => {
        const val = Number(e.target.value);
        setTemp((p) => ({ ...p, price: [Math.min(val, p.price[1]), p.price[1]] }));
    };

    const max = (e: any) => {
        const val = Number(e.target.value);
        setTemp((p) => ({ ...p, price: [p.price[0], Math.max(val, p.price[0])] }));
    };

    const apply = () => {
        setFilters(temp);
        onClose();
    };

    const reset = () => {
        const r: Filters = {
            category: [],
            subcategory: [],
            brand: [],
            age: [],
            gender: [],
            color: [],
            price: [0, 20000],
        };
        setFilters(r);
        onClose();
    };

    const block = (key: Keys, title: string, values: string[], displayValues?: string[]) => {
        const display = displayValues || values;
        return (
            <div className="filters-section">
                <h4 onClick={() => setOpenSection(openSection === key ? null : key)}>
                    {title}
                    <span className="arrow">{openSection === key ? <IoMdArrowDropdown/> : <IoMdArrowDropright/>}</span>
                </h4>

                {openSection === key && (
                    <div className="filter-items">
                        {values.map((v, index) => (
                            <label key={v} className="checkbox-row">
                                <input type="checkbox" className="styled-checkbox" checked={temp[key].includes(v)} onChange={() => toggle(key, v)}/>
                                {display[index]}
                            </label>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`filters-overlay ${isOpen ? "open" : ""}`} onClick={onClose}>
            <div className="filters-panel" onClick={(e) => e.stopPropagation()}>
                <div className="filters-header">
                    <h3>Филтри</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {block("category", "Категорија", filterOptions.categories)}
                {block("subcategory", "Поткатегорија", filterOptions.subcategories)}
                {block("brand", "Бренд", filterOptions.brands, formattedFilterOptions.brands)}
                {block("age", "Возраст", filterOptions.ages)}
                {block("gender", "Пол", filterOptions.genders)}
                {block("color", "Боја", filterOptions.colors, formattedFilterOptions.colors)}

                <div className="filters-section">
                    <h4>
                        Цена
                        <span className="arrow"></span>
                    </h4>
                        <div className="price-slider">
                            <input type="range" min="0" max="20000" step="500" value={temp.price[0]} onChange={min} />
                            <input type="range" min="0" max="20000" step="500" value={temp.price[1]} onChange={max} />

                            <div
                                className="slider-track-active"
                                style={{left: `${(temp.price[0] / 20000) * 100}%`, right: `${100 - (temp.price[1] / 20000) * 100}%`}}/>

                            <div className="range-values">
                                <span>{temp.price[0]} ден</span>
                                <span>{temp.price[1]} ден</span>
                            </div>
                        </div>
                </div>

                <div className="filters-actions">
                    <button className="reset-btn same-size" onClick={reset}>Ресетирај</button>
                    <button className="apply-btn same-size" onClick={apply}>Примени</button>
                </div>
            </div>
        </div>
    );
}

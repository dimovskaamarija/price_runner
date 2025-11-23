import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import FiltersPanel from "../components/FiltersPanel";
import { getMinPrice } from "../utils/pricing";
import SortBar from "../components/SortBar";
import type { SortOption } from "../components/SortBar";
import { FaFilter, FaHeart, FaRegHeart } from "react-icons/fa";
import Spinner from "../components/Spinner";
import "../styles/ProductList.css";

export interface Product {
    id: string;
    name: string;
    image?: string;
    priceMap?: Record<string, number | null>;
    updatedAt?: string;
    popularity?: number;
}

type Filters = {
    category: string[];
    subcategory: string[];
    brand: string[];
    age: string[];
    gender: string[];
    color: string[];
    price: [number, number];
};

type FilterOptions = {
    categories: string[];
    subcategories: string[];
    brands: string[];
    ages: string[];
    genders: string[];
    colors: string[];
};

const PAGE_SIZE = 24;

export default function ProductList() {
    const navigate = useNavigate();
    const location = useLocation();
    const params = new URLSearchParams(location.search);

    const pageFromUrl = Math.max(parseInt(params.get("page") || "1", 10), 1);
    const sortFromUrl = (params.get("sort") as SortOption) || "price-asc";
    const searchFromUrl = params.get("search") || "";
    const categoryFromUrl = params.get("category") || "";
    const subcategoryFromUrl = params.get("subcategory") || "";
    const ageFromUrl = params.get("age") || "";
    const genderFromUrl = params.get("gender") || "";
    const brandFromUrl = params.get("brand") || "";

    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(pageFromUrl);
    const [sort, setSort] = useState<SortOption>(sortFromUrl);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState<Filters>({
        category: categoryFromUrl ? [categoryFromUrl] : [],
        subcategory: subcategoryFromUrl ? [subcategoryFromUrl] : [],
        age: ageFromUrl ? [ageFromUrl] : [],
        gender: genderFromUrl ? [genderFromUrl] : [],
        brand: brandFromUrl ? [brandFromUrl] : [],
        color: [],
        price: [
            Number(params.get("minPrice") || 0),
            Number(params.get("maxPrice") || 20000),
        ],
    });

    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        categories: [],
        subcategories: [],
        brands: [],
        ages: [],
        genders: [],
        colors: [],
    });

    useEffect(() => {
        const load = async () => {
            const r = await fetch("http://localhost:3000/products/filter-options");
            const d = await r.json();
            setFilterOptions(d);
        };
        load();
    }, []);

    useEffect(() => {
        setFilters(prev => ({
            ...prev,
            category: categoryFromUrl ? [categoryFromUrl] : [],
            subcategory: subcategoryFromUrl ? [subcategoryFromUrl] : [],
            age: ageFromUrl ? [ageFromUrl] : [],
            gender: genderFromUrl ? [genderFromUrl] : [],
            brand: brandFromUrl ? [brandFromUrl] : []
        }));
    }, [
        categoryFromUrl,
        subcategoryFromUrl,
        ageFromUrl,
        genderFromUrl,
        brandFromUrl
    ]);

    const prevFiltersSearchRef = useRef({ filters, searchFromUrl });
    
    useEffect(() => {
        const filtersChanged = JSON.stringify(prevFiltersSearchRef.current.filters) !== JSON.stringify(filters);
        const searchChanged = prevFiltersSearchRef.current.searchFromUrl !== searchFromUrl;
        
        if (filtersChanged || searchChanged) {
            if (currentPage !== 1) {
                setCurrentPage(1);
            }
            prevFiltersSearchRef.current = { filters, searchFromUrl };
        } else if (pageFromUrl !== currentPage) {
            setCurrentPage(pageFromUrl);
        }
    }, [pageFromUrl, filters, searchFromUrl, currentPage]);

    useEffect(() => {
        const q = new URLSearchParams();
        q.set("page", String(currentPage));
        q.set("sort", sort);

        if (searchFromUrl) q.set("search", searchFromUrl);

        Object.entries(filters).forEach(([k, v]) => {
            if (k !== "price" && Array.isArray(v) && v.length) {
                q.set(k, v.join(","));
            } else if (k !== "price") {
                q.delete(k);
            }
        });

        q.set("minPrice", String(filters.price[0]));
        q.set("maxPrice", String(filters.price[1]));

        const newSearch = q.toString();
        if (location.search !== `?${newSearch}` && location.search !== newSearch) {
            navigate({ search: newSearch }, { replace: true });
        }
    }, [currentPage, sort, filters, searchFromUrl, navigate]);

    useEffect(() => {
        let cancel = false;

        const load = async () => {
            setLoading(true);
            const p = new URLSearchParams();
            p.set("page", String(currentPage));
            p.set("sort", sort);

            if (searchFromUrl) p.set("search", searchFromUrl);

            Object.entries(filters).forEach(([k, v]) => {
                if (k !== "price" && Array.isArray(v) && v.length) {
                    p.set(k, v.join(","));
                }
            });

            p.set("minPrice", String(filters.price[0]));
            p.set("maxPrice", String(filters.price[1]));

            try {
                const r = await fetch(`http://localhost:3000/products?${p.toString()}`);
                const d = await r.json();
                if (cancel) return;
                setProducts(d.items || []);
                setTotal(d.total || 0);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (error) {
                console.error("Error loading products:", error);
                if (!cancel) {
                    setProducts([]);
                    setTotal(0);
                }
            } finally {
                if (!cancel) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => {
            cancel = true;
        };
    }, [currentPage, sort, filters, searchFromUrl]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const visiblePages = useMemo(() => {
        const max = 5;
        let s = Math.max(currentPage - 1, 1);
        if (s + max - 1 > totalPages) s = Math.max(totalPages - max + 1, 1);
        return Array.from({ length: Math.min(max, totalPages) }, (_, i) => s + i);
    }, [currentPage, totalPages]);

    const sortedProducts = useMemo(() => {
        const c = [...products];
        switch (sort) {
            case "price-asc":
                return c.sort(
                    (a, b) =>
                        (getMinPrice(a.priceMap) ?? Infinity) -
                        (getMinPrice(b.priceMap) ?? Infinity)
                );
            case "price-desc":
                return c.sort(
                    (a, b) =>
                        (getMinPrice(b.priceMap) ?? -Infinity) -
                        (getMinPrice(a.priceMap) ?? -Infinity)
                );
            case "name-asc":
                return c.sort((a, b) => a.name.localeCompare(b.name));
            case "name-desc":
                return c.sort((a, b) => b.name.localeCompare(a.name));
            case "newest":
                return c.sort(
                    (a, b) =>
                        new Date(b.updatedAt || 0).getTime() -
                        new Date(a.updatedAt || 0).getTime()
                );
            case "popular":
                return c.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
            default:
                return c;
        }
    }, [products, sort]);

    const hasActiveFilters = useMemo(() => {
        return (
            searchFromUrl ||
            filters.category.length > 0 ||
            filters.subcategory.length > 0 ||
            filters.brand.length > 0 ||
            filters.age.length > 0 ||
            filters.gender.length > 0 ||
            filters.color.length > 0 ||
            filters.price[0] > 0 ||
            filters.price[1] < 20000
        );
    }, [filters, searchFromUrl]);

    return (
        <div className="product-list-container">
            <div className="product-controls">
                <button className="filter-btn" onClick={() => setFiltersOpen(true)}>
                    <FaFilter className="icon" />
                    Филтри
                </button>

                <div className="controls-right">
                    {!loading && <div className="results-count">{total} производи</div>}
                    <SortBar value={sort} onChange={setSort} />
                </div>
            </div>

            {loading ? (
                <Spinner />
            ) : sortedProducts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <h2 className="empty-state-title">
                        {hasActiveFilters
                            ? "Нема продукти според избраните критериуми"
                            : "Нема продукти на оваа страна"}
                    </h2>
                    <p className="empty-state-message">
                        {hasActiveFilters
                            ? "Обидете се да ги промените филтрите или критериумите за пребарување."
                            : "Во моментов нема достапни производи."}
                    </p>
                    {hasActiveFilters && (
                        <button
                            className="empty-state-button"
                            onClick={() => {
                                setFilters({
                                    category: [],
                                    subcategory: [],
                                    brand: [],
                                    age: [],
                                    gender: [],
                                    color: [],
                                    price: [0, 20000],
                                });
                                navigate("/products");
                            }}>
                            Отстрани филтри
                        </button>
                    )}
                </div>
            ) : (
                <div className="product-grid">
                    {sortedProducts.map((p) => {
                        const mp = getMinPrice(p.priceMap);
                        const sc = Object.keys(p.priceMap || {}).length;

                        return (
                            <div className="product-card" key={p.id}>
                                <Link 
                                    to={`/product/${p.id}`} 
                                    state={{ from: location.pathname + location.search }}
                                    className="product-link">
                                    <div className="product-img-wrapper">
                                        <img
                                            src={p.image || ""}
                                            alt={p.name}
                                            referrerPolicy="no-referrer"
                                        />
                                    </div>

                                    <div className="product-info">
                                        <h3>{p.name}</h3>
                                        <p className="price">
                                            Од <span>{mp ? `${mp.toLocaleString()} ден` : "Нема цена"}</span>
                                        </p>
                                        <p className="stores">{sc} продавници</p>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && sortedProducts.length > 0 && (
                <div className="pagination">
                    {currentPage > 1 && (
                        <button
                            className="page-btn nav-btn"
                            onClick={() => setCurrentPage(currentPage - 1)}>
                            Претходна
                        </button>
                    )}

                    {visiblePages.map((p) => (
                        <button
                            key={p}
                            className={`page-btn ${p === currentPage ? "active" : ""}`}
                            onClick={() => setCurrentPage(p)}>
                            {p}
                        </button>
                    ))}

                    {currentPage < totalPages && (
                        <button
                            className="page-btn nav-btn"
                            onClick={() => setCurrentPage(currentPage + 1)}
                        >
                            Следна
                        </button>
                    )}
                </div>
            )}

            <FiltersPanel
                isOpen={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                filters={filters}
                setFilters={setFilters}
                filterOptions={filterOptions}/>
        </div>
    );
}

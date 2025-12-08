import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import FiltersPanel from "../components/FiltersPanel";
import { getMinPrice } from "../utils/pricing";
import SortBar from "../components/SortBar";
import type { SortOption } from "../components/SortBar";
import { FaFilter } from "react-icons/fa";
import Spinner from "../components/Spinner";
import { useProducts, useFilterOptions, type Product } from "../hooks/useProducts";
import "../styles/ProductList.css";

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

    const [currentPage, setCurrentPage] = useState(pageFromUrl);
    const [sort, setSort] = useState<SortOption>(sortFromUrl);
    const [filtersOpen, setFiltersOpen] = useState(false);

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

    const { data: filterOptionsData } = useFilterOptions();
    const filterOptions: FilterOptions = filterOptionsData || {
        categories: [],
        subcategories: [],
        brands: [],
        ages: [],
        genders: [],
        colors: [],
    };

    const isUpdatingUrlRef = useRef(false);
    const prevUrlSearchRef = useRef(location.search);

    useEffect(() => {
        if (isUpdatingUrlRef.current) {
            isUpdatingUrlRef.current = false;
            prevUrlSearchRef.current = location.search;
            return;
        }

        if (prevUrlSearchRef.current !== location.search) {
            if (pageFromUrl !== currentPage) {
                setCurrentPage(pageFromUrl);
            }
            if (sortFromUrl !== sort) {
                setSort(sortFromUrl);
            }
            setFilters(prev => ({
                ...prev,
                category: categoryFromUrl ? [categoryFromUrl] : [],
                subcategory: subcategoryFromUrl ? [subcategoryFromUrl] : [],
                age: ageFromUrl ? [ageFromUrl] : [],
                gender: genderFromUrl ? [genderFromUrl] : [],
                brand: brandFromUrl ? [brandFromUrl] : [],
                price: [
                    Number(params.get("minPrice") || 0),
                    Number(params.get("maxPrice") || 20000),
                ],
            }));
            prevUrlSearchRef.current = location.search;
        }
    }, [location.search, pageFromUrl, sortFromUrl, currentPage, sort, categoryFromUrl, subcategoryFromUrl, ageFromUrl, genderFromUrl, brandFromUrl, params]);

    const prevFiltersSearchRef = useRef(JSON.stringify({ filters, searchFromUrl }));
    useEffect(() => {
        const currentKey = JSON.stringify({ filters, searchFromUrl });
        if (prevFiltersSearchRef.current !== currentKey) {
            const prev = JSON.parse(prevFiltersSearchRef.current);
            const filtersChanged = JSON.stringify(prev.filters) !== JSON.stringify(filters);
            const searchChanged = prev.searchFromUrl !== searchFromUrl;
            
            if ((filtersChanged || searchChanged) && currentPage !== 1) {
                setCurrentPage(1);
            }
            prevFiltersSearchRef.current = currentKey;
        }
    }, [filters, searchFromUrl, currentPage]);

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
        const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
        
        if (currentSearch !== newSearch) {
            isUpdatingUrlRef.current = true;
            navigate({ search: newSearch }, { replace: true });
        }
    }, [currentPage, sort, filters, searchFromUrl, navigate]);

    const productFilters = useMemo(() => ({
        page: currentPage,
        sort,
        search: searchFromUrl || undefined,
        category: filters.category.length > 0 ? filters.category.join(",") : undefined,
        subcategory: filters.subcategory.length > 0 ? filters.subcategory.join(",") : undefined,
        brand: filters.brand.length > 0 ? filters.brand.join(",") : undefined,
        age: filters.age.length > 0 ? filters.age.join(",") : undefined,
        gender: filters.gender.length > 0 ? filters.gender.join(",") : undefined,
        color: filters.color.length > 0 ? filters.color.join(",") : undefined,
        minPrice: filters.price[0],
        maxPrice: filters.price[1],
    }), [currentPage, sort, filters, searchFromUrl]);

    const { data: productsData, isLoading: loading } = useProducts(productFilters);
    const products = productsData?.items || [];
    const total = productsData?.total || 0;

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentPage]);

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
                                            loading="lazy"
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

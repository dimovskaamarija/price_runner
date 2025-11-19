import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/NavigationBar.css";
import logo from "../assets/logo.svg";
import { FaSearch, FaHeart } from "react-icons/fa";
import type { NavData } from "../types/navData";
import type { User } from "../types/user";

interface Props {
    user: User | null;
}

export default function NavigationBar({ user }: Props) {
    const [query, setQuery] = useState("");
    const [hover, setHover] = useState<string | null>(null);
    const [navData, setNavData] = useState<NavData | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetch("http://localhost:3000/products/nav-data")
            .then((r) => r.json())
            .then((d: NavData) => setNavData(d));
    }, []);

    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    };

    const go = (params: Record<string, string>) => {
        const q = new URLSearchParams();
        q.set("page", "1");
        q.set("sort", "price-asc");
        Object.entries(params).forEach(([k, v]) => q.set(k, v));
        return `/products?${q.toString()}`;
    };

    const openMenu = (key: string) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setHover(key);
    };

    const closeMenu = () => {
        timeoutRef.current = window.setTimeout(() => setHover(null), 200);
    };

    const clickClose = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setHover(null);
    };

    const LOGIN_URL = "http://localhost:4000/auth/login";

    return (
        <div className="nav-container">
            <div className="nav-wrapper">
                <div className="nav-left">
                    <Link to="/" onClick={clickClose}>
                        <img src={logo} alt="logo" className="nav-logo" />
                    </Link>
                </div>

                <form className="nav-search-form" onSubmit={submitSearch}>
                    <FaSearch className="nav-search-icon" />
                    <input
                        type="text"
                        placeholder="Пребарувај производи..."
                        value={query}
                        onChange={(e) => {
                            const v = e.target.value;
                            setQuery(v);
                            if (v.trim() === "") navigate("/products");
                        }}
                    />
                </form>

                <div className="nav-right">
                    <FaHeart className="nav-fav" />

                    {!user && (
                        <>
                            <button
                                className="nav-login"
                                onClick={() => (window.location.href = LOGIN_URL)}
                            >
                                Најава
                            </button>

                            <button
                                className="nav-register"
                                onClick={() => (window.location.href = LOGIN_URL)}
                            >
                                Регистрација
                            </button>
                        </>
                    )}

                    {user && (
                        <>
                            <span className="nav-username">👋 {user.name}</span>

                           <button className="nav-logout"
                            onClick={() => {
                            window.location.href = "http://localhost:4000/auth/logout";
                            }}>Одјава</button>

                        </>
                    )}
                </div>
            </div>

            <div className="nav-wrapper-2">
                <div className="nav-elements">
                    <Link to={go({ sort: "newest" })} onClick={clickClose}>
                        НОВО
                    </Link>

                    <span onMouseEnter={() => openMenu("men")} onMouseLeave={closeMenu}>
                        МАЖИ
                    </span>

                    <span onMouseEnter={() => openMenu("women")} onMouseLeave={closeMenu}>
                        ЖЕНИ
                    </span>

                    <span onMouseEnter={() => openMenu("kids")} onMouseLeave={closeMenu}>
                        ДЕЦА
                    </span>

                    <span onMouseEnter={() => openMenu("equipment")} onMouseLeave={closeMenu}>
                        ОПРЕМА
                    </span>

                    <span onMouseEnter={() => openMenu("brands")} onMouseLeave={closeMenu}>
                        <Link to="/brands" onClick={clickClose}>
                            БРЕНДОВИ
                        </Link>
                    </span>
                </div>
            </div>

            {hover && navData && (
                <div
                    className="nav-submenu"
                    onMouseEnter={() => openMenu(hover)}
                    onMouseLeave={closeMenu}
                >
                    {hover === "men" && (
                        <div className="submenu-columns">
                            {Object.entries(navData.menu.men).map(([cat, subs]) => (
                                <div className="submenu-col" key={cat}>
                                    <Link
                                        className="submenu-title"
                                        to={go({
                                            gender: "Машки",
                                            age: "За возрасни",
                                            category: cat,
                                        })}
                                        onClick={clickClose}
                                    >
                                        {cat === "equipment" ? "Додатоци" : cat}
                                    </Link>

                                    {subs.map((s) => (
                                        <Link
                                            key={s}
                                            className="submenu-item"
                                            to={go({
                                                gender: "Машки",
                                                age: "За возрасни",
                                                category: cat,
                                                subcategory: s,
                                            })}
                                            onClick={clickClose}
                                        >
                                            {s}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {hover === "women" && (
                        <div className="submenu-columns">
                            {Object.entries(navData.menu.women).map(([cat, subs]) => (
                                <div className="submenu-col" key={cat}>
                                    <Link
                                        className="submenu-title"
                                        to={go({
                                            gender: "Женски",
                                            age: "За возрасни",
                                            category: cat,
                                        })}
                                        onClick={clickClose}
                                    >
                                        {cat === "equipment" ? "Додатоци" : cat}
                                    </Link>

                                    {subs.map((s) => (
                                        <Link
                                            key={s}
                                            className="submenu-item"
                                            to={go({
                                                gender: "Женски",
                                                age: "За возрасни",
                                                category: cat,
                                                subcategory: s,
                                            })}
                                            onClick={clickClose}
                                        >
                                            {s}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {hover === "kids" && (
                        <div className="submenu-columns">
                            {Object.entries(navData.menu.kids).map(([cat, subs]) => (
                                <div className="submenu-col" key={cat}>
                                    <Link
                                        className="submenu-title"
                                        to={go({ age: "За деца", category: cat })}
                                        onClick={clickClose}
                                    >
                                        {cat === "equipment" ? "Додатоци" : cat}
                                    </Link>

                                    {subs.map((s) => (
                                        <Link
                                            key={s}
                                            className="submenu-item"
                                            to={go({
                                                age: "За деца",
                                                category: cat,
                                                subcategory: s,
                                            })}
                                            onClick={clickClose}
                                        >
                                            {s}
                                        </Link>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    {hover === "equipment" && (
                        <div className="submenu-columns">
                            <div className="submenu-col">
                                <div className="submenu-title">Додатоци</div>
                                {navData.equipment.dodatoci.map((s) => (
                                    <Link
                                        key={s}
                                        className="submenu-item"
                                        to={go({ category: "Опрема", subcategory: s })}
                                        onClick={clickClose}
                                    >
                                        {s}
                                    </Link>
                                ))}
                            </div>

                            <div className="submenu-col">
                                <div className="submenu-title">Спортска опрема</div>
                                {navData.equipment.sports.map((s) => (
                                    <Link
                                        key={s}
                                        className="submenu-item"
                                        to={go({ category: "Опрема", subcategory: s })}
                                        onClick={clickClose}
                                    >
                                        {s}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {hover === "brands" && (
                        <div className="submenu-columns-brands">
                            <div className="brands-grid">
                                {navData.brands.top?.slice(0, 30).map((b) => (
                                    <button
                                        key={b.name}
                                        className="submenu-item brand-btn"
                                        onClick={() => {
                                            clickClose();
                                            navigate(go({ brand: b.name }));
                                        }}
                                    >
                                        {b.name}
                                    </button>
                                ))}

                                <button
                                    className="submenu-item all-brands-link"
                                    onClick={() => {
                                        clickClose();
                                        navigate("/brands");
                                    }}
                                >
                                    Сите брендови →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/NavigationBar.css";
import logo from "../assets/logo.svg";
import { FaSearch, FaHeart } from "react-icons/fa";

export default function NavigationBar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/products?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="nav-wrapper">
      <div className="nav-left">
        <img src={logo} alt="logo" className="nav-logo" />
      </div>

      <form className="nav-search-form" onSubmit={submitSearch}>
        <FaSearch className="nav-search-icon" />
              <input
                  type="text"
                  placeholder="Пребарувај производи..."
                  value={query}
                  onChange={(e) => {
                      const val = e.target.value;
                      setQuery(val);

                      if (val.trim() === "") {
                          navigate("/products");
                      }
                  }}
              />
      </form>

      <div className="nav-right">
        <FaHeart className="nav-fav" />
        <button className="nav-login">Најава</button>
        <button className="nav-register">Регистрација</button>
      </div>
    </div>
  );
}

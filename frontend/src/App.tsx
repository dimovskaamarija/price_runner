import { Routes, Route, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import NavigationBar from "./components/NavigationBar";
import Brands from "./pages/Brands";
import Favorites from "./pages/Favorites";
import { useUser } from "./hooks/useUser";
import AuthCallback from "./components/AuthCallback";

function App() {
    const { user, refreshUser } = useUser();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const authStatus = searchParams.get("auth");
        if (authStatus === "success") {
            refreshUser();
            navigate("/products", { replace: true });
        } else if (authStatus === "error") {
            navigate("/", { replace: true });
        }
    }, [searchParams, navigate, refreshUser]);

    return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
            <NavigationBar user={user} />

            <Routes>
                <Route path="/" element={<ProductList />} />
                <Route path="/products" element={<ProductList />} />
                <Route path="/brands" element={<Brands />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/callback" element={<AuthCallback />} />
                <Route path="/product/:id" element={<ProductDetail />} />
            </Routes>
        </div>
    );
}

export default App;

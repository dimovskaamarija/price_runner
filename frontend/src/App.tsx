import { Routes, Route, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import NavigationBar from "./components/NavigationBar";
import { useUser } from "./hooks/useUser";
import AuthCallback from "./components/AuthCallback";
import Spinner from "./components/Spinner";

const ProductList = lazy(() => import("./pages/ProductList"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Brands = lazy(() => import("./pages/Brands"));
const Favorites = lazy(() => import("./pages/Favorites"));

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

            <Suspense fallback={<Spinner />}>
                <Routes>
                    <Route path="/" element={<ProductList />} />
                    <Route path="/products" element={<ProductList />} />
                    <Route path="/brands" element={<Brands />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/callback" element={<AuthCallback />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                </Routes>
            </Suspense>
        </div>
    );
}

export default App;

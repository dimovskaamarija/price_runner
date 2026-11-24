import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import NavigationBar from "./components/NavigationBar";
import { useUser } from "./hooks/useUser";
import AuthCallback from "./components/AuthCallback";
import Spinner from "./components/Spinner";
import ShoppingAssistant from "./components/ShoppingAssistant";
import CompareTray from "./components/CompareTray";

const ProductList = lazy(() => import("./pages/ProductList"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Brands = lazy(() => import("./pages/Brands"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Compare = lazy(() => import("./pages/Compare"));
const StoreMap = lazy(() => import("./pages/StoreMap"));
const AlertAction = lazy(() => import("./pages/AlertAction"));
const MyAlerts = lazy(() => import("./pages/MyAlerts"));

function App() {
    const { user } = useUser();

    return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
            <NavigationBar user={user} />

            <Suspense fallback={<Spinner />}>
                <Routes>
                    <Route path="/" element={<ProductList />} />
                    <Route path="/products" element={<ProductList />} />
                    <Route path="/brands" element={<Brands />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/compare" element={<Compare />} />
                    <Route path="/stores" element={<StoreMap />} />
                    <Route path="/alerts" element={<MyAlerts />} />
                    <Route path="/alerts/confirm/:token" element={<AlertAction action="confirm" />} />
                    <Route path="/alerts/unsubscribe/:token" element={<AlertAction action="unsubscribe" />} />
                    <Route path="/callback" element={<AuthCallback />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                </Routes>
            </Suspense>

            <CompareTray />
            <ShoppingAssistant user={user} />
        </div>
    );
}

export default App;

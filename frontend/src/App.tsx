import { Routes, Route } from "react-router-dom";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import NavigationBar from "./components/NavigationBar";
import Brands from "./pages/Brands";
import { useUser } from "./hooks/useUser";

function App() {
    const { user } = useUser();
    return (
        <>
            <NavigationBar user= {user} />

            <Routes>
                <Route path="/products" element={<ProductList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/brands" element={<Brands />} />
            </Routes>
        </>
    );
}

export default App;

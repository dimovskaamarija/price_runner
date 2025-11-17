import { Routes, Route } from "react-router-dom";
import ProductList from "./pages/ProductList";
import ProductDetail from "./pages/ProductDetail";
import NavigationBar from "./components/NavigationBar";
import Brands from "./pages/Brands";

function App() {
    return (
        <>
            <NavigationBar />

            <Routes>
                <Route path="/products" element={<ProductList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/brands" element={<Brands />} />
            </Routes>
        </>
    );
}

export default App;

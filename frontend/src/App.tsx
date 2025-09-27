import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductList from './pages/productList';
import ProductDetail from './pages/ProductDetail';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<ProductList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
            </Routes>
        </Router>
    );
}

export default App;

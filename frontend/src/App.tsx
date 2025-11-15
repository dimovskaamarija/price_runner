import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import NavigationBar from './components/NavigationBar';

function App() {
    return (
        <>
            <NavigationBar />
            <Routes>
                <Route path="/products" element={<ProductList />} />
                <Route path="/product/:id" element={<ProductDetail />} />
            </Routes>
        </>
    );
}

export default App;

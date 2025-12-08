import { useNavigate } from 'react-router-dom';
import { FaHeart, FaTrash } from 'react-icons/fa';
import { useUser } from '../hooks/useUser';
import Spinner from '../components/Spinner';
import { useFavorites } from '../hooks/useFavorites';
import '../styles/Favorites.css';

export default function Favorites() {
    const { user } = useUser();
    const navigate = useNavigate();
    const { data: products = [], isLoading: loading, removeFavorite } = useFavorites(user);

    const getMinPrice = (priceMap?: Record<string, number | null>): number | null => {
        if (!priceMap) return null;
        const prices = Object.values(priceMap).filter((p): p is number => p !== null);
        return prices.length > 0 ? Math.min(...prices) : null;
    };

    if (loading) {
        return <Spinner />;
    }

    return (
        <div className="favorites-container">
            <div className="favorites-content">
                <h1 className="favorites-title">Омилени производи</h1>

                {products.length === 0 ? (
                    <div className="favorites-empty">
                        <FaHeart className="empty-heart-icon" />
                        <p>Немате омилени производи</p>
                        <button className="browse-button" onClick={() => navigate('/products')}>
                            Прегледај производи
                        </button>
                    </div>
                ) : (
                    <div className="favorites-grid">
                        {products.map((product) => {
                            const minPrice = getMinPrice(product.priceMap);
                            return (
                                <div key={product.id} className="favorite-card">
                                    <div
                                        className="favorite-image-container"
                                        onClick={() => navigate(`/product/${product.id}`)}>
                                        {product.image ? (
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="favorite-image"
                                                loading="lazy"/>
                                        ) : (
                                            <div className="favorite-image-placeholder">Нема слика</div>
                                        )}
                                    </div>
                                    <div className="favorite-info">
                                        <h3
                                            className="favorite-name"
                                            onClick={() => navigate(`/product/${product.id}`)}>
                                            {product.name}
                                        </h3>
                                        {minPrice && (
                                            <p className="favorite-price">
                                                {minPrice.toLocaleString()} ден
                                            </p>
                                        )}
                                        <button
                                            className="remove-favorite-btn"
                                            onClick={() => removeFavorite(product.id)}
                                            title="Отстрани од омилени">
                                            <FaTrash /> Отстрани
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
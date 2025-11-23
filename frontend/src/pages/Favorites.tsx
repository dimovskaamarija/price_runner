import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeart, FaTrash } from 'react-icons/fa';
import { useUser } from '../hooks/useUser';
import Spinner from '../components/Spinner';
import '../styles/Favorites.css';

interface Product {
    id: string;
    name: string;
    image?: string;
    priceMap?: Record<string, number | null>;
}

export default function Favorites() {
    const { user } = useUser();
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFavorites = async () => {
            setLoading(true);
            try {
                if (user) {
                    const response = await fetch('http://localhost:3000/favorites', {
                        credentials: 'include',
                    });
                    const data = await response.json();
                    setProducts(data);
                } else {
                    const favoriteIds = JSON.parse(localStorage.getItem('favorites') || '[]');

                    if (favoriteIds.length === 0) {
                        setProducts([]);
                        setLoading(false);
                        return;
                    }

                    const productPromises = favoriteIds.map(async (id: string) => {
                        try {
                            const response = await fetch(`http://localhost:3000/products/${id}`);
                            const data = await response.json();
                            return data;
                        } catch (error) {
                            console.error(`Error fetching product ${id}:`, error);
                            return null;
                        }
                    });

                    const fetchedProducts = await Promise.all(productPromises);
                    setProducts(fetchedProducts.filter((p): p is Product => p !== null));
                }
            } catch (error) {
                console.error('Error fetching favorites:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFavorites();
    }, [user]);

    const removeFavorite = async (productId: string) => {
        try {
            if (user) {
                await fetch(`http://localhost:3000/favorites/${productId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
            } else {
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                const updated = favorites.filter((id: string) => id !== productId);
                localStorage.setItem('favorites', JSON.stringify(updated));
            }

            setProducts(products.filter((p) => p.id !== productId));
        } catch (error) {
            console.error('Error removing favorite:', error);
        }
    };

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
                                                className="favorite-image"/>
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
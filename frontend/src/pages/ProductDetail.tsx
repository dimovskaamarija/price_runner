import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaExternalLinkAlt, FaHeart, FaRegHeart } from 'react-icons/fa';
import '../styles/ProductDetail.css';
import { IoArrowBackOutline } from 'react-icons/io5';
import PriceHistoryChart from '../components/PriceHistoryChart';
import Spinner from '../components/Spinner';
import { useUser } from '../hooks/useUser';

interface Product {
    id: string;
    name: string;
    brand?: string;
    gender?: string;
    age?: string;
    subcategory?: string;
    color?: string;
    image?: string;
    priceMap?: Record<string, number | null>;
    storeLinks?: Record<string, string>;
}

interface Store {
    id: string;
    name: string;
    logo_url?: string;
}

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUser();
    const [product, setProduct] = useState<Product | null>(null);
    const [stores, setStores] = useState<Store[]>([]);
    const [storesMap, setStoresMap] = useState<Record<string, Store | undefined>>({});
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        const fetchStores = async () => {
            const response = await fetch('http://localhost:3000/products/stores');
            const data = await response.json();
            setStores(data);

            const map: Record<string, Store | undefined> = {};
            data.forEach((s: Store) => {
                map[s.id] = s;
                map[s.id.toLowerCase()] = s;
                map[s.name] = s;
                map[s.name.toLowerCase()] = s;
            });
            setStoresMap(map);
        };

        fetchStores();
    }, []);

    useEffect(() => {
        if (!id) return;

        const fetchProduct = async () => {
            const response = await fetch(`http://localhost:3000/products/${id}`);
            const data = await response.json();
            if (!data.error) setProduct(data);
        };

        fetchProduct();
    }, [id]);

    useEffect(() => {
        if (!id) return;

        const checkFavorite = async () => {
            if (user) {
                try {
                    const response = await fetch(`http://localhost:3000/favorites/${id}`, {
                        credentials: 'include',
                    });
                    const data = await response.json();
                    setIsFavorite(data.isFavorite || false);
                } catch (error) {
                    console.error('Error checking favorite:', error);
                }
            } else {
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                setIsFavorite(favorites.includes(id));
            }
        };

        checkFavorite();
    }, [id, user]);

    const getStoreLogo = (storeName: string): string | undefined => {
        let store = storesMap[storeName] || storesMap[storeName.toLowerCase()];

        if (!store) {
            store = stores.find(
                (s) =>
                    s.name.toLowerCase().includes(storeName.toLowerCase()) ||
                    storeName.toLowerCase().includes(s.name.toLowerCase())
            );
        }

        return store?.logo_url;
    };

    const toggleFavorite = async () => {
        if (!id || !product) return;

        if (user) {
            try {
                if (isFavorite) {
                    await fetch(`http://localhost:3000/favorites/${id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                    });
                } else {
                    await fetch('http://localhost:3000/favorites', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            productId: id,
                        }),
                    });
                }
                setIsFavorite(!isFavorite);
            } catch (error) {
                console.error('Error toggling favorite:', error);
            }
        } else {
            const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            if (isFavorite) {
                const updated = favorites.filter((favId: string) => favId !== id);
                localStorage.setItem('favorites', JSON.stringify(updated));
            } else {
                favorites.push(id);
                localStorage.setItem('favorites', JSON.stringify(favorites));
            }
            setIsFavorite(!isFavorite);
        }
    };

    if (!product) return <Spinner />;

    const prices = Object.values(product.priceMap || {}).filter(
        (p): p is number => p !== null
    );
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;

    return (
        <div className="page-container">
            <div className="product-detail-columns">
                <div className="left-column">
                    <button
                        className="back-button"
                        onClick={() => {
                            if (location.state?.from) {
                                navigate(location.state.from);
                            } else {
                                if (window.history.length > 1) {
                                    navigate(-1);
                                } else {
                                    navigate('/products');
                                }
                            }
                        }}>
                        <IoArrowBackOutline />
                        Назад
                    </button>

                    <div className="product-left">
                        {product.image && (
                            <img
                                src={product.image}
                                alt={product.name}
                                className="product-image-big"/>
                        )}
                    </div>

                    <div className="seller-box">
                        <h3>Цени по продавници</h3>

                        <div className="seller-card">
                            <table className="store-table">
                                <thead>
                                    <tr>
                                        <th>Продавница</th>
                                        <th>Цена</th>
                                        <th>Акција</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {Object.entries(product.priceMap || {}).map(([store, price]) => {
                                        const logoUrl = getStoreLogo(store);
                                        const storeLink = product.storeLinks?.[store];
                                        const storeData = storesMap[store];

                                        return (
                                            <tr key={store}>
                                                <td>
                                                    <div className="store-info">
                                                        {logoUrl && (
                                                            <img src={logoUrl} className="store-logo" />
                                                        )}
                                                        <span>{storeData?.name || store}</span>
                                                    </div>
                                                </td>

                                                <td className="store-price">
                                                    {price ? `${price.toLocaleString()} ден` : 'N/A'}
                                                </td>

                                                <td>
                                                    {storeLink ? (
                                                        <a
                                                            href={storeLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="visit-btn white-btn"
                                                        >
                                                            <FaExternalLinkAlt /> Посети
                                                        </a>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="right-column">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                        <h1 className="product-title" style={{ margin: 0, flex: 1 }}>{product.name}</h1>
                        <button
                            onClick={toggleFavorite}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                marginRight: '150px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                color: isFavorite ? '#e91e63' : '#666',
                                transition: 'color 0.2s',
                            }}
                            title={isFavorite ? 'Отстрани од омилени' : 'Додај во омилени'}>
                            {isFavorite ? <FaHeart /> : <FaRegHeart />}
                        </button>
                    </div>

                    <div className="product-price-box">
                        <p className="product-price">
                            {lowestPrice ? `${lowestPrice.toLocaleString()} ден` : '—'}
                        </p>
                        <span className="price-label">Најниска цена</span>
                    </div>

                    <div className="spec-box">
                        <h2>Спецификации</h2>
                        <div className="spec-row">
                            <strong>Категорија</strong>
                            <span>{product.subcategory || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>Подкатегорија</strong>
                            <span>{product.age || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>Пол</strong>
                            <span>{product.gender || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>Возраст</strong>
                            <span>{product.age || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>Бренд</strong>
                            <span>{product.brand || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>Боја</strong>
                            <span>{product.color || '-'}</span>
                        </div>
                    </div>

                    <div className="price-history-chart">
                        <PriceHistoryChart productId={product.id} storesMap={storesMap} />
                    </div>
                </div>
            </div>
        </div>
    );
}

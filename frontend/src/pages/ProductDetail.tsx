import { useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaExternalLinkAlt, FaHeart, FaRegHeart } from 'react-icons/fa';
import '../styles/ProductDetail.css';
import { IoArrowBackOutline } from 'react-icons/io5';
import PriceHistoryChart from '../components/PriceHistoryChart';
import Spinner from '../components/Spinner';
import { useUser } from '../hooks/useUser';
import { useProduct } from '../hooks/useProducts';
import { useStores, type Store } from '../hooks/useStores';
import { useFavoriteStatus } from '../hooks/useFavorites';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { capitalizeBrand } from '../utils/formatting';

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUser();
    const queryClient = useQueryClient();

    const { data: product, isLoading: productLoading } = useProduct(id);
    const { data: stores = [] } = useStores();
    const { data: favoriteStatus } = useFavoriteStatus(id, user);
    const isFavorite = favoriteStatus?.isFavorite || false;

    const storesMap = useMemo(() => {
        const map: Record<string, Store | undefined> = {};
        stores.forEach((s) => {
            map[s.id] = s;
            map[s.id.toLowerCase()] = s;
            map[s.name] = s;
            map[s.name.toLowerCase()] = s;
        });
        return map;
    }, [stores]);

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

    const toggleFavoriteMutation = useMutation({
        mutationFn: async () => {
            if (!id) return;
            
            if (user) {
                if (isFavorite) {
                    return api.delete(`/favorites/${id}`);
                } else {
                    return api.post('/favorites', { productId: id });
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
                return { success: true };
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['favorite-status', id] });
            queryClient.invalidateQueries({ queryKey: ['favorites'] });
        },
    });

    const toggleFavorite = () => {
        if (!id || !product) return;
        toggleFavoriteMutation.mutate();
    };

    if (productLoading || !product) return <Spinner />;

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
                                className="product-image-big"
                                loading="lazy"/>
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
                            <span>{product.category || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>Поткатегорија</strong>
                            <span>{product.subcategory || '-'}</span>
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
                            <span>{product.brand ? capitalizeBrand(product.brand) : '-'}</span>
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

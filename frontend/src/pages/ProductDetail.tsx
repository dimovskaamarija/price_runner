import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FaExternalLinkAlt, FaHeart, FaRegHeart } from 'react-icons/fa';
import '../styles/ProductDetail.css';
import { IoArrowBackOutline } from 'react-icons/io5';
import PriceHistoryChart from '../components/PriceHistoryChart';
import Spinner from '../components/Spinner';
import { useUser } from '../hooks/useUser';
import { useProduct } from '../hooks/useProducts';
import { useStoreLookup } from '../hooks/useStoreLookup';
import CompareButton from '../components/CompareButton';
import { useI18n } from '../i18n';
import { useFavoriteStatus } from '../hooks/useFavorites';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL } from '../utils/api';
import { capitalizeBrand } from '../utils/formatting';

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t, tv, price } = useI18n();
    const { user } = useUser();
    const queryClient = useQueryClient();

    const { data: product, isLoading: productLoading } = useProduct(id);
    const { data: favoriteStatus } = useFavoriteStatus(id, user);
    const isFavorite = favoriteStatus?.isFavorite || false;

    const { storesMap, getStore } = useStoreLookup();
    const getStoreLogo = (storeName: string) => getStore(storeName)?.logo_url;

    const toggleFavoriteMutation = useMutation({
        mutationFn: async () => {
            if (!id) return;
            
            if (user) {
                if (isFavorite) {
                    const url = `${API_BASE_URL}/favorites/${id}`;
                    console.log(`[Favorites] DELETE request to: ${url} (authenticated user: ${user.id})`);
                    return api.delete(`/favorites/${id}`);
                } else {
                    const url = `${API_BASE_URL}/favorites`;
                    console.log(`[Favorites] POST request to: ${url} (authenticated user: ${user.id}, productId: ${id})`);
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
            queryClient.invalidateQueries({ queryKey: ['favorite-status', id, user?.id] });
            queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
        },
        onError: (error: any) => {
            console.error('Failed to toggle favorite:', error);
            let errorMessage = t('product.favoriteError');
            
            if (error?.message) {
                errorMessage = error.message;
                // Translate common error messages
                if (error.message.includes('User not authenticated') || error.message.includes('401')) {
                    errorMessage = t('product.favoriteLoginRequired');
                } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                    errorMessage = t('product.favoriteForbidden');
                } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
                    errorMessage = t('product.serverError');
                }
            }
            
            alert(errorMessage);
        },
    });

    const toggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!id || !product || toggleFavoriteMutation.isPending) return;
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
                        {t('common.back')}
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
                        <h3>{t("product.pricesByStore")}</h3>

                        <div className="seller-card">
                            <table className="store-table">
                                <thead>
                                    <tr>
                                        <th>{t("product.store")}</th>
                                        <th>{t("product.price")}</th>
                                        <th>{t("product.action")}</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {Object.entries(product.priceMap || {}).map(([store, storePrice]) => {
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
                                                    {price(storePrice)}
                                                </td>

                                                <td>
                                                    {storeLink ? (
                                                        <a
                                                            href={storeLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="visit-btn white-btn"
                                                        >
                                                            <FaExternalLinkAlt /> {t("common.visit")}
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
                        <CompareButton product={{ id: product.id, name: product.name, image: product.image }} variant="detail" />
                        <button
                            onClick={toggleFavorite}
                            disabled={toggleFavoriteMutation.isPending}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: toggleFavoriteMutation.isPending ? 'wait' : 'pointer',
                                padding: '8px',
                                marginLeft: 'auto',
                                marginRight: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                color: isFavorite ? '#e91e63' : '#666',
                                transition: 'color 0.2s',
                                opacity: toggleFavoriteMutation.isPending ? 0.6 : 1,
                            }}
                            title={isFavorite ? t('product.removeFavorite') : t('product.addFavorite')}>
                            {isFavorite ? <FaHeart /> : <FaRegHeart />}
                        </button>
                    </div>

                    <div className="product-price-box">
                        <p className="product-price">
                            {lowestPrice ? price(lowestPrice) : '—'}
                        </p>
                        <span className="price-label">{t("product.lowestPrice")}</span>
                    </div>

                    <div className="spec-box">
                        <h2>{t("specs.title")}</h2>
                        <div className="spec-row">
                            <strong>{t("specs.category")}</strong>
                            <span>{tv(product.category) || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>{t("specs.subcategory")}</strong>
                            <span>{tv(product.subcategory) || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>{t("specs.gender")}</strong>
                            <span>{tv(product.gender) || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>{t("specs.age")}</strong>
                            <span>{tv(product.age) || '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>{t("specs.brand")}</strong>
                            <span>{product.brand ? capitalizeBrand(product.brand) : '-'}</span>
                        </div>
                        <div className="spec-row">
                            <strong>{t("specs.color")}</strong>
                            <span>{tv(product.color) || '-'}</span>
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

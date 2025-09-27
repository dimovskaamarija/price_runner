import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  image?: string;
  priceMap?: Record<string, number | null>;
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const snap = await getDocs(collection(db, 'products'));
      const items = snap.docs.map((doc) => doc.data() as Product);
      setProducts(items);
    };
    fetchProducts();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Products</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 220px)', gap: 20 }}>
        {products.map((p) => {
          const prices = Object.values(p.priceMap || {}).filter((x) => x != null) as number[];
          const minPrice = prices.length > 0 ? Math.min(...prices) : null;

          return (
            <Link to={`/product/${p.id}`} key={p.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10 }}>
                <img src={p.image || ''} alt={p.name} style={{ width: '100%', height: 150, objectFit: 'contain' }} />
                <h3 style={{ fontSize: 16 }}>{p.name}</h3>
                <p style={{ fontWeight: 'bold' }}>
                  {minPrice ? `${minPrice} MKD` : 'No price'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

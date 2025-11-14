import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  brand?: string;
  gender?: string;
  age?: string;
  subcategory?: string;
  image?: string;
  priceMap?: Record<string, number | null>;
  storeLinks?: Record<string, string>;
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const response = await fetch(`http://localhost:3000/products/${id}`);
        const data = await response.json();
        if (data.error) {
          console.error(data.error);
        } else {
          setProduct(data as Product);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      }
    };
    fetchProduct();
  }, [id]);

  if (!product) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <Link to="/">⬅ Back</Link>
      <h1>{product.name}</h1>
      {product.image && (
        <img src={product.image} alt={product.name} style={{ width: 300, height: 300, objectFit: 'contain' }} />
      )}
      <p><b>Brand:</b> {product.brand}</p>
      <p><b>Gender:</b> {product.gender}</p>
      <p><b>Age:</b> {product.age}</p>
      <p><b>Subcategory:</b> {product.subcategory}</p>

      <h2>Prices</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Store</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Price</th>
            <th style={{ border: '1px solid #ddd', padding: 8 }}>Link</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(product.priceMap || {}).map(([store, price]) => (
            <tr key={store}>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{store}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>{price ? `${price} MKD` : 'N/A'}</td>
              <td style={{ border: '1px solid #ddd', padding: 8 }}>
                {product.storeLinks?.[store] ? (
                  <a href={product.storeLinks[store]} target="_blank" rel="noreferrer">View</a>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

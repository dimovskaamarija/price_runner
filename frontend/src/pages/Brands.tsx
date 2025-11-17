import { useNavData } from "../context/NavDataContext";
import { useNavigate } from "react-router-dom";
import "../styles/BrandsPage.css";

export default function BrandsPage() {
    const { navData, loading } = useNavData();
    const navigate = useNavigate();

    if (loading || !navData) return null;

    const letters = Object.keys(navData.brands.all).sort();

    const goToBrand = (b: string) => {
        const q = new URLSearchParams();
        q.set("brand", b);
        navigate(`/products?${q.toString()}`);
    };

    return (
        <div className="brands-wrapper">

           <div className="brands-title">Сите брендови</div>
            <div className="brands-az-bar">
                {letters.map((l) => (
                    <a key={l} href={`#sec-${l}`} className="brands-az-letter">
                        {l}
                    </a>
                ))}
            </div>

            <div className="brands-sections">
                {letters.map((l) => (
                    <div key={l} id={`sec-${l}`} className="brands-section">
                        <div className="brands-letter-title">{l}</div>

                        <div className="brands-grid">
                            {navData.brands.all[l].map((b: string) => (
                                <div
                                    key={b}
                                    className="brand-item"
                                    onClick={() => goToBrand(b)}
                                >
                                    {b}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
}

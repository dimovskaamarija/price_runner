import { useNavData } from "../hooks/useNavData";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import { capitalizeBrand } from "../utils/formatting";
import "../styles/BrandsPage.css";

export default function BrandsPage() {
    const { data: navData, isLoading: loading } = useNavData();
    const navigate = useNavigate();

    if (loading || !navData) return <Spinner />;

    const allKeys = Object.keys(navData.brands.all);
    const letterKeys = allKeys.filter(key => /^[A-Za-zА-Яа-я]$/.test(key));
    const numberKeys = allKeys.filter(key => /^[0-9]$/.test(key));
    
    const letters = letterKeys.sort();
    
    const numbersSection = numberKeys.length > 0 ? {
        key: '#',
        brands: numberKeys.flatMap(key => navData.brands.all[key])
    } : null;

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
                {numbersSection && (
                    <a href="#sec-#" className="brands-az-letter">
                        #
                    </a>
                )}
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
                                    {capitalizeBrand(b)}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                {numbersSection && (
                    <div id="sec-#" className="brands-section">
                        <div className="brands-letter-title">#</div>
                        <div className="brands-grid">
                            {numbersSection.brands.map((b: string) => (
                                <div
                                    key={b}
                                    className="brand-item"
                                    onClick={() => goToBrand(b)}
                                >
                                    {capitalizeBrand(b)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}

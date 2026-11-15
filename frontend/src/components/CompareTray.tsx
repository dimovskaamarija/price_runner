import { Link, useLocation } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { MAX_COMPARE, useCompare } from "../context/compare";
import "../styles/Compare.css";

/** Bottom bar listing products picked for comparison. Hidden on the compare page itself. */
export default function CompareTray() {
    const { items, remove, clear } = useCompare();
    const location = useLocation();

    if (!items.length || location.pathname.startsWith("/compare")) return null;

    return (
        <>
            <div className="compare-tray-spacer" aria-hidden="true" />
            <div className="compare-tray" role="region" aria-label="Споредба на производи">
                <div className="compare-tray__items">
                    {items.map((item) => (
                        <div className="compare-tray__item" key={item.id} title={item.name}>
                            {item.image ? (
                                <img src={item.image} alt={item.name} referrerPolicy="no-referrer" />
                            ) : (
                                <span className="compare-tray__placeholder">{item.name.slice(0, 2)}</span>
                            )}
                            <button
                                type="button"
                                className="compare-tray__remove"
                                aria-label={`Отстрани ${item.name}`}
                                onClick={() => remove(item.id)}>
                                <IoClose />
                            </button>
                        </div>
                    ))}
                    {Array.from({ length: MAX_COMPARE - items.length }, (_, i) => (
                        <div className="compare-tray__item compare-tray__item--empty" key={`empty-${i}`} aria-hidden="true" />
                    ))}
                </div>

                <div className="compare-tray__actions">
                    <button type="button" className="compare-tray__clear" onClick={clear}>
                        Исчисти
                    </button>
                    {items.length >= 2 ? (
                        <Link to="/compare" className="compare-tray__go">
                            Спореди ({items.length})
                        </Link>
                    ) : (
                        <span className="compare-tray__hint">Изберете уште еден производ</span>
                    )}
                </div>
            </div>
        </>
    );
}

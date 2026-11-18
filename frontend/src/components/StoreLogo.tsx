import { useState } from "react";
import { useStoreLookup } from "../hooks/useStoreLookup";
import { chainColor } from "../hooks/useStoreLocations";

/** Chain logo for a store name; falls back to the chain's coloured dot if there's no logo or it fails to load. */
export default function StoreLogo({ store }: { store: string }) {
    const { getStore } = useStoreLookup();
    const [failed, setFailed] = useState(false);
    const logo = getStore(store)?.logo_url;

    if (!logo || failed) {
        return <span className="store-dot" style={{ background: chainColor(store) }} aria-hidden="true" />;
    }
    return <img className="store-logo-badge" src={logo} alt="" aria-hidden="true" onError={() => setFailed(true)} />;
}

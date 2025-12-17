import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { tokenManager } from "../utils/api";

export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const authStatus = searchParams.get("auth");
        const token = searchParams.get("token");
        
        if (authStatus === "success" && token) {
            // Store the token in localStorage
            tokenManager.set(token);
            
            // Remove token from URL for security
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("token");
            window.history.replaceState({}, "", newUrl.toString());
            
            navigate("/products", { replace: true });
            window.location.reload();
        } else if (authStatus === "success") {
            // Success but no token - might be from old cookie-based flow
            navigate("/products", { replace: true });
            window.location.reload();
        } else if (authStatus === "error") {
            navigate("/", { replace: true });
        } else {
            navigate("/", { replace: true });
        }
    }, [navigate, searchParams]);

    return <div>Signing you in...</div>;
}

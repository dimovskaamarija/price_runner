import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const authStatus = searchParams.get("auth");
        const token = searchParams.get("token");
        
        if (authStatus === "success" && token) {
            // Store token in localStorage
            localStorage.setItem("auth_token", token);
            // Remove token from URL for security
            navigate("/products", { replace: true });
            window.location.reload();
        } else if (authStatus === "success") {
            // Fallback if no token (for backward compatibility)
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

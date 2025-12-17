import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const authStatus = searchParams.get("auth");
        
        if (authStatus === "success") {
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

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (!code) {
            navigate("/");
            return;
        }

        // Call backend
        fetch(`http://localhost:4000/auth/callback?code=${code}`, {
            credentials: "include",
        })
            .then(() => navigate("/products"))
            .catch(() => navigate("/"));
    }, []);

    return <div>Signing you in...</div>;
}

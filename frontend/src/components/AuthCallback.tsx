import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { tokenManager } from "../utils/api";
import { useQueryClient } from "@tanstack/react-query";

export default function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();

    useEffect(() => {
        const authStatus = searchParams.get("auth");
        const token = searchParams.get("token");
        
        console.log("🔐 AuthCallback - authStatus:", authStatus, "token:", token ? "present" : "missing");
        
        if (authStatus === "success" && token) {
            // Store the token in localStorage
            console.log("💾 Storing token in localStorage");
            tokenManager.set(token);
            
            // Remove token from URL for security
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("token");
            newUrl.searchParams.delete("auth");
            window.history.replaceState({}, "", newUrl.toString());
            
            // Invalidate and refetch user data
            queryClient.invalidateQueries({ queryKey: ['user'] });
            
            // Navigate to products page
            navigate("/products", { replace: true });
        } else if (authStatus === "success") {
            // Success but no token - check if we have a token in localStorage
            const existingToken = tokenManager.get();
            if (existingToken) {
                console.log("✅ Found existing token, refreshing user");
                queryClient.invalidateQueries({ queryKey: ['user'] });
                navigate("/products", { replace: true });
            } else {
                console.error("❌ No token in URL or localStorage");
                navigate("/", { replace: true });
            }
        } else if (authStatus === "error") {
            console.error("❌ Auth error");
            navigate("/", { replace: true });
        } else {
            // No auth status - might be direct navigation, check for existing token
            const existingToken = tokenManager.get();
            if (existingToken) {
                navigate("/products", { replace: true });
            } else {
                navigate("/", { replace: true });
            }
        }
    }, [navigate, searchParams, queryClient]);

    return <div>Signing you in...</div>;
}

import { Router } from "express";
import { pool } from "../services/db";
import { workos } from "../workos";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function normalizeUrl(input: string) {
    // Collapse accidental double slashes in the path (but keep https:// intact)
    return input.replace(/([^:]\/)\/+/g, "$1").replace(/\/$/, "");
}

function getRedirectUri() {
    const raw = process.env.WORKOS_REDIRECT_URI || "http://localhost:4000/auth/callback";
    return normalizeUrl(raw);
}

router.get("/login", (req, res) => {
    console.log("=== LOGIN REQUEST ===");
    console.log("Request URL:", req.url);
    console.log("Request method:", req.method);
    console.log("Request headers:", JSON.stringify(req.headers, null, 2));
    console.log("Query params:", JSON.stringify(req.query));
    
    try {
        if (!process.env.WORKOS_CLIENT_ID) {
            console.error("❌ WORKOS_CLIENT_ID is not configured");
            return res.status(500).json({ error: "WORKOS_CLIENT_ID is not configured" });
        }

        const redirectUri = getRedirectUri();
        console.log("🔗 Redirect URI:", redirectUri);
        console.log("🔑 Client ID:", process.env.WORKOS_CLIENT_ID);

        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: "authkit",
            redirectUri: redirectUri,
            clientId: process.env.WORKOS_CLIENT_ID,
            // Show the sign-in screen explicitly
            screenHint: "sign-in",
        });

        console.log("✅ Generated authorization URL:", authorizationUrl);
        console.log("🔄 Redirecting to WorkOS...");
        res.redirect(authorizationUrl);
    } catch (error: any) {
        console.error("❌ Login endpoint error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: "Failed to generate authorization URL" });
    }
});

// Sign-up should open the AuthKit sign-up screen
router.get("/sign-up", (req, res) => {
    console.log("=== SIGN-UP REQUEST ===");
    console.log("Request URL:", req.url);
    console.log("Request method:", req.method);
    console.log("Request headers:", JSON.stringify(req.headers, null, 2));
    console.log("Query params:", JSON.stringify(req.query));
    
    // Check if this is a redirect back from WorkOS (shouldn't happen, but prevent loop)
    const referer = req.headers.referer || '';
    if (referer.includes('workos.com') || referer.includes('authkit.app')) {
        console.warn("⚠️ Possible redirect loop detected - referer is from WorkOS:", referer);
        console.warn("⚠️ This suggests WorkOS is redirecting back to /sign-up instead of /auth/callback");
        console.warn("⚠️ Check WorkOS dashboard - redirect URI must be:", getRedirectUri());
        return res.status(500).json({ 
            error: "Redirect loop detected. Please check WorkOS redirect URI configuration.",
            expectedRedirectUri: getRedirectUri()
        });
    }
    
    try {
        if (!process.env.WORKOS_CLIENT_ID) {
            console.error("❌ WORKOS_CLIENT_ID is not configured");
            return res.status(500).json({ error: "WORKOS_CLIENT_ID is not configured" });
        }

        const redirectUri = getRedirectUri();
        console.log("🔗 Redirect URI:", redirectUri);
        console.log("🔑 Client ID:", process.env.WORKOS_CLIENT_ID);
        console.log("📝 Screen hint: sign-up");
        console.log("🌐 Frontend URL:", process.env.FRONTEND_URL);
        console.log("🔧 WORKOS_REDIRECT_URI env var:", process.env.WORKOS_REDIRECT_URI);

        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: "authkit",
            redirectUri: redirectUri,
            clientId: process.env.WORKOS_CLIENT_ID,
            screenHint: "sign-up",
        });

        console.log("✅ Generated authorization URL:", authorizationUrl);
        console.log("🔄 Redirecting to WorkOS sign-up...");
        console.log("📋 IMPORTANT: WorkOS must redirect back to:", redirectUri);
        res.redirect(authorizationUrl);
    } catch (error: any) {
        console.error("❌ Sign-up endpoint error:", error);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        res.status(500).json({ error: "Failed to generate authorization URL" });
    }
});

router.get("/callback", async (req, res) => {
    console.log("=== CALLBACK REQUEST ===");
    console.log("Request URL:", req.url);
    console.log("Request method:", req.method);
    console.log("Query params:", JSON.stringify(req.query));
    console.log("Request headers:", JSON.stringify(req.headers, null, 2));
    
    try {
        const code = req.query.code as string;
        const error = req.query.error as string;
        const errorDescription = req.query.error_description as string;

        if (error) {
            console.error("❌ WorkOS returned error:", error);
            console.error("Error description:", errorDescription);
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
            const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
            return res.redirect(`${cleanFrontendUrl}/callback?auth=error&error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            console.error("❌ Missing authorization code in callback");
            console.log("Available query params:", Object.keys(req.query));
            return res.status(400).json({ error: "Missing code" });
        }

        console.log("✅ Received authorization code:", code.substring(0, 20) + "...");
        console.log("🔑 Client ID:", process.env.WORKOS_CLIENT_ID);

        console.log("🔄 Authenticating with WorkOS...");
        const authenticateResponse = await workos.userManagement.authenticateWithCode({
            clientId: process.env.WORKOS_CLIENT_ID!,
            code,
        });

        console.log("✅ WorkOS authentication successful");
        const { user, sealedSession } = authenticateResponse;
        console.log("👤 User ID:", user.id);
        console.log("📧 User email:", user.email);
        console.log("👤 User name:", user.firstName);

        console.log("🔍 Checking database for user...");
        let result = await pool.query(
            "SELECT * FROM users WHERE authkit_id = $1",
            [user.id]
        );

        if (result.rows.length === 0) {
            console.log("➕ User not found, creating new user...");
            await pool.query(
                "INSERT INTO users (authkit_id, email, name) VALUES ($1, $2, $3)",
                [user.id, user.email, user.firstName]
            );

            result = await pool.query(
                "SELECT * FROM users WHERE authkit_id = $1",
                [user.id]
            );
            console.log("✅ User created with ID:", result.rows[0]?.id);
        } else {
            console.log("✅ User found in database with ID:", result.rows[0].id);
        }

        // Generate JWT token
        console.log("🔐 Generating JWT token...");
        const tokenPayload = {
            userId: result.rows[0].id,
            authkitId: user.id,
            email: user.email,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        } as any);
        console.log("✅ JWT token generated (length:", token.length, "characters)");

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        const redirectUrl = `${cleanFrontendUrl}/callback?auth=success&token=${encodeURIComponent(token)}`;
        
        console.log("🔄 Redirecting to frontend:", redirectUrl.replace(/token=[^&]+/, "token=***"));
        // Redirect to /callback route with token in URL (frontend will extract and store it)
        return res.redirect(redirectUrl);
    } catch (err: any) {
        console.error("❌ Auth callback error:", err);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        if (err.response) {
            console.error("Error response status:", err.response.status);
            console.error("Error response data:", err.response.data);
        }
        
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Ensure frontendUrl doesn't have trailing slash and is a valid URL
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        return res.redirect(`${cleanFrontendUrl}/callback?auth=error`);
    }
});

router.get("/me", async (req, res) => {
    console.log("=== /auth/me REQUEST ===");
    console.log("Request URL:", req.url);
    console.log("Request method:", req.method);
    console.log("Authorization header:", req.headers.authorization ? "present" : "MISSING");
    
    try {
        // Extract Bearer token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.log("❌ No Bearer token found in Authorization header");
            console.log("Available headers:", Object.keys(req.headers));
            return res.json(null);
        }

        const token = authHeader.substring(7); // Remove "Bearer " prefix
        console.log("✅ Bearer token extracted (length:", token.length, "characters)");

        try {
            // Verify and decode the JWT token
            console.log("🔐 Verifying JWT token...");
            const decoded = jwt.verify(token, JWT_SECRET) as {
                userId: number;
                authkitId: string;
                email: string;
            };
            console.log("✅ JWT token verified");
            console.log("👤 Decoded user ID:", decoded.userId);
            console.log("🔑 AuthKit ID:", decoded.authkitId);

            // Fetch user from database
            console.log("🔍 Fetching user from database...");
            let result = await pool.query(
                "SELECT * FROM users WHERE id = $1",
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                console.log("❌ User not found in database for ID:", decoded.userId);
                return res.json(null);
            }

            console.log("✅ User found:", result.rows[0].email);
            res.json(result.rows[0] || null);
        } catch (jwtError: any) {
            console.error("❌ JWT verification failed:", jwtError.message);
            console.error("JWT error name:", jwtError.name);
            if (jwtError.expiredAt) {
                console.error("Token expired at:", jwtError.expiredAt);
            }
            return res.json(null);
        }
    } catch (err: any) {
        console.error("❌ Get me error:", err);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        res.json(null);
    }
});

router.get("/logout", async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');

    // With bearer tokens, logout is handled on the frontend by removing the token
    // Just redirect to frontend
    res.redirect(cleanFrontendUrl);
});

export default router;

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
    try {
        if (!process.env.WORKOS_CLIENT_ID) {
            return res.status(500).json({ error: "WORKOS_CLIENT_ID is not configured" });
        }

        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: "authkit",
            redirectUri: getRedirectUri(),
            clientId: process.env.WORKOS_CLIENT_ID,
            // Show the sign-in screen explicitly
            screenHint: "sign-in",
        });

        res.redirect(authorizationUrl);
    } catch (error) {
        console.error("Login endpoint error:", error);
        res.status(500).json({ error: "Failed to generate authorization URL" });
    }
});

// Sign-up should open the AuthKit sign-up screen
router.get("/sign-up", (req, res) => {
    try {
        if (!process.env.WORKOS_CLIENT_ID) {
            return res.status(500).json({ error: "WORKOS_CLIENT_ID is not configured" });
        }

        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: "authkit",
            redirectUri: getRedirectUri(),
            clientId: process.env.WORKOS_CLIENT_ID,
            screenHint: "sign-up",
        });

        res.redirect(authorizationUrl);
    } catch (error) {
        console.error("Sign-up endpoint error:", error);
        res.status(500).json({ error: "Failed to generate authorization URL" });
    }
});

router.get("/callback", async (req, res) => {
    try {
        const code = req.query.code as string;

        if (!code) {
            return res.status(400).json({ error: "Missing code" });
        }

        const authenticateResponse = await workos.userManagement.authenticateWithCode({
            clientId: process.env.WORKOS_CLIENT_ID!,
            code,
        });

        const { user, sealedSession } = authenticateResponse;

        let result = await pool.query(
            "SELECT * FROM users WHERE authkit_id = $1",
            [user.id]
        );

        if (result.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (authkit_id, email, name) VALUES ($1, $2, $3)",
                [user.id, user.email, user.firstName]
            );

            result = await pool.query(
                "SELECT * FROM users WHERE authkit_id = $1",
                [user.id]
            );
        }

        // Generate JWT token
        const tokenPayload = {
            userId: result.rows[0].id,
            authkitId: user.id,
            email: user.email,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        } as any);

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        
        // Redirect to /callback route with token in URL (frontend will extract and store it)
        return res.redirect(`${cleanFrontendUrl}/callback?auth=success&token=${encodeURIComponent(token)}`);
    } catch (err) {
        console.error("Auth callback error:", err);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Ensure frontendUrl doesn't have trailing slash and is a valid URL
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        return res.redirect(`${cleanFrontendUrl}/callback?auth=error`);
    }
});

router.get("/me", async (req, res) => {
    try {
        // Extract Bearer token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.log("No Bearer token found in Authorization header");
            return res.json(null);
        }

        const token = authHeader.substring(7); // Remove "Bearer " prefix

        try {
            // Verify and decode the JWT token
            const decoded = jwt.verify(token, JWT_SECRET) as {
                userId: number;
                authkitId: string;
                email: string;
            };

            // Fetch user from database
            let result = await pool.query(
                "SELECT * FROM users WHERE id = $1",
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                console.log("User not found in database");
                return res.json(null);
            }

            res.json(result.rows[0] || null);
        } catch (jwtError: any) {
            console.log("JWT verification failed:", jwtError.message);
            return res.json(null);
        }
    } catch (err) {
        console.error("Get me error:", err);
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

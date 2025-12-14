import { Router } from "express";
import { pool } from "../services/db";
import { workos } from "../workos";
import jwt from "jsonwebtoken";

const router = Router();

router.get("/login", (req, res) => {
    try {
        if (!process.env.WORKOS_CLIENT_ID) {
            return res.status(500).json({ error: "WORKOS_CLIENT_ID is not configured" });
        }

        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: "authkit",
            redirectUri: (process.env.WORKOS_REDIRECT_URI || "http://localhost:4000/auth/callback").replace(/\/$/, ''),
            clientId: process.env.WORKOS_CLIENT_ID,
        });

        res.redirect(authorizationUrl);
    } catch (error) {
        console.error("Login endpoint error:", error);
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
            session: {
                sealSession: true,
                cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
            },
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

        const dbUser = result.rows[0];
        
        // Generate JWT token
        const tokenSecret = process.env.JWT_SECRET || process.env.WORKOS_COOKIE_PASSWORD || 'default-secret-change-in-production';
        const token = jwt.sign(
            {
                userId: dbUser.id,
                authkitId: user.id,
                email: user.email,
            },
            tokenSecret,
            { expiresIn: '7d' }
        );

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Ensure frontendUrl doesn't have trailing slash and is a valid URL
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        return res.redirect(`${cleanFrontendUrl}/?auth=success&token=${encodeURIComponent(token)}`);
    } catch (err) {
        console.error("Auth callback error:", err);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Ensure frontendUrl doesn't have trailing slash and is a valid URL
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        return res.redirect(`${cleanFrontendUrl}/?auth=error`);
    }
});

// Verify token endpoint
router.get("/verify", async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenSecret = process.env.JWT_SECRET || process.env.WORKOS_COOKIE_PASSWORD || 'default-secret-change-in-production';
        
        try {
            const decoded = jwt.verify(token, tokenSecret) as any;
            
            // Get user from database
            const result = await pool.query(
                "SELECT * FROM users WHERE id = $1",
                [decoded.userId]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'User not found' });
            }

            return res.json({ 
                user: result.rows[0],
                userId: decoded.userId,
                authkitId: decoded.authkitId 
            });
        } catch (err) {
            console.error("Token verification error:", err);
            return res.status(401).json({ error: 'Invalid token' });
        }
    } catch (err) {
        console.error("Verify error:", err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get("/me", async (req, res) => {
    try {
        // Try token first
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            const tokenSecret = process.env.JWT_SECRET || process.env.WORKOS_COOKIE_PASSWORD || 'default-secret-change-in-production';
            try {
                const decoded = jwt.verify(token, tokenSecret) as any;
                const result = await pool.query(
                    "SELECT * FROM users WHERE id = $1",
                    [decoded.userId]
                );

                if (result.rows.length > 0) {
                    return res.json(result.rows[0]);
                }
            } catch (err) {
                // Token invalid, fall through to cookie check
            }
        }

        // Fallback to cookie-based auth for backward compatibility
        const cookieValue = req.cookies["wos-session"];
        if (!cookieValue) {
            return res.json(null);
        }

        const session = workos.userManagement.loadSealedSession({
            sessionData: cookieValue,
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
        });

        const authResult = await session.authenticate();

        if (!authResult.authenticated) {
            return res.json(null);
        }

        const user = "user" in authResult ? authResult.user : null;
        
        if (!user) {
            return res.json(null);
        }

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

        res.json(result.rows[0] || null);
    } catch (err) {
        console.error("Get me error:", err);
        res.json(null);
    }
});

router.get("/logout", async (req, res) => {
    const isProduction = process.env.NODE_ENV === "production";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');

    try {
        // Try to get WorkOS logout URL, but don't rely on it
        const session = workos.userManagement.loadSealedSession({
            sessionData: req.cookies["wos-session"],
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
        });

        // Clear the cookie first with the same attributes used to set it
        res.clearCookie("wos-session", {
            path: "/",
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        // Redirect directly to frontend to avoid SSL/certificate issues
        // Don't use WorkOS logout URL as it might redirect to www or cause SSL errors
        res.redirect(cleanFrontendUrl);
    } catch (err) {
        console.error("Logout error:", err);
        // Even if there's an error, clear the cookie and redirect to frontend
        res.clearCookie("wos-session", {
            path: "/",
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        res.redirect(cleanFrontendUrl);
    }
});

export default router;

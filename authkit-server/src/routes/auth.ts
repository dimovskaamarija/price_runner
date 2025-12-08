import { Router } from "express";
import { pool } from "../services/db";
import { workos } from "../workos";

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

        res.cookie("wos-session", sealedSession, {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Ensure frontendUrl doesn't have trailing slash and is a valid URL
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        return res.redirect(`${cleanFrontendUrl}/?auth=success`);
    } catch (err) {
        console.error("Auth callback error:", err);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Ensure frontendUrl doesn't have trailing slash and is a valid URL
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        return res.redirect(`${cleanFrontendUrl}/?auth=error`);
    }
});

router.get("/me", async (req, res) => {
    try {
        const session = workos.userManagement.loadSealedSession({
            sessionData: req.cookies["wos-session"],
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
    try {
        const session = workos.userManagement.loadSealedSession({
            sessionData: req.cookies["wos-session"],
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
        });

        const url = await session.getLogoutUrl();

        res.clearCookie("wos-session", {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });

        res.redirect(url);
    } catch (err) {
        console.error("Logout error:", err);
        res.clearCookie("wos-session", {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Ensure frontendUrl doesn't have trailing slash and is a valid URL
        const cleanFrontendUrl = frontendUrl.replace(/\/$/, '');
        res.redirect(cleanFrontendUrl);
    }
});

export default router;

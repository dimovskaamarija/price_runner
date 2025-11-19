import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../services/db";
import { workos } from "../workos";

const router = Router();

// =========================
// AUTH → CALLBACK HANDLER
// =========================
router.get("/callback", async (req, res) => {
    try {
        const code = req.query.code as string;

        if (!code) {
            return res.status(400).json({ error: "Missing code" });
        }

        const { user } = await workos.userManagement.authenticateWithCode({
            clientId: process.env.WORKOS_CLIENT_ID!,
            code,
        });

        // Check if exists
        let result = await pool.query(
            "SELECT * FROM users WHERE authkit_id = $1",
            [user.id]
        );

        // Create if new
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

        // Sign session token
        const token = jwt.sign(
            { id: dbUser.id, email: dbUser.email },
            process.env.SESSION_SECRET!,
            { expiresIn: "7d" }
        );

res.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",       // <-- MUST MATCH LOGOUT
});


        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: "Auth failed", details: err });
    }
});

// =========================
// CURRENT USER
// =========================
router.get("/me", async (req, res) => {
    try {
        const token = req.cookies.session;
        if (!token) return res.json(null);

        const { id } = jwt.verify(
            token,
            process.env.SESSION_SECRET!
        ) as { id: number };

        const user = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
        res.json(user.rows[0] || null);
    } catch {
        res.json(null);
    }
});

// =========================
// LOGOUT
// =========================
router.post("/logout", (req, res) => {
    res.clearCookie("session", {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",           // <-- REQUIRED
    });

    res.json({ loggedOut: true });
});


export default router;

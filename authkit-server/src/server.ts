import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/auth";

const app = express();

app.use(express.json());
app.use(cookieParser());
// CORS configuration - allow localhost for dev and production URL from env
const allowedOrigins = [
    "http://localhost:5173",
    process.env.FRONTEND_URL || '',
].filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

const port = parseInt(process.env.PORT || "4000", 10);

app.use("/auth", authRouter);

app.get("/", (req, res) => {
    try {
        res.json({ 
            message: "Auth server is running", 
            routes: ["/auth/login", "/auth/callback", "/auth/me", "/auth/logout"],
            port: port,
            env: process.env.NODE_ENV || "development"
        });
    } catch (error) {
        console.error("Root route error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
app.listen(port, "0.0.0.0", () => {
    console.log(`Auth server running on http://0.0.0.0:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Database URL configured: ${process.env.DATABASE_URL ? "Yes" : "No"}`);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

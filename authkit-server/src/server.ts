import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/auth";

const app = express();

app.use(express.json());
app.use(cookieParser());
// CORS configuration - allow localhost for dev and production URL from env
const frontendUrl = process.env.FRONTEND_URL || "https://sporediikupi.up.railway.app";
const allowedOrigins = [
    "http://localhost:5173",
    frontendUrl,
    // Also allow www version (if Railway supports it)
    frontendUrl.includes('www.') ? frontendUrl.replace('www.', '') : frontendUrl.replace(/^https?:\/\//, 'https://www.'),
].filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

const port = parseInt(process.env.PORT || "4000", 10);

// Simple test route before auth routes
app.get("/test", (req, res) => {
    res.json({ message: "Test endpoint works", timestamp: new Date().toISOString() });
});

// Health check endpoint (before auth routes)
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Load auth routes (might fail if there are import errors)
try {
    app.use("/auth", authRouter);
} catch (error) {
    console.error("Failed to load auth routes:", error);
}

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

const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Auth server running on http://0.0.0.0:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Database URL configured: ${process.env.DATABASE_URL ? "Yes" : "No"}`);
    console.log(`Server listening on port: ${port}`);
});

// Handle server errors
server.on("error", (error: any) => {
    console.error("Server error:", error);
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use`);
    }
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

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

app.use("/auth", authRouter);

app.get("/", (req, res) => {
    res.json({ message: "Auth server is running", routes: ["/auth/login", "/auth/callback", "/auth/me", "/auth/logout"] });
});

const port = process.env.PORT || 4000;
app.listen(port, "0.0.0.0", () => {
    console.log(`Auth server running on http://0.0.0.0:${port}`);
});

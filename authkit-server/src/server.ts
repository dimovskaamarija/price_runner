import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/auth";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: ["http://localhost:5173"],
        credentials: true,
    })
);

app.use("/auth", authRouter);

app.get("/", (req, res) => {
    res.json({ message: "Auth server is running", routes: ["/auth/login", "/auth/callback", "/auth/me", "/auth/logout"] });
});

app.listen(4000, "0.0.0.0", () => {
    console.log("Auth server running on http://localhost:4000");
});

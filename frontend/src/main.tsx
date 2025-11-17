import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { NavDataProvider } from "./context/NavDataContext";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <NavDataProvider>
                <App />
            </NavDataProvider>
        </BrowserRouter>
    </StrictMode>
);

import { WorkOS } from "@workos-inc/node";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.WORKOS_API_KEY) {
    console.warn("WARNING: WORKOS_API_KEY is not set in environment variables");
}

if (!process.env.WORKOS_CLIENT_ID) {
    console.warn("WARNING: WORKOS_CLIENT_ID is not set in environment variables");
}

export const workos = new WorkOS(process.env.WORKOS_API_KEY || "", {
    clientId: process.env.WORKOS_CLIENT_ID || "",
});

import { useEffect, useState } from "react";
import type { User } from "../types/user";

export function useUser() {
    const [user, setUser] = useState<User | null>(null);

    const refreshUser = () => {
        fetch("http://localhost:4000/auth/me", {
            credentials: "include",
        })
            .then((r) => r.json())
            .then((u) => setUser(u));
    };

    useEffect(() => {
        refreshUser();
    }, []);

    return { user, refreshUser };
}

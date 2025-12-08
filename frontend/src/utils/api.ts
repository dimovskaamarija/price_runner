const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:4000';

export const api = {
    get: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },
    
    post: async <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
            credentials: 'include',
            body: data ? JSON.stringify(data) : undefined,
            ...options,
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },
    
    delete: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            credentials: 'include',
            ...options,
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },
    
    auth: {
        get: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
            const response = await fetch(`${AUTH_API_BASE_URL}${endpoint}`, {
                ...options,
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error(`Auth API error: ${response.statusText}`);
            }
            return response.json();
        },
    },
};

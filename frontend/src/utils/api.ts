export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:4000';

// Debug logging to verify environment variables
if (typeof window !== 'undefined') {
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const usingLocalhost = API_BASE_URL.includes('localhost') || AUTH_API_BASE_URL.includes('localhost');
    
    console.log('🔍 API Configuration:', {
        VITE_API_URL: import.meta.env.VITE_API_URL || 'NOT SET',
        VITE_AUTH_API_URL: import.meta.env.VITE_AUTH_API_URL || 'NOT SET',
        API_BASE_URL,
        AUTH_API_BASE_URL,
        isProduction,
        usingLocalhost,
    });
    
    if (isProduction && usingLocalhost) {
        console.error('❌ CRITICAL: Using localhost URLs in production!');
        console.error('❌ VITE_API_URL and VITE_AUTH_API_URL must be set in Railway BEFORE building!');
        console.error('❌ Set these variables in Railway frontend service, then trigger a rebuild.');
    }
}

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

import { API_BASE_URL, AUTH_API_BASE_URL } from '../config/env';

// Token management functions
const TOKEN_KEY = 'auth_token';

export const tokenManager = {
    get: (): string | null => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(TOKEN_KEY);
    },
    set: (token: string): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(TOKEN_KEY, token);
    },
    remove: (): void => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(TOKEN_KEY);
    },
};

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

async function handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = response.statusText || 'Unknown error';
    let errorDetails = '';
    
    try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            if (errorData.message) {
                errorMessage = errorData.message;
            } else if (errorData.error) {
                errorMessage = typeof errorData.error === 'string' ? errorData.error : errorData.error.message || errorData.error;
            }
            if (errorData.details) {
                errorDetails = ` Details: ${JSON.stringify(errorData.details)}`;
            }
        } else {
            const text = await response.text();
            if (text) {
                errorDetails = ` Response: ${text.substring(0, 200)}`;
            }
        }
    } catch (parseError) {
        // If we can't parse the error, use the status text
        console.error('Failed to parse error response:', parseError);
    }
    
    const fullError = new Error(`API error (${response.status}): ${errorMessage}${errorDetails}`);
    (fullError as any).status = response.status;
    (fullError as any).statusText = response.statusText;
    throw fullError;
}

// Helper function to get headers with Bearer token
const getHeaders = (customHeaders?: HeadersInit): Record<string, string> => {
    const token = tokenManager.get();
    
    // Convert HeadersInit to a plain object
    let headers: Record<string, string> = {};
    
    if (customHeaders) {
        if (customHeaders instanceof Headers) {
            // If it's a Headers object, convert to plain object
            customHeaders.forEach((value, key) => {
                headers[key] = value;
            });
        } else if (Array.isArray(customHeaders)) {
            // If it's an array of tuples, convert to object
            customHeaders.forEach(([key, value]) => {
                headers[key] = value;
            });
        } else {
            // If it's already a Record, use it directly
            headers = { ...customHeaders };
        }
    }
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        // Debug logging in development
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.log('🔑 Adding Bearer token to request');
        }
    } else {
        // Debug logging in development
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            console.warn('⚠️ No token found in localStorage');
        }
    }
    
    return headers;
};

export const api = {
    get: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: getHeaders(options?.headers),
        });
        if (!response.ok) {
            await handleErrorResponse(response);
        }
        return response.json();
    },
    
    post: async <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: getHeaders({
                'Content-Type': 'application/json',
                ...options?.headers,
            }),
            body: data ? JSON.stringify(data) : undefined,
            ...options,
        });
        if (!response.ok) {
            await handleErrorResponse(response);
        }
        return response.json();
    },
    
    delete: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: getHeaders(options?.headers),
            ...options,
        });
        if (!response.ok) {
            await handleErrorResponse(response);
        }
        return response.json();
    },
    
    auth: {
        get: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
            const response = await fetch(`${AUTH_API_BASE_URL}${endpoint}`, {
                ...options,
                headers: getHeaders(options?.headers),
            });
            if (!response.ok) {
                throw new Error(`Auth API error: ${response.statusText}`);
            }
            return response.json();
        },
    },
};

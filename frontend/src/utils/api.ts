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

export const api = {
    get: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            credentials: 'include',
        });
        if (!response.ok) {
            await handleErrorResponse(response);
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
            await handleErrorResponse(response);
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
            await handleErrorResponse(response);
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

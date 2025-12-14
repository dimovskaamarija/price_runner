import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AuthService {
    private readonly log = new Logger(AuthService.name);
    private readonly authkitUrl = process.env.AUTHKIT_URL || process.env.AUTH_API_URL || 'http://localhost:4000';

    async getCurrentUser(token?: string, cookies?: string): Promise<{ id: number; authkit_id: string } | null> {
        // Try token first (preferred method)
        if (token) {
            try {
                this.log.debug(`Calling authkit at ${this.authkitUrl}/auth/verify with token`);
                const response = await axios.get(`${this.authkitUrl}/auth/verify`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    validateStatus: (status) => status < 500, // Don't throw on 4xx
                });

                if (response.status === 200 && response.data && response.data.user) {
                    const user = response.data.user;
                    return { id: user.id, authkit_id: user.authkit_id };
                }

                this.log.debug(`Auth server returned status ${response.status} for token verification`);
            } catch (error: any) {
                this.log.warn(`Failed to verify token from authkit (${this.authkitUrl}):`, error.message);
            }
        }

        // Fallback to cookies for backward compatibility
        if (cookies && cookies.trim() !== '') {
            try {
                // Extract the wos-session cookie if present
                let cookieHeader = cookies;
                if (cookies.includes('wos-session')) {
                    cookieHeader = cookies;
                } else {
                    const wosSession = cookies.split(';').find(c => c.trim().startsWith('wos-session='));
                    if (wosSession) {
                        cookieHeader = wosSession.trim();
                    }
                }

                this.log.debug(`Calling authkit at ${this.authkitUrl}/auth/me with cookies`);

                const response = await axios.get(`${this.authkitUrl}/auth/me`, {
                    headers: {
                        Cookie: cookieHeader,
                    },
                    withCredentials: true,
                    validateStatus: (status) => status < 500, // Don't throw on 4xx
                });

                if (response.status === 200 && response.data && response.data.id) {
                    return response.data;
                }

                this.log.debug(`Auth server returned status ${response.status} or no user data`);
            } catch (error: any) {
                this.log.warn(`Failed to get current user from authkit (${this.authkitUrl}):`, error.message);
            }
        }

        return null;
    }
}
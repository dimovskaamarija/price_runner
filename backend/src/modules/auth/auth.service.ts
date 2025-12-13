import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AuthService {
    private readonly log = new Logger(AuthService.name);
    private readonly authkitUrl = process.env.AUTHKIT_URL || process.env.AUTH_API_URL || 'http://localhost:4000';

    async getCurrentUser(cookies: string): Promise<{ id: number; authkit_id: string } | null> {
        if (!cookies || cookies.trim() === '') {
            this.log.debug('No cookies provided');
            return null;
        }

        try {
            // Extract the wos-session cookie if present
            const cookieHeader = cookies.includes('wos-session') 
                ? cookies 
                : cookies.split(';').find(c => c.trim().startsWith('wos-session=')) || cookies;

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
            return null;
        } catch (error: any) {
            this.log.warn(`Failed to get current user from authkit (${this.authkitUrl}):`, error.message);
            if (error.response) {
                this.log.debug(`Response status: ${error.response.status}, data:`, error.response.data);
            }
            return null;
        }
    }
}
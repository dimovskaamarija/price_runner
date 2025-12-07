import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AuthService {
    private readonly log = new Logger(AuthService.name);
    private readonly authkitUrl = process.env.AUTHKIT_URL || 'http://localhost:4000';

    async getCurrentUser(cookies: string): Promise<{ id: number; authkit_id: string } | null> {
        try {
            const response = await axios.get(`${this.authkitUrl}/auth/me`, {
                headers: {
                    Cookie: cookies,
                },
                withCredentials: true,
            });

            return response.data;
        } catch (error: any) {
            this.log.warn('Failed to get current user from authkit:', error.message);
            return null;
        }
    }
}
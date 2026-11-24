import { Body, Controller, HttpCode, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { AssistantService, ChatTurn } from './assistant.service';

const AI_CALLS_PER_HOUR = 40;
const HOUR = 3_600_000;

@Controller('assistant')
export class AssistantController {
    private readonly recent = new Map<string, number[]>();

    constructor(
        private readonly assistant: AssistantService,
        private readonly auth: AuthService,
    ) {}

    @Post('chat')
    @HttpCode(200)
    async chat(@Req() req: Request, @Body() body: any) {
        const message = typeof body?.message === 'string' ? body.message.trim() : '';
        if (!message || message.length > 500) throw new HttpException('message must be 1-500 characters', HttpStatus.BAD_REQUEST);

        const history: ChatTurn[] = (Array.isArray(body.history) ? body.history : [])
            .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
            .slice(-8)
            .map((t: any) => ({ role: t.role, text: t.text.slice(0, 500) }));
        const favoriteIds: string[] = [
            ...new Set<string>((Array.isArray(body.favoriteIds) ? body.favoriteIds : []).filter((x: unknown) => typeof x === 'string')),
        ].slice(0, 50);

        const header = req.headers.authorization || '';
        const user = header.startsWith('Bearer ') ? await this.auth.getCurrentUser(header.slice(7)) : null;

        return this.assistant.chat({
            message,
            history,
            lang: body.lang === 'en' ? 'en' : 'mk',
            previous: body.previous,
            favoriteIds,
            userId: user?.id ?? null,
            allowAi: this.allowAi(req),
        });
    }

    /** Over the limit the chat keeps working with the rules parser; only the AI call is skipped. */
    private allowAi(req: Request): boolean {
        // Behind the hosting proxy req.ip is the proxy; the last forwarded entry is the one it added.
        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').pop()!.trim();
        const key = forwarded || req.ip || 'unknown';
        const now = Date.now();
        if (this.recent.size > 5000) {
            for (const [k, v] of this.recent) if (now - v[v.length - 1] > HOUR) this.recent.delete(k);
        }
        const hits = (this.recent.get(key) || []).filter((t) => now - t < HOUR);
        if (hits.length >= AI_CALLS_PER_HOUR) return false;
        hits.push(now);
        this.recent.set(key, hits);
        return true;
    }
}

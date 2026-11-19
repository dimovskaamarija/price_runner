import { Body, Controller, Delete, Get, HttpException, HttpStatus, Ip, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/users.entity';
import { AuthService } from '../auth/auth.service';
import { AlertsService, CreateAlertInput } from './alerts.service';

/** Simple per-IP limit on creating alerts (each guest alert sends a confirmation email). */
const CREATE_LIMIT_PER_HOUR = 20;

@Controller('alerts')
export class AlertsController {
    private readonly recent = new Map<string, number[]>();

    constructor(
        private readonly alerts: AlertsService,
        private readonly auth: AuthService,
        @InjectRepository(User) private readonly users: Repository<User>,
    ) {}

    /** Logged-in user (via Bearer token) or null for guests. */
    private async currentUser(req: Request): Promise<{ id: number; email: string } | null> {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        if (!token) return null;
        const u = await this.auth.getCurrentUser(token);
        if (!u) return null;
        const row = await this.users.findOne({ where: { id: u.id } });
        return row ? { id: row.id, email: row.email } : null;
    }

    private rateLimit(ip: string) {
        const now = Date.now();
        const hits = (this.recent.get(ip) || []).filter((t) => now - t < 3_600_000);
        if (hits.length >= CREATE_LIMIT_PER_HOUR) throw new HttpException('Too many alerts, try again later', HttpStatus.TOO_MANY_REQUESTS);
        hits.push(now);
        this.recent.set(ip, hits);
    }

    @Post()
    async create(@Req() req: Request, @Ip() ip: string, @Body() body: CreateAlertInput) {
        this.rateLimit(ip);
        return this.alerts.create(body, await this.currentUser(req));
    }

    @Get()
    async mine(@Req() req: Request) {
        const user = await this.currentUser(req);
        if (!user) throw new HttpException('Login required', HttpStatus.UNAUTHORIZED);
        return this.alerts.listForUser(user.id);
    }

    @Delete(':id')
    async remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
        const user = await this.currentUser(req);
        if (!user) throw new HttpException('Login required', HttpStatus.UNAUTHORIZED);
        return this.alerts.removeForUser(user.id, id);
    }

    /** Links from emails (no login needed; the token is the secret). */
    @Post('confirm/:token')
    confirm(@Param('token') token: string) {
        return this.alerts.confirm(token);
    }

    @Post('unsubscribe/:token')
    unsubscribe(@Param('token') token: string) {
        return this.alerts.unsubscribe(token);
    }
}

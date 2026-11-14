import 'dotenv/config'; // load .env before any module reads process.env at import time
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
    try {
        const app = await NestFactory.create(AppModule);

        app.use(compression()); // gzip JSON responses (product lists shrink ~5-8x)
        app.use(cookieParser());

        // CORS: localhost for dev + production frontend URL (with and without www).
        const frontendUrl = process.env.FRONTEND_URL || 'https://sporediikupi.up.railway.app';
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:4000',
            frontendUrl,
            frontendUrl.includes('www.') ? frontendUrl.replace('www.', '') : frontendUrl.replace(/^https?:\/\//, 'https://www.'),
        ];

        app.enableCors({
            origin: allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        });
        app.use((req, res, next) => (req.method === 'OPTIONS' ? res.sendStatus(200) : next()));

        const port = process.env.PORT || 3000;
        await app.listen(port);
        console.log(`Application is running on: http://0.0.0.0:${port}`);
    } catch (error) {
        console.error('Error starting application:', error);
        process.exit(1);
    }
}
bootstrap();

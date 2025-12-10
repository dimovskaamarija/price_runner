import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    try {
        console.log('Starting NestJS application...');
        const app = await NestFactory.create(AppModule);

    // CORS configuration - allow localhost for dev and production URL from env
    const frontendUrl = process.env.FRONTEND_URL || 'https://sporediikupi.up.railway.app';
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:4000',
      frontendUrl,
      // Also allow www version (if Railway supports it)
      frontendUrl.includes('www.') ? frontendUrl.replace('www.', '') : frontendUrl.replace(/^https?:\/\//, 'https://www.'),
    ].filter(Boolean);

        app.enableCors({
      origin: allowedOrigins,
            credentials: true,
        });

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Application is running on: http://0.0.0.0:${port}`);
    } catch (error) {
        console.error('Error starting application:', error);
        process.exit(1);
    }
}
bootstrap();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    try {
        console.log('Starting NestJS application...');
        const app = await NestFactory.create(AppModule);

        app.enableCors({
            origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4000'],
            credentials: true,
        });

        await app.listen(3000);
        console.log('Application is running on: http://localhost:3000');
    } catch (error) {
        console.error('Error starting application:', error);
        process.exit(1);
    }
}
bootstrap();
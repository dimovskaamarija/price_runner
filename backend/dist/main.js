"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    try {
        console.log('Starting NestJS application...');
        const app = await core_1.NestFactory.create(app_module_1.AppModule);
        console.log('NestJS application created successfully');
        await app.listen(3000);
        console.log('Application is running on: http://localhost:3000');
    }
    catch (error) {
        console.error('Error starting application:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map
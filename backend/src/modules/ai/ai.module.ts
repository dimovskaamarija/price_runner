import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { MlClient } from './ml.client';

@Module({
    providers: [GeminiService, MlClient],
    exports: [GeminiService, MlClient],
})
export class AiModule {}

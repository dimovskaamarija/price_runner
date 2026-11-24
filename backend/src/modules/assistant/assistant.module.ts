import { Module } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { CatalogModule } from '../catalog/catalog.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
    imports: [CatalogModule, FavoritesModule],
    providers: [AssistantService, AuthService],
    controllers: [AssistantController],
})
export class AssistantModule {}

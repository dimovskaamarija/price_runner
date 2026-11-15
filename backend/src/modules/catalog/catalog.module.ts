import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../database/entities/product.entity';
import { Offer } from '../../database/entities/offer.entity';
import { Store } from '../../database/entities/store.entity';
import { CategoryMapping } from '../../database/entities/category-mapping.entity';
import { AiModule } from '../ai/ai.module';
import { ClassifierService } from './classifier.service';
import { ClusteringService } from './clustering.service';
import { CatalogMaintenanceService } from './maintenance.service';
import { CatalogReadService } from './catalog-read.service';

/** Catalog domain: classification, clustering, maintenance and all public read queries. */
@Module({
    imports: [TypeOrmModule.forFeature([Product, Offer, Store, CategoryMapping]), AiModule],
    providers: [ClassifierService, ClusteringService, CatalogMaintenanceService, CatalogReadService],
    exports: [ClassifierService, ClusteringService, CatalogMaintenanceService, CatalogReadService, AiModule],
})
export class CatalogModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from './entities/product.entity';
import { Offer } from './entities/offer.entity';
import { PriceHistory } from './entities/price-history.entity';
import { CategoryMapping } from './entities/category-mapping.entity';
import { User } from './entities/users.entity';
import { Store } from './entities/store.entity';
import { Favorite } from './entities/favorite.entity';
import { StoreLocation } from './entities/store-location.entity';
import { PriceAlert } from './entities/price-alert.entity';
import { ProductsOffersV21763100000000 } from './migrations/1763100000000-ProductsOffersV2';
import { OfferFieldSources1763200000000 } from './migrations/1763200000000-OfferFieldSources';
import { ProductImageCheck1763300000000 } from './migrations/1763300000000-ProductImageCheck';
import { StoreLocations1763400000000 } from './migrations/1763400000000-StoreLocations';
import { OfferStoreLastSeenIndex1763500000000 } from './migrations/1763500000000-OfferStoreLastSeenIndex';
import { PriceAlerts1763600000000 } from './migrations/1763600000000-PriceAlerts';

/**
 * Schema is managed by migrations (run automatically on startup).
 * `synchronize` is off by default because it would drop/alter columns with data in them;
 * set DB_SYNCHRONIZE=true only on a throwaway local database.
 */
@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
            entities: [Product, Offer, PriceHistory, CategoryMapping, User, Store, Favorite, StoreLocation, PriceAlert],
            migrations: [ProductsOffersV21763100000000, OfferFieldSources1763200000000, ProductImageCheck1763300000000, StoreLocations1763400000000, OfferStoreLastSeenIndex1763500000000, PriceAlerts1763600000000],
            migrationsRun: true,
            synchronize: process.env.DB_SYNCHRONIZE === 'true',
            extra: {
                max: parseInt(process.env.DB_POOL_SIZE || '10', 10),
                idleTimeoutMillis: 30_000,
                connectionTimeoutMillis: 30_000,
            },
        }),
    ],
})
export class PostgresModule {}

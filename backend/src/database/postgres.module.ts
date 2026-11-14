import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from './entities/product.entity';
import { Offer } from './entities/offer.entity';
import { PriceHistory } from './entities/price-history.entity';
import { CategoryMapping } from './entities/category-mapping.entity';
import { User } from './entities/users.entity';
import { Store } from './entities/store.entity';
import { Favorite } from './entities/favorite.entity';
import { ProductsOffersV21763100000000 } from './migrations/1763100000000-ProductsOffersV2';
import { OfferFieldSources1763200000000 } from './migrations/1763200000000-OfferFieldSources';

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
            entities: [Product, Offer, PriceHistory, CategoryMapping, User, Store, Favorite],
            migrations: [ProductsOffersV21763100000000, OfferFieldSources1763200000000],
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

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PostgresService } from "./postgres.service";
import { Product } from "./entities/product.entity";
import { PriceHistory } from "./entities/price-history.entity";
import { User } from "./entities/users.entity";
import { Store } from "./entities/store.entity";
import { Favorite } from "./entities/favorite.entity";

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: "postgres",
            host: process.env.DB_HOST || "localhost",
            port: parseInt(process.env.DB_PORT || "5432", 10),
            username: process.env.DB_USERNAME || "postgres",
            password: process.env.DB_PASSWORD || "postgres",
            database: process.env.DB_DATABASE || "price_runner",
            entities: [Product, PriceHistory, User, Store, Favorite],
            synchronize: true,
        }),
        TypeOrmModule.forFeature([Product, PriceHistory, Store]),
    ],
    providers: [PostgresService],
    exports: [PostgresService],
})
export class PostgresModule {}

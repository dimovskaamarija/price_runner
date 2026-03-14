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
      url: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      entities: [Product, PriceHistory, User, Store, Favorite],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Product, PriceHistory, Store]),
  ],
  providers: [PostgresService],
  exports: [PostgresService],
})
export class PostgresModule {}

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

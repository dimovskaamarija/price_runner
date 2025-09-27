import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperModule } from './scraper/scraper.module';
import { FirestoreModule } from './firestore/firestore.module';

@Module({
    imports: [
        ScheduleModule.forRoot(), 
        ScraperModule,
        FirestoreModule
    ],
})
export class AppModule { }

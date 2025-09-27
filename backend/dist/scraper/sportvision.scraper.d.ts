import { FirestoreService } from '../firestore/firestore.service';
export declare class SportVisionScraper {
    private readonly db;
    private readonly log;
    private readonly limit;
    constructor(db: FirestoreService);
    scrapeCategory(baseUrl: string, topCategory: string): Promise<void>;
    private scrapePdp;
    private fetch;
}

import { SportVisionScraper } from './sportvision.scraper';
import { SportRealityScraper } from './sportreality.scraper';
import { BuzzScraper } from './buzz.scraper';
import { DsportScraper } from './dsport.scraper';
export declare class ScraperService {
    private readonly sportvision;
    private readonly sportreality;
    private readonly buzz;
    private readonly dsport;
    private readonly log;
    constructor(sportvision: SportVisionScraper, sportreality: SportRealityScraper, buzz: BuzzScraper, dsport: DsportScraper);
    runAll(): Promise<void>;
}

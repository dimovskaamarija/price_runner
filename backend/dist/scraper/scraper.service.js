"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ScraperService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sportvision_scraper_1 = require("./sportvision.scraper");
const sportreality_scraper_1 = require("./sportreality.scraper");
const buzz_scraper_1 = require("./buzz.scraper");
const dsport_scraper_1 = require("./dsport.scraper");
let ScraperService = ScraperService_1 = class ScraperService {
    constructor(sportvision, sportreality, buzz, dsport) {
        this.sportvision = sportvision;
        this.sportreality = sportreality;
        this.buzz = buzz;
        this.dsport = dsport;
        this.log = new common_1.Logger(ScraperService_1.name);
    }
    async runAll() {
        this.log.log('Starting SportVision scrape…');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/obuvki', 'Обувки');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/tekstil', 'Текстил');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/oprema', 'Опрема');
        this.log.log('Starting SportReality scrape…');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/obuvki', 'Обувки');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/tekstil', 'Текстил');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/oprema', 'Опрема');
        this.log.log('Starting Buzz Sneakers scrape…');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/obuvki', 'Обувки');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/tekstil', 'Текстил');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/oprema', 'Опрема');
        this.log.log('Starting D Sport scrape…');
        await this.dsport.scrapeCategory('https://www.dsport.mk/obuca', 'Обувки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/odeca', 'Текстил');
        await this.dsport.scrapeCategory('https://www.dsport.mk/oprema', 'Опрема');
        this.log.log('All scrapers finished ✅');
    }
};
exports.ScraperService = ScraperService;
__decorate([
    (0, schedule_1.Cron)('0 5 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ScraperService.prototype, "runAll", null);
exports.ScraperService = ScraperService = ScraperService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sportvision_scraper_1.SportVisionScraper,
        sportreality_scraper_1.SportRealityScraper,
        buzz_scraper_1.BuzzScraper,
        dsport_scraper_1.DsportScraper])
], ScraperService);
//# sourceMappingURL=scraper.service.js.map
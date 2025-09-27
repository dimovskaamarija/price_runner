"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperModule = void 0;
const common_1 = require("@nestjs/common");
const scraper_service_1 = require("./scraper.service");
const sportvision_scraper_1 = require("./sportvision.scraper");
const sportreality_scraper_1 = require("./sportreality.scraper");
const firestore_service_1 = require("../firestore/firestore.service");
const scraper_controller_1 = require("./scraper.controller");
const buzz_scraper_1 = require("./buzz.scraper");
const dsport_scraper_1 = require("./dsport.scraper");
let ScraperModule = class ScraperModule {
};
exports.ScraperModule = ScraperModule;
exports.ScraperModule = ScraperModule = __decorate([
    (0, common_1.Module)({
        providers: [scraper_service_1.ScraperService, sportvision_scraper_1.SportVisionScraper, sportreality_scraper_1.SportRealityScraper, firestore_service_1.FirestoreService, buzz_scraper_1.BuzzScraper, dsport_scraper_1.DsportScraper],
        controllers: [scraper_controller_1.ScraperController],
    })
], ScraperModule);
//# sourceMappingURL=scraper.module.js.map
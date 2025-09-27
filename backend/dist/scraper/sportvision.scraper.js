"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SportVisionScraper_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SportVisionScraper = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const p_limit_1 = __importDefault(require("p-limit"));
const dayjs_1 = __importDefault(require("dayjs"));
const common_1 = require("@nestjs/common");
const firestore_service_1 = require("../firestore/firestore.service");
const hashing_1 = require("../common/hashing");
const STORE = 'Sport Vision MK';
const PDP_RE = /\/mk\/(obuvki|tekstil|oprema)\/\d+-[a-z0-9-]+$/;
let SportVisionScraper = SportVisionScraper_1 = class SportVisionScraper {
    constructor(db) {
        this.db = db;
        this.log = new common_1.Logger(SportVisionScraper_1.name);
        this.limit = (0, p_limit_1.default)(4);
    }
    async scrapeCategory(baseUrl, topCategory) {
        for (let page = 1; page <= 3; page++) {
            const url = page === 1 ? baseUrl : `${baseUrl}/page-${page}`;
            const html = await this.fetch(url);
            if (!html)
                break;
            const $ = cheerio.load(html);
            const pdps = new Set();
            $('a[href]').each((_, a) => {
                const href = $(a).attr('href');
                if (PDP_RE.test(href))
                    pdps.add(new URL(href, baseUrl).toString());
            });
            if (pdps.size === 0) {
                this.log.log(`No products on page ${page}, stopping.`);
                break;
            }
            this.log.log(`Page ${page}: ${pdps.size} products`);
            await Promise.all([...pdps].map((href) => this.limit(() => this.scrapePdp(href, topCategory))));
        }
    }
    async scrapePdp(productUrl, topCategory) {
        const html = await this.fetch(productUrl);
        if (!html)
            return;
        const $ = cheerio.load(html);
        const name = ($('h1').first().text() || '').trim();
        let image = null;
        $('img').each((_, img) => {
            const src = $(img).attr('data-original-img') ||
                $(img).attr('data-src') ||
                $(img).attr('src');
            if (src && !image && !src.includes('logo')) {
                image = src.startsWith('http')
                    ? src
                    : new URL(src, productUrl).toString();
            }
        });
        const specs = {};
        $('table tr').each((_, row) => {
            const key = $(row).find('td').eq(0).text().trim();
            const val = $(row).find('td').eq(1).text().trim();
            if (key && val)
                specs[key] = val;
        });
        const subcategory = specs['Категорија'] || topCategory;
        const gender = specs['Пол'] || 'Unknown';
        const age = specs['Возраст'] || 'Unknown';
        const brand = specs['Бренд'] || guessBrandFromPage($);
        const color = specs['Боја'] || 'Unknown';
        const priceMKD = extractFirstPriceMKD($('body').text());
        const uniqueKey = `${name}::${brand}::${color}::${gender}::${age}`;
        const id = (0, hashing_1.createId)(uniqueKey);
        const now = (0, dayjs_1.default)();
        const doc = {
            id,
            name,
            brand,
            category: topCategory,
            subcategory,
            gender,
            age,
            color,
            image: image || null,
            priceMap: { [STORE]: priceMKD ?? null },
            storeLinks: { [STORE]: productUrl },
            productUrl,
            currency: 'MKD',
            createdAt: now.toDate(),
            updatedAt: now.toDate(),
        };
        await this.db.upsertProduct(doc);
    }
    async fetch(url) {
        try {
            const res = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)',
                    'Accept-Language': 'mk,en;q=0.8',
                },
                timeout: 25000,
            });
            return res.data;
        }
        catch (e) {
            this.log.warn(`Fetch failed: ${url} -> ${e.message}`);
            return null;
        }
    }
};
exports.SportVisionScraper = SportVisionScraper;
exports.SportVisionScraper = SportVisionScraper = SportVisionScraper_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [firestore_service_1.FirestoreService])
], SportVisionScraper);
function extractFirstPriceMKD(text) {
    const m = text.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*MKD/);
    if (!m)
        return null;
    const normalized = m[1].replace(/[.\s]/g, '');
    return parseInt(normalized, 10);
}
function guessBrandFromPage($) {
    const t = $('body').text();
    const m = t.match(/Бренд\s+([\p{L}A-Za-z0-9&\-\s]+)/u);
    if (m)
        return m[1].trim();
    const h1 = ($('h1').first().text() || '').trim();
    const first = h1.split(/\s+/)[0];
    return first.length > 1 ? first : 'Unknown';
}
//# sourceMappingURL=sportvision.scraper.js.map
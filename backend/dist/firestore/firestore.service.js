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
var FirestoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreService = void 0;
const common_1 = require("@nestjs/common");
const firestore_1 = require("@google-cloud/firestore");
let FirestoreService = FirestoreService_1 = class FirestoreService {
    constructor() {
        this.log = new common_1.Logger(FirestoreService_1.name);
        this.firestore = new firestore_1.Firestore({
            projectId: 'price-runner-88b3f',
            keyFilename: './serviceAccountKey.json',
        });
    }
    async upsertProduct(doc) {
        const ref = this.firestore.collection('products').doc(doc.id);
        const snapshot = await ref.get();
        if (snapshot.exists) {
            const existing = snapshot.data() || {};
            await ref.update({
                ...doc,
                priceMap: { ...(existing['priceMap'] || {}), ...doc.priceMap },
                storeLinks: { ...(existing['storeLinks'] || {}), ...doc.storeLinks },
                updatedAt: new Date(),
            });
            this.log.log(`Updated product ${doc.name} (${doc.id})`);
        }
        else {
            await ref.set(doc);
            this.log.log(`Created new product ${doc.name} (${doc.id})`);
        }
    }
};
exports.FirestoreService = FirestoreService;
exports.FirestoreService = FirestoreService = FirestoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], FirestoreService);
//# sourceMappingURL=firestore.service.js.map
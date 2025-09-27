import { Injectable, Logger } from '@nestjs/common';
import { Firestore } from '@google-cloud/firestore';

@Injectable()
export class FirestoreService {
    private readonly log = new Logger(FirestoreService.name);
    private readonly firestore: Firestore;

    constructor() {
        this.firestore = new Firestore({
            projectId: 'price-runner-88b3f',
            keyFilename: './serviceAccountKey.json',
        });
    }

    async upsertProduct(doc: any) {
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
        } else {
            await ref.set(doc);
            this.log.log(`Created new product ${doc.name} (${doc.id})`);
        }
    }
}

import { FirestoreService } from './firestore/firestore.service';
export declare class AppController {
    private readonly firebaseService;
    constructor(firebaseService: FirestoreService);
    getHello(): string;
}

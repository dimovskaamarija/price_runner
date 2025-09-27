import { Module } from '@nestjs/common';
import { FirestoreService } from './firestore.service';

@Module({
    providers: [FirestoreService],
    exports: [FirestoreService],  // 👈 needed so other modules see it
})
export class FirestoreModule { }

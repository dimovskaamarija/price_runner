import { Controller, Get } from '@nestjs/common';
import { FirestoreService } from './firestore/firestore.service';

@Controller()
export class AppController {
  constructor(private readonly firebaseService: FirestoreService) {}

  @Get()
  getHello(): string {
    return 'Hello World!';
  }
}

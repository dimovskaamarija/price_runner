import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceAlert } from '../../database/entities/price-alert.entity';
import { User } from '../../database/entities/users.entity';
import { AuthService } from '../auth/auth.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { MailService } from './mail.service';

@Module({
    imports: [TypeOrmModule.forFeature([PriceAlert, User])],
    providers: [AlertsService, MailService, AuthService],
    controllers: [AlertsController],
    exports: [AlertsService],
})
export class AlertsModule {}

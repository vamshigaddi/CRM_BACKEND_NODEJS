import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { DealsModule } from './deals/deals.module';
import { TasksModule } from './tasks/tasks.module';
import { ActivitiesModule } from './activities/activities.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { CommonModule } from './common/common.module';
import { MulterModule } from '@nestjs/platform-express';
import { IntegrationsModule } from './integrations/integrations.module';
import { TemplatesModule } from './templates/templates.module';
import { TelephonyModule } from './telephony/telephony.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.url'),
        dbName: configService.get<string>('mongodb.dbName'),
      }),
      inject: [ConfigService],
    }),
    CommonModule,
    TenantsModule,
    UsersModule,
    AuthModule,
    LeadsModule,
    DealsModule,
    TasksModule,
    ActivitiesModule,
    DashboardModule,
    WhatsappModule,
    IntegrationsModule,
    TemplatesModule,
    TelephonyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

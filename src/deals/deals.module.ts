import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitiesModule } from '../activities/activities.module';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { Deal, DealSchema } from './schemas/deal.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Deal.name, schema: DealSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    ActivitiesModule
  ],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService, MongooseModule, ActivitiesModule],
})
export class DealsModule {}

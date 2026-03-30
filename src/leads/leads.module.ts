import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { Lead, LeadSchema } from './schemas/lead.schema';
import { LeadScoringService } from './services/lead-scoring.service';
import { LeadAssignmentService } from './services/lead-assignment.service';
import { BulkUploadService } from './services/bulk-upload.service';
import { UsersModule } from '../users/users.module';
import { ActivitiesModule } from '../activities/activities.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { Deal, DealSchema } from '../deals/schemas/deal.schema';
import { Tenant, TenantSchema } from '../tenants/schemas/tenant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: Deal.name, schema: DealSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,
    ActivitiesModule,
    IntegrationsModule,
  ],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    LeadScoringService,
    LeadAssignmentService,
    BulkUploadService,
  ],
  exports: [LeadsService, MongooseModule],
})
export class LeadsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MasterTemplate, MasterTemplateSchema } from './schemas/master-template.schema';
import { TenantTemplate, TenantTemplateSchema } from './schemas/tenant-template.schema';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MasterTemplate.name, schema: MasterTemplateSchema },
      { name: TenantTemplate.name, schema: TenantTemplateSchema },
    ]),
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}

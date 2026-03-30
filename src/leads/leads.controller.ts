import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeadStatus } from './schemas/lead.schema';
import { BulkUploadService } from './services/bulk-upload.service';
import { CreateLeadDto, UpdateLeadDto } from './dto/create-lead.dto';
import type { Response } from 'express';

@Controller('api/v1/leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(
    private leadsService: LeadsService,
    private bulkUploadService: BulkUploadService,
  ) {}

  @Post()
  async create(@Body() leadData: CreateLeadDto, @CurrentUser() user: any) {
    return this.leadsService.create(leadData, user.tenantId, user._id, user.role);
  }

  /** Download a pre-filled sample Excel template */
  @Get('sample-template')
  async downloadSampleTemplate(@Res() res: Response) {
    const buffer = this.bulkUploadService.generateSampleTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="leads_import_template.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** Bulk import leads from uploaded Excel / CSV */
  @Post('bulk')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUpload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    return this.bulkUploadService.processBulkLeads(
      file.buffer,
      file.mimetype,
      user.tenantId,
      user._id,
    );
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: LeadStatus,
    @Query('assignedToMe') assignedToMe?: string,
    @Query('search') search?: string,
  ) {
    return this.leadsService.findAll(
      user.tenantId,
      Number(skip) || 0,
      Number(limit) || 100,
      status,
      assignedToMe === 'true',
      user._id,
      search,
      user.role,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.findOne(id, user.tenantId, user._id, user.role);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateLeadDto, @CurrentUser() user: any) {
    return this.leadsService.update(id, updateData, user.tenantId, user._id, user.role);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leadsService.remove(id, user.tenantId, user._id, user.role);
  }
}

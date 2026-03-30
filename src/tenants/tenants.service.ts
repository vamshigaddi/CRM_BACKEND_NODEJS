import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createTenantDto: any) {
    const existing = await this.tenantModel.findOne({ tenantCode: createTenantDto.tenantCode, isDeleted: false });
    if (existing) {
      throw new BadRequestException('Tenant code already exists');
    }
    const tenant = new this.tenantModel(createTenantDto);
    return tenant.save();
  }

  async findAll(tenantId?: string) {
    const query = tenantId ? this.tenantModel.find({ _id: tenantId, isDeleted: false }) : this.tenantModel.find({ isDeleted: false });
    query.populate('ownerId');
    const results = await query.exec();
    // ensure every stage has a stable id (back-fill if DB record predates this change)
    results.forEach((t: any) => {
      if (Array.isArray(t.pipelineStages)) {
        t.pipelineStages = t.pipelineStages.map((s: any) => ({
          ...s,
          id: s.id && s.id !== s.name ? s.id : randomUUID(),
        }));
      }
    });
    return results;
  }

  async findOne(id: string) {
    const tenant = await this.tenantModel.findOne({ _id: id, isDeleted: false })
      .populate('ownerId')
      .exec();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    // ensure every stage has a stable id (back-fill if DB record predates this change)
    if (Array.isArray(tenant.pipelineStages)) {
      tenant.pipelineStages = tenant.pipelineStages.map((s: any) => ({
        ...s,
        id: s.id && s.id !== s.name ? s.id : randomUUID(),
      }));
    }
    return tenant;
  }

  async update(id: string, updateTenantDto: any) {
    if (updateTenantDto && Array.isArray(updateTenantDto.pipelineStages)) {
      updateTenantDto.pipelineStages = updateTenantDto.pipelineStages.map((s: any, idx: number) => ({
        // Preserve the existing stable ID.  Only generate a new UUID when the
        // frontend doesn't send one (brand-new stage) or when it sent the old
        // fallback value that equalled the stage name.
        id: s.id && s.id !== s.name ? s.id : randomUUID(),
        name: s.name,
        order: typeof s.order === 'number' ? s.order : idx,
        probability: typeof s.probability === 'number' ? s.probability : (s.probability || 0),
        color: s.color || undefined,
      }));
    }
    const tenant = await this.tenantModel
      .findOneAndUpdate({ _id: id, isDeleted: false }, updateTenantDto, { new: true })
      .exec();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    // no further normalization needed — ids were already set correctly above
    return tenant;
  }

  async onboarding(data: any) {
    const { tenant: tenantData, adminUser: adminData } = data;

    // Default structure fallback
    const tData = tenantData || data;
    const aData = adminData || {
        name: data.adminName || 'Admin User',
        email: data.adminEmail,
        password: data.adminPassword,
    };
    
    console.log("tenant data", tData);
    console.log("admin data", aData);
    const existingTenant = await this.tenantModel.findOne({ tenantCode: tData.tenantCode || tData.companyName, isDeleted: false });
    if (existingTenant) {
      throw new BadRequestException('Tenant code already exists');
    }

    const existingUser = await this.userModel.findOne({ email: aData.email, isDeleted: false });
    if (existingUser) {
      throw new BadRequestException('Administrator email already exists');
    }

    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    const hashedPassword = await bcrypt.hash(aData.password, 10);

    // Normalize provided pipeline stages; do NOT create defaults here.
    const pipelineStagesToSave = (tData.pipelineStages && Array.isArray(tData.pipelineStages) && tData.pipelineStages.length > 0)
      ? tData.pipelineStages.map((s: any, idx: number) => ({
          // Preserve provided id; generate a fresh UUID for brand-new stages
          id: s.id && s.id !== s.name ? s.id : randomUUID(),
          name: s.name,
          order: typeof s.order === 'number' ? s.order : idx,
          probability: typeof s.probability === 'number' ? s.probability : (s.probability || 0),
          color: s.color || undefined,
        }))
      : [];

    const tenant = new this.tenantModel({
      ...tData,
      name: tData.companyName || tData.name,
      tenantCode: tData.tenantCode || tData.companyName.toLowerCase().replace(/\s+/g, '-'),
      _id: tenantId,
      ownerId: userId,
      pipelineStages: pipelineStagesToSave,
    });

    const user = new this.userModel({
      ...aData,
      name: aData.name || 'Admin',
      _id: userId,
      tenantId: tenantId,
      role: UserRole.ADMIN,
      password: hashedPassword,
    });

    await tenant.save();
    await user.save();

    return {
      tenant,
      adminUser: user,
    };
  }

  async remove(id: string) {
    const tenant = await this.tenantModel.findOne({ _id: id, isDeleted: false });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    tenant.isDeleted = true;
    tenant.isActive = false;
    return tenant.save();
  }
}

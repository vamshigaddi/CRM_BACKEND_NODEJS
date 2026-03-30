import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  ValidateNested,
  IsDate,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LeadDataSource, LeadSentiment, LeadStatus, LeadUrgency } from '../schemas/lead.schema';

export class LeadCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  designation?: string;
}

export class LeadIntentDto {
  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  budget?: number;

  @IsOptional()
  @IsEnum(LeadUrgency)
  urgency?: LeadUrgency;

  @IsOptional()
  @IsString()
  timeline?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  budgetMax?: number;
}

export class CreateLeadDto {
  @IsString()
  name: string;

  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phoneNumber: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadCompanyDto)
  company?: LeadCompanyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadIntentDto)
  intent?: LeadIntentDto;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(LeadDataSource)
  source?: LeadDataSource;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  aiScore?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  leadScore?: number;

  @IsOptional()
  @IsString()
  aiSummary?: string;

  @IsOptional()
  @IsEnum(LeadSentiment)
  sentiment?: LeadSentiment;

  @IsOptional()
  @IsDate()
  lastActivityAt?: Date;

  @IsOptional()
  @IsDate()
  nextFollowUpAt?: Date;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(LeadDataSource)
  createdFrom?: LeadDataSource;

  @IsOptional()
  @IsObject()
  strategicInsights?: any;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Phone number is required' })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadCompanyDto)
  company?: LeadCompanyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeadIntentDto)
  intent?: LeadIntentDto;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(LeadDataSource)
  source?: LeadDataSource;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  aiScore?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  leadScore?: number;

  @IsOptional()
  @IsString()
  aiSummary?: string;

  @IsOptional()
  @IsEnum(LeadSentiment)
  sentiment?: LeadSentiment;

  @IsOptional()
  @IsDate()
  lastActivityAt?: Date;

  @IsOptional()
  @IsDate()
  nextFollowUpAt?: Date;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(LeadDataSource)
  createdFrom?: LeadDataSource;

  @IsOptional()
  @IsObject()
  strategicInsights?: any;
}

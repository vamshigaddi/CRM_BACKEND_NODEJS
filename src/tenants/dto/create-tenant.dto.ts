import { Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  ValidateNested,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEnum,
} from 'class-validator';

export class PipelineStageDto {
  @IsOptional()
  @IsString()
  id?: string;
  @IsString()
  name: string;

  @IsNumber()
  order: number;

  @IsOptional()
  @IsNumber()
  probability?: number;
}

export class AIConfigDto {
  @IsOptional()
  @IsBoolean()
  autoLeadCapture?: boolean;

  @IsOptional()
  @IsBoolean()
  autoDealCreation?: boolean;
}

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsString()
  tenantCode: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  @IsUrl()
  logo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineStageDto)
  pipelineStages?: PipelineStageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AIConfigDto)
  aiConfig?: AIConfigDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class OnboardingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateTenantDto)
  tenant?: CreateTenantDto;

  @IsOptional()
  @ValidateNested()
  adminUser?: any; 

  // Flat payload support
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  tenantCode?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  adminPassword?: string;

  @IsOptional()
  @IsString()
  adminName?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  @IsUrl()
  logo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineStageDto)
  pipelineStages?: PipelineStageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AIConfigDto)
  aiConfig?: AIConfigDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

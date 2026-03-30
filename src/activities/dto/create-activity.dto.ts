import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Transform, Expose } from 'class-transformer';
import { ActivityType } from '../schemas/activity.schema';

export class CreateActivityDto {
  @IsEnum(ActivityType)
  type: ActivityType;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (!value) return value;
    if (typeof value === 'object') {
      if (value._id) return String(value._id);
      if (value.id) return String(value.id);
      return JSON.stringify(value);
    }
    return String(value);
  })
  leadId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (!value) return value;
    if (typeof value === 'object') {
      if (value._id) return String(value._id);
      if (value.id) return String(value.id);
      return JSON.stringify(value);
    }
    return String(value);
  })
  dealId?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  aiGenerated?: boolean;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

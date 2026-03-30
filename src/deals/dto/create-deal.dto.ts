import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDate,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform, Expose } from 'class-transformer';
import {  DealStatus } from '../schemas/deal.schema';

export class CreateDealDto {
  @IsString()
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'leadId is required' })
  @Transform(({ value }) => {
    if (!value) return value;
    // if the client passed a full object, try to extract an identifier
    if (typeof value === 'object') {
      if (value._id) return String(value._id);
      if (value.id) return String(value.id);
      return JSON.stringify(value);
    }
    return String(value);
  })
  leadId: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  value?: number;

  @IsOptional()
  stage?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  probability?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  budgetMax?: number;

  @IsOptional()
  @IsDate()
  expectedCloseDate?: Date;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (!value) return value;
    return String(value);
  })
  assignedTo?: string;

  @IsOptional()
  @IsEnum(DealStatus)
  status?: DealStatus;
}

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  value?: number;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  probability?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  budgetMax?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedCloseDate?: Date;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsEnum(DealStatus)
  status?: DealStatus;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => value ? Number(value) : undefined)
  closingValue?: number;

  @IsOptional()
  @IsString()
  closingNotes?: string;

  @IsOptional()
  @IsString()
  lostReason?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  dealType?: string;
}

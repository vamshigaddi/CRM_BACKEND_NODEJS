import { IsEnum, IsObject, IsOptional, IsBoolean, IsString } from 'class-validator';
import { IntegrationType, IntegrationStatus } from '../schemas/integrations.schema';

export class SaveIntegrationDto {
  @IsEnum(IntegrationType)
  integrationType: IntegrationType;

  @IsObject()
  integrationConfig: Record<string, any>;

  @IsEnum(IntegrationStatus)
  @IsOptional()
  status?: IntegrationStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateIntegrationStatusDto {
  @IsEnum(IntegrationStatus)
  status: IntegrationStatus;

  @IsString()
  @IsOptional()
  errorMessage?: string;
}

export class PingIntegrationDto {
  @IsEnum(IntegrationType)
  integrationType: IntegrationType;

  @IsObject()
  integrationConfig: Record<string, any>;
}

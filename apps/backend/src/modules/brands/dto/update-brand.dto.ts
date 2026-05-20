import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const BRAND_STATUSES = ['active', 'inactive'] as const;

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code must be alphanumeric with _ or -',
  })
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsEnum(BRAND_STATUSES)
  @IsOptional()
  status?: 'active' | 'inactive';
}

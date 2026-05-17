import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const SHOP_STATUSES = ['active', 'inactive'] as const;

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code must be alphanumeric with _ or -',
  })
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsNumberString()
  initialBalance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsEnum(SHOP_STATUSES)
  @IsOptional()
  status?: 'active' | 'inactive';
}

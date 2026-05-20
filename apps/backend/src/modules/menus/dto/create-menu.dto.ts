import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

const MENU_TYPES = ['catalog', 'menu', 'button', 'link', 'embedded'] as const;

export class CreateMenuDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  authCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  component?: string;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive';

  @IsEnum(MENU_TYPES)
  type!: (typeof MENU_TYPES)[number];
}

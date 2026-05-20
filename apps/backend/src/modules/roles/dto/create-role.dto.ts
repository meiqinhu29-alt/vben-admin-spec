import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const ROLE_STATUSES = ['active', 'inactive'] as const;
const DATA_SCOPES = ['all', 'shop', 'self'] as const;

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message: 'code must be lowercase alphanumeric with _ or -',
  })
  @MaxLength(50)
  @MinLength(2)
  code!: string;

  @IsEnum(DATA_SCOPES)
  @IsOptional()
  dataScope?: 'all' | 'self' | 'shop';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @MinLength(1)
  name!: string;

  @IsEnum(ROLE_STATUSES)
  @IsOptional()
  status?: 'active' | 'inactive';
}

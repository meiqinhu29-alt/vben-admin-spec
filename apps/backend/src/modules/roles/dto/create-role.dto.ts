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

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]*$/, {
    message: 'code must be lowercase alphanumeric with _ or -',
  })
  @MaxLength(50)
  @MinLength(2)
  code!: string;

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

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  displayName!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @MinLength(6)
  password!: string;

  @IsEnum(['active', 'disabled'])
  @IsOptional()
  status?: 'active' | 'disabled';

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @MinLength(3)
  username!: string;
}

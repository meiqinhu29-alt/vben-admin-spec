import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @IsOptional()
  @IsEnum(['active', 'disabled'])
  status?: 'active' | 'disabled';
}

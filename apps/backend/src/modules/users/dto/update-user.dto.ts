import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsEnum(['active', 'disabled'])
  @IsOptional()
  status?: 'active' | 'disabled';
}

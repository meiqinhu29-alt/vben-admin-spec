import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @MinLength(3)
  username!: string;
}

export class RefreshDto {
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

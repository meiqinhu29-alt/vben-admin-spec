import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDailyReportDto {
  @IsNumberString() @IsOptional() cardFee?: string;

  @IsNumberString() @IsOptional() cardPayment?: string;

  @IsNumberString() @IsOptional() companyBonus?: string;
  @IsNumberString() @IsOptional() companyToOwner?: string;
  @IsNumberString() @IsOptional() depositToCompany?: string;
  @IsNumberString() @IsOptional() mallSettlement?: string;
  @IsNumberString() @IsOptional() openingBalance?: string;
  @IsNumberString() @IsOptional() otherCompanyIncome?: string;
  @IsNumberString() @IsOptional() payToOwner?: string;

  @IsOptional() @IsString() @MaxLength(500) remark?: string;
  @IsDateString()
  reportDate!: string;
  @IsNumberString() @IsOptional() revenue?: string;
  @IsNumberString() @IsOptional() shopExpense?: string;
  @IsUUID()
  shopId!: string;
  @IsNumberString() @IsOptional() topupIncome?: string;

  @IsNumberString() @IsOptional() transferToCompany?: string;
}

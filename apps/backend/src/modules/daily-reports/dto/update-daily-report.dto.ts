import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateDailyReportDto {
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
  @IsNumberString() @IsOptional() revenue?: string;
  @IsNumberString() @IsOptional() shopExpense?: string;
  @IsNumberString() @IsOptional() topupIncome?: string;

  @IsNumberString() @IsOptional() transferToCompany?: string;
}

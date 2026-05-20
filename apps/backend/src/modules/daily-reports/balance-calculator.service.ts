import { Injectable } from '@nestjs/common';

interface BalanceInput {
  openingBalance: number | string;
  revenue: number | string;
  cardFee: number | string;
  transferToCompany: number | string;
  depositToCompany: number | string;
  payToOwner: number | string;
  shopExpense: number | string;
}

interface BalanceResult {
  actualRevenue: string;
  closingBalance: string;
}

@Injectable()
export class BalanceCalculatorService {
  calculate(input: BalanceInput): BalanceResult {
    const opening = Number(input.openingBalance);
    const revenue = Number(input.revenue);
    const cardFee = Number(input.cardFee);
    const transferToCompany = Number(input.transferToCompany);
    const depositToCompany = Number(input.depositToCompany);
    const payToOwner = Number(input.payToOwner);
    const shopExpense = Number(input.shopExpense);

    const actualRevenue = revenue - cardFee;
    const closingBalance =
      opening +
      actualRevenue -
      transferToCompany -
      depositToCompany -
      payToOwner -
      shopExpense;

    return {
      actualRevenue: actualRevenue.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
    };
  }
}

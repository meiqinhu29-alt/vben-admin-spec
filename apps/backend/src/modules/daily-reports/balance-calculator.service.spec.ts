import { describe, expect, it } from 'vitest';

import { BalanceCalculatorService } from './balance-calculator.service';

describe('balanceCalculatorService', () => {
  const service = new BalanceCalculatorService();

  it('calculates actualRevenue = revenue - cardFee', () => {
    const result = service.calculate({
      openingBalance: 0,
      revenue: 1000,
      cardFee: 50,
      transferToCompany: 0,
      depositToCompany: 0,
      payToOwner: 0,
      shopExpense: 0,
    });
    expect(result.actualRevenue).toBe('950.00');
  });

  it('calculates closingBalance correctly', () => {
    const result = service.calculate({
      openingBalance: 1000,
      revenue: 5000,
      cardFee: 100,
      transferToCompany: 2000,
      depositToCompany: 500,
      payToOwner: 300,
      shopExpense: 200,
    });
    // actualRevenue = 5000 - 100 = 4900
    // closingBalance = 1000 + 4900 - 2000 - 500 - 300 - 200 = 2900
    expect(result.actualRevenue).toBe('4900.00');
    expect(result.closingBalance).toBe('2900.00');
  });

  it('handles zero values', () => {
    const result = service.calculate({
      openingBalance: 0,
      revenue: 0,
      cardFee: 0,
      transferToCompany: 0,
      depositToCompany: 0,
      payToOwner: 0,
      shopExpense: 0,
    });
    expect(result.actualRevenue).toBe('0.00');
    expect(result.closingBalance).toBe('0.00');
  });

  it('handles string inputs', () => {
    const result = service.calculate({
      openingBalance: '1738',
      revenue: '5618',
      cardFee: '0',
      transferToCompany: '5508',
      depositToCompany: '0',
      payToOwner: '0',
      shopExpense: '75',
    });
    // actualRevenue = 5618 - 0 = 5618
    // closingBalance = 1738 + 5618 - 5508 - 0 - 0 - 75 = 1773
    expect(result.actualRevenue).toBe('5618.00');
    expect(result.closingBalance).toBe('1773.00');
  });
});

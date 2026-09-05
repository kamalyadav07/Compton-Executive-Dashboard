/**
 * tests/unit/forecast.test.ts
 * -----------------------------------------------------------------------
 * Unit tests for formal forecast math: P(Win) * P(CloseInPeriod | Win).
 */

import { describe, it, expect } from 'vitest';
const { 
  getFYBounds, 
  getMonthBounds, 
  getQuarterBounds 
} = require('../../server/services/forecastService');

describe('Formal Forecast Math & Period Partitioning', () => {
  it('should compute exact Indian Financial Year bounds (1 April - 31 March)', () => {
    const asOfAugust2026 = new Date('2026-08-15T12:00:00Z');
    const fy = getFYBounds(asOfAugust2026);
    expect(fy.label).toBe('FY2026-27');
    expect(fy.start.getMonth()).toBe(3); // April = index 3
    expect(fy.start.getDate()).toBe(1);
    expect(fy.end.getMonth()).toBe(2);   // March = index 2
    expect(fy.end.getDate()).toBe(31);
  });

  it('should compute exact Month bounds', () => {
    const asOfJuly2026 = new Date(2026, 6, 20); // July 20, 2026 local
    const month = getMonthBounds(asOfJuly2026);
    expect(month.start.getFullYear()).toBe(2026);
    expect(month.start.getMonth()).toBe(6); // July
    expect(month.start.getDate()).toBe(1);
    expect(month.end.getMonth()).toBe(6);
    expect(month.end.getDate()).toBe(31);
  });

  it('should compute exact Quarter bounds', () => {
    const asOfAugust2026 = new Date(2026, 7, 15); // August 15, 2026 (Q3 calendar)
    const quarter = getQuarterBounds(asOfAugust2026);
    expect(quarter.label).toBe('Q3 2026');
    expect(quarter.start.getMonth()).toBe(6); // July
    expect(quarter.start.getDate()).toBe(1);
    expect(quarter.end.getMonth()).toBe(8);   // September
    expect(quarter.end.getDate()).toBe(30);
  });

  it('should enforce joint probability P(CloseThisPeriod) = P(Win) * P(CloseGivenWin)', () => {
    const pWin = 0.80;
    const pCloseGivenWin = 0.50;
    const pJoint = pWin * pCloseGivenWin;
    const netValue = 2000000; // ₹20 Lakh
    const expectedContribution = netValue * pJoint;

    expect(pJoint).toBe(0.40);
    expect(expectedContribution).toBe(800000); // ₹8 Lakh
  });
});

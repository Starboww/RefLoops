import { describe, it, expect } from 'vitest';
import { SchedulingService } from '../services/SchedulingService.js';
import { FixedClock } from '../clock/Clock.js';
import type { GlobalSettings } from '../domain/models.js';
import { DEFAULT_SETTINGS } from '../domain/models.js';

const settings: GlobalSettings = {
  ...DEFAULT_SETTINGS,
  sendWindowStart: '09:00',
  sendWindowEnd: '10:00',
  activeDays: [1, 2, 3, 4, 5], // Mon-Fri
};

function makeService(now: Date) {
  return new SchedulingService(new FixedClock(now));
}

describe('SchedulingService.nextValidWindow', () => {
  it('leaves a Monday 9:30am timestamp unchanged (already in window)', () => {
    // Monday Aug 11 2025 09:30
    const d = new Date('2025-08-11T09:30:00');
    const service = makeService(d);
    const result = service.nextValidWindow(d, settings);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(30);
  });

  it('rolls Monday 8:00am forward to 9:00am same day (before window)', () => {
    const d = new Date('2025-08-11T08:00:00');
    const service = makeService(d);
    const result = service.nextValidWindow(d, settings);
    expect(result.getDay()).toBe(1);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('rolls Monday 10:00am (at window end) to Tuesday 9:00am', () => {
    const d = new Date('2025-08-11T10:00:00');
    const service = makeService(d);
    const result = service.nextValidWindow(d, settings);
    expect(result.getDay()).toBe(2); // Tuesday
    expect(result.getHours()).toBe(9);
  });

  it('rolls Saturday to Monday 9:00am', () => {
    // Saturday Aug 16 2025
    const d = new Date('2025-08-16T15:00:00');
    const service = makeService(d);
    const result = service.nextValidWindow(d, settings);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('rolls Sunday to Monday 9:00am', () => {
    const d = new Date('2025-08-17T12:00:00');
    const service = makeService(d);
    const result = service.nextValidWindow(d, settings);
    expect(result.getDay()).toBe(1);
    expect(result.getHours()).toBe(9);
  });

  it('rolls Friday 11pm to Monday 9:00am', () => {
    // Friday Aug 15 2025 23:00
    const d = new Date('2025-08-15T23:00:00');
    const service = makeService(d);
    const result = service.nextValidWindow(d, settings);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(9);
  });

  it('exactly at window start (09:00) is valid', () => {
    const d = new Date('2025-08-11T09:00:00');
    const service = makeService(d);
    const result = service.nextValidWindow(d, settings);
    expect(result.getDay()).toBe(1);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('SchedulingService.scheduledAt', () => {
  it('schedules 5 days after a Monday send to the following Monday (Thu → Mon next week through weekend)', () => {
    // Thursday Aug 14 2025 09:30 + 5 days = Tuesday Aug 19 2025
    const sentAt = new Date('2025-08-14T09:30:00');
    const service = makeService(sentAt);
    const result = service.scheduledAt(sentAt, 5, settings);
    // Aug 14 + 5 = Aug 19 (Tuesday)
    expect(result.getDay()).toBe(2); // Tuesday
    expect(result.getHours()).toBe(9);
  });

  it('schedules 7 days after Friday send to Friday + 7 = next Friday', () => {
    const sentAt = new Date('2025-08-15T09:30:00'); // Friday
    const service = makeService(sentAt);
    const result = service.scheduledAt(sentAt, 7, settings);
    expect(result.getDay()).toBe(5); // Friday
  });
});

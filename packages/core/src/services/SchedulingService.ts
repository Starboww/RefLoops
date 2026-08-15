// =============================================================================
// RefLoop — SchedulingService
// PRD §8.6, §12: send-window / weekday scheduling
// Rolls a computed datetime forward to the nearest allowed day + window.
// e.g. Saturday 3pm → Monday 9am; Sunday → Monday 9am; Mon 8am → Mon 9am
// =============================================================================

import type { GlobalSettings } from '../domain/models.js';
import type { Clock } from '../clock/Clock.js';

export class SchedulingService {
  constructor(private readonly clock: Clock) {}

  /** Return current date from clock */
  getNow(): Date {
    return this.clock.now();
  }

  /**
   * Given a candidate datetime, rolls it forward to the nearest slot that
   * falls on an activeDays weekday AND inside [sendWindowStart, sendWindowEnd).
   *
   * PRD §8.6: "a delay landing on Saturday 3pm rolls to Monday 9am"
   */
  nextValidWindow(date: Date, settings: GlobalSettings): Date {
    const result = new Date(date);
    const [startH, startM] = this.parseTime(settings.sendWindowStart);
    const [endH, endM] = this.parseTime(settings.sendWindowEnd);

    const resultH = result.getHours();
    const resultM = result.getMinutes();
    const afterEnd =
      resultH > endH || (resultH === endH && resultM >= endM);
    if (afterEnd) {
      result.setDate(result.getDate() + 1);
      result.setHours(startH, startM, 0, 0);
    } else if (resultH < startH || (resultH === startH && resultM < startM)) {
      result.setHours(startH, startM, 0, 0);
    }

    let safety = 0;
    while (!settings.activeDays.includes(result.getDay())) {
      result.setDate(result.getDate() + 1);
      result.setHours(startH, startM, 0, 0);
      if (++safety > 14) break;
    }

    return result;
  }

  /**
   * Returns the datetime for N days after `from`, resolved to the next
   * valid window. Used by HousekeepingService to schedule follow-ups.
   */
  scheduledAt(from: Date, delayDays: number, settings: GlobalSettings): Date {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + delayDays);
    return this.nextValidWindow(candidate, settings);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private parseTime(timeStr: string): [number, number] {
    const [h, m] = timeStr.split(':').map(Number);
    return [h ?? 0, m ?? 0];
  }
}

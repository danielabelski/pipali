/**
 * A routine set up ahead of its start date holds its first run until that date. The next
 * run it records is what the routines page shows.
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { scheduleCronJob, stopCronJob } from '../../src/server/automation/scheduler/cron';
import type { CronTriggerConfig } from '../../src/server/automation/types';
import type { Automation } from '../../src/server/db/schema';

let recordedNextRun: Date | undefined;

/** Schedule a cron routine and return the next run it records. */
function scheduleRoutine(triggerConfig: CronTriggerConfig): Date | undefined {
    const routine = {
        id: crypto.randomUUID(),
        name: 'Quarterly review',
        triggerType: 'cron',
        triggerConfig,
    } as typeof Automation.$inferSelect;

    scheduleCronJob(routine);
    stopCronJob(routine.id);
    return recordedNextRun;
}

describe('routine start date', () => {
    beforeEach(() => {
        recordedNextRun = undefined;
        globalThis.__pipaliUnitDb = {
            update: (_table, values) => {
                recordedNextRun = (values as { nextScheduledAt: Date }).nextScheduledAt;
                return { execute: async () => {} };
            },
        };
    });

    afterEach(() => {
        globalThis.__pipaliUnitDb = undefined;
    });

    test('first run is at midnight on the start date in the routine timezone', () => {
        const nextRun = scheduleRoutine({
            type: 'cron',
            schedule: '0 0 * * *',
            timezone: 'Asia/Tokyo',
            startDate: '2099-03-14',
        });

        expect(nextRun?.toISOString()).toBe('2099-03-13T15:00:00.000Z');
    });

    test('a start date already past leaves the schedule running', () => {
        const nextRun = scheduleRoutine({
            type: 'cron',
            schedule: '0 0 * * *',
            timezone: 'Asia/Tokyo',
            startDate: '2020-01-01',
        });

        const msUntilNextRun = nextRun!.getTime() - Date.now();
        expect(msUntilNextRun).toBeGreaterThan(0);
        expect(msUntilNextRun).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });
});

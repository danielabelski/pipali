/**
 * The next run a routine records is what the routines page counts down to. It holds until
 * a start date set ahead of time, and moves on each time the routine runs.
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { scheduleCronJob, stopCronJob } from '../../src/server/automation/scheduler/cron';
import type { CronTriggerConfig } from '../../src/server/automation/types';
import type { Automation } from '../../src/server/db/schema';

let recordedNextRuns: Date[] = [];
let scheduledIds: string[] = [];

function scheduleRoutine(triggerConfig: CronTriggerConfig): void {
    const routine = {
        id: crypto.randomUUID(),
        name: 'Quarterly review',
        triggerType: 'cron',
        triggerConfig,
    } as typeof Automation.$inferSelect;

    scheduledIds.push(routine.id);
    scheduleCronJob(routine);
}

describe('routine next run', () => {
    beforeEach(() => {
        recordedNextRuns = [];
        globalThis.__pipaliUnitDb = {
            // A run that fires finds no routine to execute, which is all these tests need.
            select: () => Promise.resolve([]),
            update: (_table, values) => {
                recordedNextRuns.push((values as { nextScheduledAt: Date }).nextScheduledAt);
                return { execute: async () => {} };
            },
        };
    });

    afterEach(() => {
        scheduledIds.forEach(stopCronJob);
        scheduledIds = [];
        globalThis.__pipaliUnitDb = undefined;
    });

    test('first run is at midnight on the start date in the routine timezone', () => {
        scheduleRoutine({
            type: 'cron',
            schedule: '0 0 * * *',
            timezone: 'Asia/Tokyo',
            startDate: '2099-03-14',
        });

        expect(recordedNextRuns[0]?.toISOString()).toBe('2099-03-13T15:00:00.000Z');
    });

    test('a start date already past leaves the schedule running', () => {
        scheduleRoutine({
            type: 'cron',
            schedule: '0 0 * * *',
            timezone: 'Asia/Tokyo',
            startDate: '2020-01-01',
        });

        const msUntilNextRun = recordedNextRuns[0]!.getTime() - Date.now();
        expect(msUntilNextRun).toBeGreaterThan(0);
        expect(msUntilNextRun).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    test('moves on to the following run once the routine runs', async () => {
        scheduleRoutine({ type: 'cron', schedule: '* * * * * *' });

        const deadline = Date.now() + 3000;
        while (recordedNextRuns.length < 2 && Date.now() < deadline) await Bun.sleep(50);

        expect(recordedNextRuns).toHaveLength(2);
        expect(recordedNextRuns[1]!.getTime()).toBeGreaterThan(recordedNextRuns[0]!.getTime());
    });
});

/**
 * A routine's trigger is checked strictly. Pipali writes routines through this API from
 * docs it may only half remember, and a start date dropped on the floor would leave the
 * routine running right away.
 */

import { describe, expect, test } from 'bun:test';
import automations from '../../../src/server/routes/automations';

function createRoutine(triggerConfig: Record<string, unknown>) {
    return automations.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Weekly report', prompt: 'Draft it', triggerType: 'cron', triggerConfig }),
    });
}

describe('routine trigger validation', () => {
    test('a misnamed start date is rejected by name rather than dropped', async () => {
        const response = await createRoutine({ type: 'cron', schedule: '0 9 * * 1', startAt: '2026-11-02' });

        expect(response.status).toBe(400);
        expect(await response.text()).toContain('startAt');
    });

    test('a start date with a time of day is rejected', async () => {
        const response = await createRoutine({ type: 'cron', schedule: '0 9 * * 1', startDate: '2026-11-02T09:00:00-08:00' });

        expect(response.status).toBe(400);
        expect(await response.text()).toContain('startDate');
    });
});

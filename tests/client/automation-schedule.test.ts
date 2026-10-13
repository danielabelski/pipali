import { test, expect, describe, afterEach, setSystemTime } from 'bun:test';
import { buildCronSchedule, describeCron, parseFormSchedule, DEFAULT_FORM_SCHEDULE } from '../../src/client/components/automations/schedule';
import { formatRunTimes } from '../../src/client/components/automations/utils';
import { DAY_OF_MONTH_OPTIONS, DAYS_OF_WEEK, MINUTE_OPTIONS, TIME_OPTIONS } from '../../src/client/types/automations';

describe('routine form schedules', () => {
    test('every schedule the form builds reads back as itself', () => {
        const built = [
            ...MINUTE_OPTIONS.map(({ value }) => buildCronSchedule({ ...DEFAULT_FORM_SCHEDULE, frequency: 'hour', minuteOfHour: value })),
            ...TIME_OPTIONS.flatMap(({ value: time }) => [
                buildCronSchedule({ ...DEFAULT_FORM_SCHEDULE, frequency: 'day', time }),
                buildCronSchedule({ ...DEFAULT_FORM_SCHEDULE, frequency: 'week', time, daysOfWeek: ['friday', 'monday'] }),
            ]),
            ...DAYS_OF_WEEK.map(({ value }) => buildCronSchedule({ ...DEFAULT_FORM_SCHEDULE, frequency: 'week', daysOfWeek: [value] })),
            ...DAY_OF_MONTH_OPTIONS.map(({ value }) => buildCronSchedule({ ...DEFAULT_FORM_SCHEDULE, frequency: 'month', dayOfMonth: value })),
        ];

        for (const schedule of built) {
            const parsed = parseFormSchedule(schedule);
            expect(parsed).not.toBeNull();
            expect(buildCronSchedule(parsed!)).toBe(schedule);
        }
    });

    test('the day lists and ranges Pipali writes open in the form', () => {
        expect(parseFormSchedule('0 9 * * 1-5')).toMatchObject({ frequency: 'week', time: '9:00', daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] });
        expect(parseFormSchedule('30 8 * * 5,1')).toMatchObject({ frequency: 'week', time: '8:30', daysOfWeek: ['monday', 'friday'] });
        expect(parseFormSchedule('0 9 * * 7')).toMatchObject({ frequency: 'week', daysOfWeek: ['sunday'] });
        expect(parseFormSchedule('0 9 * * 0-6')).toMatchObject({ frequency: 'day', time: '9:00' });
    });

    test('schedules beyond the form are described in plain words, never as cron', () => {
        const beyondTheForm = [
            '30 8,16 * * 1-5',
            '*/15 * * * *',
            '0 */2 * * *',
            '0 9-17 * * 1-5',
            '0 9 1 1,4,7,10 *',
            '0 9 * * 1#1',
            '0 9 L * *',
            '7 9 * * *',        // a minute the form does not offer
            '0 0 9 * * 1',      // with seconds
        ];
        for (const schedule of beyondTheForm) {
            expect(parseFormSchedule(schedule)).toBeNull();
            const description = describeCron(schedule, 'en', false);
            expect(description).toBeTruthy();
            expect(description).not.toContain(schedule);
        }

        expect(describeCron('30 8,16 * * 1-5', 'en', false)).toContain('Monday through Friday');
        expect(describeCron('30 8,16 * * 1-5', 'de', true)).toContain('Montag bis Freitag');
        expect(describeCron('30 8,16 * * 1-5', 'zh', true)).toContain('星期一至星期五');
        expect(describeCron('*/15 * * * *', 'en-US', false)).toBe('Every 15 minutes');
        expect(describeCron('not a schedule', 'en', false)).toBeNull();
    });
});

describe('routine next runs', () => {
    afterEach(() => setSystemTime());

    test('show their years once any falls outside the current year', () => {
        setSystemTime(new Date(2026, 9, 24));
        const format = (...runs: [number, number, number][]) =>
            formatRunTimes(runs.map(([year, month, day]) => new Date(year, month, day, 9).toISOString()));

        expect(format([2026, 10, 2], [2026, 10, 9], [2026, 10, 16]).join()).not.toContain('2026');

        const yearly = format([2026, 10, 9], [2027, 10, 9], [2028, 10, 9]);
        ['2026', '2027', '2028'].forEach((year, i) => expect(yearly[i]).toContain(year));

        const startingNextYear = format([2027, 0, 4], [2027, 0, 11], [2027, 0, 18]);
        startingNextYear.forEach(run => expect(run).toContain('2027'));
    });
});

// The schedules the routine form can show and build, and plain words for every other
// cron expression Pipali can set through the API.

import cronstrue from 'cronstrue';
import 'cronstrue/locales/de';
import 'cronstrue/locales/fr';
import 'cronstrue/locales/ja';
import 'cronstrue/locales/zh_CN';
import type { DayOfWeek, FrequencyType } from '../../types/automations';
import { DAYS_OF_WEEK, MINUTE_OPTIONS } from '../../types/automations';

export interface FormSchedule {
    frequency: FrequencyType;
    daysOfWeek: DayOfWeek[];
    dayOfMonth: number;
    minuteOfHour: number;
    time: string;
}

export const DEFAULT_FORM_SCHEDULE: FormSchedule = {
    frequency: 'day',
    daysOfWeek: ['monday'],
    dayOfMonth: 1,
    minuteOfHour: 0,
    time: '12:00',
};

const WEEKDAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

function inRange(field: string, min: number, max: number): number | null {
    if (!/^\d{1,2}$/.test(field)) return null;
    const value = Number(field);
    return value >= min && value <= max ? value : null;
}

/** Day-of-week indices from a list of days and ranges like "1-5,0", with 7 as Sunday. */
function parseDaysOfWeek(field: string): number[] | null {
    const days = new Set<number>();
    for (const part of field.split(',')) {
        const [from, to = from] = part.split('-').map(bound => inRange(bound, 0, 7));
        if (from == null || to == null || from > to || part.split('-').length > 2) return null;
        for (let day = from; day <= to; day++) days.add(day % 7);
    }
    return [...days].sort((a, b) => a - b);
}

/** The form's reading of a schedule, or null when the form cannot show it. */
export function parseFormSchedule(schedule: string): FormSchedule | null {
    const fields = schedule.trim().split(/\s+/);
    if (fields.length !== 5) return null;
    const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = fields as [string, string, string, string, string];

    const minute = inRange(minuteField, 0, 59);
    if (minute == null || !MINUTE_OPTIONS.some(option => option.value === minute) || monthField !== '*') return null;

    if (hourField === '*') {
        if (dayOfMonthField !== '*' || dayOfWeekField !== '*') return null;
        return { ...DEFAULT_FORM_SCHEDULE, frequency: 'hour', minuteOfHour: minute };
    }

    const hour = inRange(hourField, 0, 23);
    if (hour == null) return null;
    const at = { ...DEFAULT_FORM_SCHEDULE, minuteOfHour: minute, time: `${hour}:${minuteField.padStart(2, '0')}` };

    if (dayOfMonthField !== '*') {
        const dayOfMonth = inRange(dayOfMonthField, 1, 31);
        if (dayOfMonth == null || dayOfWeekField !== '*') return null;
        return { ...at, frequency: 'month', dayOfMonth };
    }

    if (dayOfWeekField === '*') return { ...at, frequency: 'day' };
    const days = parseDaysOfWeek(dayOfWeekField);
    if (!days) return null;
    if (days.length === 7) return { ...at, frequency: 'day' };
    return { ...at, frequency: 'week', daysOfWeek: days.map(day => DAYS_OF_WEEK[day]!.value) };
}

// Build cron schedule from UI state
export function buildCronSchedule({ frequency, daysOfWeek, dayOfMonth, minuteOfHour, time }: FormSchedule): string {
    const [hour, timeMinute] = time.split(':').map(Number);

    switch (frequency) {
        case 'hour':
            return `${minuteOfHour} * * * *`;
        case 'day':
            return `${timeMinute} ${hour} * * *`;
        case 'week':
            const weekdayIndices = daysOfWeek
                .map(d => DAYS_OF_WEEK.findIndex(day => day.value === d))
                .sort((a, b) => a - b)
                .join(',');
            return `${timeMinute} ${hour} * * ${weekdayIndices}`;
        case 'month':
            return `${timeMinute} ${hour} ${dayOfMonth} * *`;
        default:
            return `${timeMinute} ${hour} * * *`;
    }
}

export function isWeekdays(days: DayOfWeek[]): boolean {
    return days.length === WEEKDAYS.length && WEEKDAYS.every(day => days.includes(day));
}

/** Plain words for any cron expression in the UI language, or null when it cannot be read. */
export function describeCron(schedule: string, language: string, use24HourTimeFormat: boolean): string | null {
    const base = language.split('-')[0];
    const locale = base === 'zh' ? 'zh_CN' : ['de', 'fr', 'ja'].includes(base!) ? base : 'en';
    try {
        return cronstrue.toString(schedule, { locale, use24HourTimeFormat, throwExceptionOnParseError: true });
    } catch {
        return null;
    }
}

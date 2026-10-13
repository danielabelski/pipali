import type { TFunction } from 'i18next';
import i18n from '../../i18n';
import type { AutomationInfo } from '../../types/automations';

/** Format time using locale-appropriate AM/PM or 24-hour format. */
export function formatTime(h: number, m: string, t: TFunction): string {
    const am = t('automations.timePeriodAM');
    const pm = t('automations.timePeriodPM');
    if (!am && !pm) return `${h.toString().padStart(2, '0')}:${m.padStart(2, '0')}`;
    const h12 = h % 12 || 12;
    return `${h12}:${m.padStart(2, '0')} ${h < 12 ? am : pm}`;
}

/** Format day-of-week cron field to localized day names joined with "and". */
export function formatDayOfWeek(dayOfWeek: string, t: TFunction): string {
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayNames = dayOfWeek.split(',').map(d => {
        const dayKey = dayKeys[parseInt(d.trim(), 10)] ?? 'sunday';
        return t(`automations.days.${dayKey}` as any) as string;
    });
    return dayNames.length > 1
        ? dayNames.slice(0, -1).join(', ') + ' ' + t('automations.and') + ' ' + dayNames[dayNames.length - 1]
        : dayNames[0]!;
}

/** Format day-of-month number with English ordinal suffix when in English locale. */
export function formatDayOfMonth(dom: number): string {
    let dayStr = `${dom}`;
    if (i18n.language.startsWith('en')) {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = dom % 100;
        dayStr = `${dom}${suffixes[(v >= 11 && v <= 13) ? 0 : Math.min(v % 10, 4) > 3 ? 0 : v % 10]}`;
    }
    return dayStr;
}

/** A local calendar date as YYYY-MM-DD, the format of date inputs and routine start dates. */
export function toDateInputValue(date: Date = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A routine's start date if its schedule has yet to begin, else empty. */
export function upcomingStartDate(automation: AutomationInfo): string {
    const config = automation.triggerConfig;
    const startDate = config?.type === 'cron' ? config.startDate : undefined;
    return startDate && startDate > toDateInputValue() ? startDate : '';
}

/** Format a YYYY-MM-DD date for display in the UI language. */
export function formatDate(date: string): string {
    return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(`${date}T00:00`));
}

/** Format next scheduled time as a relative localized string. */
export function formatNextRun(nextScheduledAt: string | undefined, t: TFunction): string | null {
    if (!nextScheduledAt) return null;

    const next = new Date(nextScheduledAt);
    const now = new Date();
    const diffMs = next.getTime() - now.getTime();

    if (diffMs < 0) return t('automations.overdue');

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return t('automations.inDays', { count: diffDays });
    }
    if (diffHours > 0) {
        return t('automations.inHours', { count: diffHours });
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes > 0) {
        return t('automations.inMinutes', { count: diffMinutes });
    }

    return t('automations.soon');
}

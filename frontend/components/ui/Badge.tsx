import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { PriceTrend } from '@/lib/types';

const trendStyles: Record<PriceTrend, { color: string; bg: string; Icon: typeof ArrowUpRight }> = {
    Rising: { color: 'var(--forest-600)', bg: 'var(--sage-100)', Icon: ArrowUpRight },
    Falling: { color: 'var(--clay-500)', bg: 'var(--clay-100)', Icon: ArrowDownRight },
    Stable: { color: 'var(--gold-500)', bg: 'var(--gold-100)', Icon: Minus },
};

export function TrendBadge({ trend }: { trend: PriceTrend }) {
    const { color, bg, Icon } = trendStyles[trend];
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{ color, background: bg, borderColor: `${color}33` }}
        >
            <Icon size={12} />
            {trend}
        </span>
    );
}

const statusStyles: Record<string, { color: string; bg: string }> = {
    Low: { color: 'var(--clay-500)', bg: 'var(--clay-100)' },
    Optimal: { color: 'var(--forest-600)', bg: 'var(--sage-100)' },
    High: { color: 'var(--gold-500)', bg: 'var(--gold-100)' },
};

export function StatusBadge({ status }: { status: string }) {
    const style = statusStyles[status] ?? { color: 'var(--ink-soft)', bg: 'var(--sage-100)' };
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{ color: style.color, background: style.bg, borderColor: `${style.color}33` }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color }} />
            {status}
        </span>
    );
}

const bandStyles: Record<string, { color: string; bg: string }> = {
    High: { color: 'var(--forest-600)', bg: 'var(--sage-100)' },
    Medium: { color: 'var(--gold-500)', bg: 'var(--gold-100)' },
    Low: { color: 'var(--clay-500)', bg: 'var(--clay-100)' },
};

export function ConfidenceBadge({ band }: { band: string }) {
    const style = bandStyles[band] ?? { color: 'var(--ink-soft)', bg: 'var(--sage-100)' };
    return (
        <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium"
            style={{ color: style.color, background: style.bg, borderColor: `${style.color}33` }}
        >
            {band} confidence
        </span>
    );
}
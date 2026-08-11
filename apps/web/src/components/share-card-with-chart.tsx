'use client';

import { useState, useMemo } from 'react';
import { formatPercent } from '@/lib/format';
import { Logo } from '@/components/logo';
import type { LivelinePoint } from 'liveline';

export interface ShareCardStyleOverrides {
    nameWeight?: number;
    nameLs?: number;
    pctWeight?: number;
    pctLs?: number;
    contentGap?: number;
    chartHeight?: number;
    chartStroke?: number;
    chartPoints?: number;
    chartTension?: number;
}

interface ShareCardWithChartProps {
    tokenName: string;
    logoURI?: string;
    percentChange: number;
    pricePoints: LivelinePoint[];
    chartWindowSecs: number;
    chartColor?: string;
    overrides?: ShareCardStyleOverrides;
}

/** Downsample points to `target` evenly-spaced samples. */
function downsample(points: LivelinePoint[], target: number): LivelinePoint[] {
    if (points.length <= target) return points;
    const result: LivelinePoint[] = [points[0]!];
    const step = (points.length - 1) / (target - 1);
    for (let i = 1; i < target - 1; i++) {
        result.push(points[Math.round(i * step)]!);
    }
    result.push(points.at(-1)!);
    return result;
}

/**
 * Token logo with initials fallback. The error state lives here so callers can
 * reset it by remounting via `key` when the logo source changes — no adjustment effect.
 */
export function ShareCardTokenLogo({ tokenName, logoURI }: { tokenName: string; logoURI?: string }) {
    const [logoError, setLogoError] = useState(false);
    const initials = tokenName.slice(0, 2).toUpperCase();

    if (logoURI && !logoError) {
        return (
            <img
                src={logoURI}
                alt={tokenName}
                width={89}
                height={89}
                onError={() => setLogoError(true)}
                style={{
                    width: 89,
                    height: 89,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                }}
            />
        );
    }

    return (
        <div
            style={{
                width: 89,
                height: 89,
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            <span className="font-semibold" style={{ fontSize: 41, color: '#6b7280' }}>
                {initials}
            </span>
        </div>
    );
}

type ChartCoord = { x: number; y: number };

function normalizeChartPoints(points: LivelinePoint[]): LivelinePoint[] {
    const filtered = points.filter(p => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0);
    if (filtered.length < 2) return filtered;

    const sorted = [...filtered].sort((a, b) => a.time - b.time);

    // Dedupe timestamps (keep the last value for each time).
    const deduped: LivelinePoint[] = [];
    for (const p of sorted) {
        const last = deduped.at(-1);
        if (!last) {
            deduped.push(p);
            continue;
        }
        if (p.time === last.time) {
            deduped[deduped.length - 1] = p;
            continue;
        }
        deduped.push(p);
    }

    return deduped;
}

/**
 * Monotone cubic interpolation (like d3 `curveMonotoneX`) to avoid overshoot/loops.
 * Requires strictly increasing x coordinates.
 */
function monotoneCubicPath(coords: ChartCoord[]): string {
    if (coords.length < 2) return '';
    if (coords.length === 2) {
        return `M${coords[0]!.x.toFixed(1)},${coords[0]!.y.toFixed(1)} L${coords[1]!.x.toFixed(1)},${coords[1]!.y.toFixed(1)}`;
    }

    const n = coords.length;
    const d: number[] = [];
    const m: number[] = new Array(n).fill(0);

    for (let i = 0; i < n - 1; i++) {
        const dx = coords[i + 1]!.x - coords[i]!.x;
        const dy = coords[i + 1]!.y - coords[i]!.y;
        d[i] = dx !== 0 ? dy / dx : 0;
    }

    m[0] = d[0]!;
    m[n - 1] = d[n - 2]!;
    for (let i = 1; i < n - 1; i++) {
        m[i] = (d[i - 1]! + d[i]!) / 2;
    }

    // If a segment is flat, force tangents to 0 to prevent wiggles.
    for (let i = 0; i < n - 1; i++) {
        if (d[i] === 0) {
            m[i] = 0;
            m[i + 1] = 0;
        }
    }

    // Clamp to preserve monotonicity.
    for (let i = 0; i < n - 1; i++) {
        const di = d[i]!;
        if (di === 0) continue;
        const a = m[i]! / di;
        const b = m[i + 1]! / di;
        const s = a * a + b * b;
        if (s > 9) {
            const t = 3 / Math.sqrt(s);
            m[i] = t * a * di;
            m[i + 1] = t * b * di;
        }
    }

    const parts: string[] = [`M${coords[0]!.x.toFixed(1)},${coords[0]!.y.toFixed(1)}`];
    for (let i = 0; i < n - 1; i++) {
        const p0 = coords[i]!;
        const p1 = coords[i + 1]!;
        const h = p1.x - p0.x;
        const cp1x = p0.x + h / 3;
        const cp1y = p0.y + (m[i]! * h) / 3;
        const cp2x = p1.x - h / 3;
        const cp2y = p1.y - (m[i + 1]! * h) / 3;
        parts.push(
            `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`,
        );
    }

    return parts.join(' ');
}

/** Build smooth SVG path + fill from price data. */
function buildChartPath(
    points: LivelinePoint[],
    width: number,
    height: number,
    windowSecs: number,
    targetPoints = 24,
    tension = 0.3,
): { linePath: string; fillPath: string } | null {
    const normalized = normalizeChartPoints(points);
    if (normalized.length < 2) return null;

    const now = normalized.at(-1)!.time;
    const windowStart = now - windowSecs;
    const visible = normalized.filter(p => p.time >= windowStart && p.time <= now);
    if (visible.length < 2) return null;

    const sampled = downsample(visible, targetPoints);
    const uniqueSampled = normalizeChartPoints(sampled);
    if (uniqueSampled.length < 2) return null;

    let minVal = Infinity,
        maxVal = -Infinity;
    for (const p of uniqueSampled) {
        if (p.value < minVal) minVal = p.value;
        if (p.value > maxVal) maxVal = p.value;
    }
    const range = maxVal - minVal;
    const padded = (range === 0 ? 1 : range) * 1.1;
    const mid = (maxVal + minVal) / 2;
    const yMin = mid - padded / 2;

    const timeStart = uniqueSampled[0]!.time;
    const timeRange = uniqueSampled.at(-1)!.time - timeStart || 1;

    // Share cards want an edge-to-edge chart (no gutters).
    const padX = 0;
    const padY = height * 0.04; // 4% vertical padding top/bottom
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;
    const coords: ChartCoord[] = uniqueSampled.map(p => ({
        x: padX + ((p.time - timeStart) / timeRange) * plotW,
        y: padY + plotH - ((p.value - yMin) / padded) * plotH,
    }));

    // Prefer monotone interpolation (no overshoot). `tension` kept for API compat (ignored here).
    void tension;
    const linePath = monotoneCubicPath(coords);
    const lastCoord = coords.at(-1)!;
    const firstCoord = coords[0]!;
    const fillPath = `${linePath} L${lastCoord.x.toFixed(1)},${height} L${firstCoord.x.toFixed(1)},${height} Z`;

    return { linePath, fillPath };
}

export function ShareCardWithChart({
    tokenName,
    logoURI,
    percentChange,
    pricePoints,
    chartWindowSecs,
    chartColor: _chartColor,
    overrides,
}: ShareCardWithChartProps) {
    const nameWeight = overrides?.nameWeight ?? 520;
    const nameLs = overrides?.nameLs ?? -0.02;
    const pctWeight = overrides?.pctWeight ?? 520;
    const pctLs = overrides?.pctLs ?? -2;
    const gap = overrides?.contentGap ?? 40;
    const chartH = overrides?.chartHeight ?? 648;
    const chartStrokeW = overrides?.chartStroke ?? 4;
    const chartPts = overrides?.chartPoints ?? 24;
    const chartTension = overrides?.chartTension ?? 0.3;
    const isPositive = percentChange >= 0;
    const formatted = formatPercent(percentChange);
    const sign = formatted[0];
    const value = formatted.slice(1);

    const chartLineColor = isPositive ? '#1ea25f' : '#dc2626';

    const signGradient = isPositive
        ? 'linear-gradient(to bottom, #22bd6f, #0c341f)'
        : 'linear-gradient(to bottom, #ef4444, #7f1d1d)';
    const valueGradient = isPositive
        ? 'linear-gradient(to bottom, #000000, rgba(12,52,31,0.88))'
        : 'linear-gradient(to bottom, #000000, rgba(127,29,29,0.88))';
    const bgGradient = isPositive
        ? 'radial-gradient(circle at 50% 50%, rgba(30,162,95,0.08), rgba(30,162,95,0) 70%)'
        : 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0.08), rgba(220,38,38,0) 70%)';

    const CHART_W = 1080;

    const chartPaths = useMemo(
        () => buildChartPath(pricePoints, CHART_W, chartH, chartWindowSecs, chartPts, chartTension),
        [pricePoints, chartWindowSecs, chartH, chartPts, chartTension],
    );

    return (
        <div
            className="font-sans"
            style={{
                width: 1080,
                height: 1080,
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                backgroundImage: bgGradient,
            }}
        >
            {/* Top branding */}
            <div
                style={{
                    position: 'absolute',
                    top: 52,
                    left: 0,
                    right: 0,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                }}
            >
                <Logo width={29} height={29} />
                <span
                    className="font-semibold"
                    style={{ fontSize: 35, color: 'rgba(28,28,29,0.72)', lineHeight: 1.17 }}
                >
                    SPL Token
                </span>
            </div>

            {/* Center content */}
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap,
                }}
            >
                {/* Token icon + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                    <ShareCardTokenLogo
                        key={`${tokenName}:${logoURI ?? ''}`}
                        tokenName={tokenName}
                        logoURI={logoURI}
                    />
                    <span
                        className="font-sans"
                        style={{
                            fontSize: 81,
                            fontVariationSettings: `'wght' ${nameWeight}`,
                            color: 'rgba(28,28,29,0.88)',
                            letterSpacing: `${nameLs}em`,
                            lineHeight: 1.1,
                        }}
                    >
                        {tokenName}
                    </span>
                </div>

                {/* Large percentage with gradient text */}
                <span
                    className="font-sans"
                    style={{
                        fontSize: 141,
                        fontVariationSettings: `'wght' ${pctWeight}`,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1.1,
                        letterSpacing: `${pctLs}px`,
                    }}
                >
                    <span
                        style={{
                            background: signGradient,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        {sign}
                    </span>
                    <span
                        style={{
                            background: valueGradient,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        {value}
                    </span>
                </span>
            </div>

            {/* SVG chart — overlaps behind text, fills bottom 60% */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: CHART_W,
                    height: chartH,
                    zIndex: 0,
                }}
            >
                {chartPaths && (
                    <svg
                        viewBox={`0 0 ${CHART_W} ${chartH}`}
                        width={CHART_W}
                        height={chartH}
                        style={{ display: 'block' }}
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={chartLineColor} stopOpacity={0.18} />
                                <stop offset="60%" stopColor={chartLineColor} stopOpacity={0.06} />
                                <stop offset="100%" stopColor={chartLineColor} stopOpacity={0.01} />
                            </linearGradient>
                            <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={chartLineColor} stopOpacity={0} />
                                <stop offset="8%" stopColor={chartLineColor} stopOpacity={1} />
                                <stop offset="100%" stopColor={chartLineColor} stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        <path d={chartPaths.fillPath} fill="url(#chartFill)" />
                        <path
                            d={chartPaths.linePath}
                            fill="none"
                            stroke="url(#chartStroke)"
                            strokeWidth={chartStrokeW}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </div>
        </div>
    );
}

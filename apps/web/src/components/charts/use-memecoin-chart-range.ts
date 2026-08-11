import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react';

import {
    DEFAULT_MEMECOIN_TIME_RANGE_DAYS,
    MEMECOIN_TIME_RANGES,
    pickMemecoinIntervalForDays,
} from './price-chart-utils';

export function useMemecoinChartRange(options: {
    onTimeRangeChanged: (next: number, previous: number) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [timeRange, setTimeRangeState] = useState(DEFAULT_MEMECOIN_TIME_RANGE_DAYS);
    const deferredTimeRange = useDeferredValue(timeRange);
    const interval = useMemo(() => pickMemecoinIntervalForDays(deferredTimeRange), [deferredTimeRange]);

    const handleTimeRangeChange = useCallback(
        (range: number) => {
            startTransition(() => {
                setTimeRangeState(range);
                options.onTimeRangeChanged(range, timeRange);
            });
        },
        [options, timeRange],
    );

    return {
        interval,
        timeRange,
        deferredTimeRange,
        isPending,
        handleTimeRangeChange,
        timeRanges: MEMECOIN_TIME_RANGES,
        timeframeLabel:
            MEMECOIN_TIME_RANGES.find(r => Math.abs(r.days - timeRange) < 1e-9)?.label ?? `${timeRange}D`,
    };
}

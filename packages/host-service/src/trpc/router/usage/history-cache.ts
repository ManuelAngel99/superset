import type { UsageHistory } from "./history/aggregate";

export interface CachedUsageHistory {
	history: UsageHistory | null;
	computedAt: number | null;
	scanning: boolean;
	failed: boolean;
}

interface Entry {
	history: UsageHistory | null;
	computedAt: number | null;
	inFlight: Promise<void> | null;
	failed: boolean;
}

export function createUsageHistoryCache({
	ttlMs,
	now = Date.now,
}: {
	ttlMs: number;
	now?: () => number;
}) {
	const entries = new Map<number, Entry>();

	function refresh(
		days: number,
		entry: Entry,
		scan: () => Promise<UsageHistory>,
	) {
		entry.inFlight = scan()
			.then((history) => {
				entry.history = history;
				entry.computedAt = now();
				entry.failed = false;
			})
			.catch(() => {
				entry.failed = true;
			})
			.finally(() => {
				entry.inFlight = null;
			});
		entries.set(days, entry);
	}

	return {
		get(days: number, scan: () => Promise<UsageHistory>): CachedUsageHistory {
			const entry = entries.get(days) ?? {
				history: null,
				computedAt: null,
				inFlight: null,
				failed: false,
			};
			const stale =
				entry.computedAt === null || now() - entry.computedAt >= ttlMs;
			if (stale && !entry.inFlight) refresh(days, entry, scan);
			return {
				history: entry.history,
				computedAt: entry.computedAt,
				scanning: entry.inFlight !== null,
				failed: entry.failed,
			};
		},
	};
}

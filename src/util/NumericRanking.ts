export interface NumericRankingGroup<T> {
	value: number;
	entries: readonly T[];
}

/** Normalize a calculated ranking value, rejecting invalid or negative values. */
export function evaluateNumericRankingValue(value: number): number | null {
	return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Sort numeric ranking entries descending while retaining input order when all
 * explicit tie-breakers are equal.
 */
export function stableSortNumericRankingEntries<T>(
	entries: readonly T[],
	getValue: (entry: T) => number,
	compareTies: (a: T, b: T) => number = () => 0,
): T[] {
	return entries
		.map((entry, index) => ({ entry, index }))
		.sort(
			(a, b) =>
				getValue(b.entry) - getValue(a.entry) ||
				compareTies(a.entry, b.entry) ||
				a.index - b.index,
		)
		.map(({ entry }) => entry);
}

/** Stable-sort numeric ranking entries and group entries with equal values. */
export function groupNumericRankingEntries<T>(
	entries: readonly T[],
	getValue: (entry: T) => number,
	compareTies: (a: T, b: T) => number = () => 0,
): NumericRankingGroup<T>[] {
	const groups: NumericRankingGroup<T>[] = [];
	for (const entry of stableSortNumericRankingEntries(
		entries,
		getValue,
		compareTies,
	)) {
		const value = getValue(entry);
		const last = groups.at(-1);
		if (last?.value === value) {
			groups[groups.length - 1] = {
				value,
				entries: [...last.entries, entry],
			};
		} else {
			groups.push({ value, entries: [entry] });
		}
	}
	return groups;
}

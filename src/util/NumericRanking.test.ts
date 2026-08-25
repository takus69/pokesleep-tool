import { describe, expect, test } from "vitest";
import {
	evaluateNumericRankingValue,
	groupNumericRankingEntries,
	stableSortNumericRankingEntries,
} from "./NumericRanking";

describe("evaluateNumericRankingValue", () => {
	test.each([
		Number.NaN,
		Number.POSITIVE_INFINITY,
		-1,
	])("rejects invalid value %s", (value) =>
		expect(evaluateNumericRankingValue(value)).toBeNull());

	test.each([0, 1, 1.5])("accepts non-negative value %s", (value) => {
		expect(evaluateNumericRankingValue(value)).toBe(value);
	});
});

describe("numeric ranking order", () => {
	const entries = [
		{ name: "third", value: 1, tie: 0 },
		{ name: "second-a", value: 2, tie: 1 },
		{ name: "first", value: 3, tie: 0 },
		{ name: "second-b", value: 2, tie: 1 },
		{ name: "second-c", value: 2, tie: 0 },
	];

	test("sorts descending with explicit and stable tie-breaks", () => {
		expect(
			stableSortNumericRankingEntries(
				entries,
				(entry) => entry.value,
				(a, b) => a.tie - b.tie,
			).map((entry) => entry.name),
		).toEqual(["first", "second-c", "second-a", "second-b", "third"]);
	});

	test("groups equal values in ranking order", () => {
		const groups = groupNumericRankingEntries(
			entries,
			(entry) => entry.value,
			(a, b) => a.tie - b.tie,
		);

		expect(groups.map((group) => group.value)).toEqual([3, 2, 1]);
		expect(groups[1].entries.map((entry) => entry.name)).toEqual([
			"second-c",
			"second-a",
			"second-b",
		]);
	});
});

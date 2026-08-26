import { describe, expect, test } from "vitest";
import PokemonIv from "../util/PokemonIv";
import type {
	RankingScenarioEntry,
	RankingScenarioGroup,
} from "../util/RankingScenario";
import { locateScenarioComparison } from "./RankingScenarioResults";

function entry(pattern: "AAA" | "ABB", value: number): RankingScenarioEntry {
	const iv = new PokemonIv({
		pokemonName: "Gengar",
		ingredient: pattern,
		level: 60,
	});
	return {
		id: pattern,
		iv,
		value,
		ingredientKey: pattern,
		ingredientSlots: [iv.ingredient1, iv.ingredient2, iv.ingredient3],
		ordinal: pattern === "AAA" ? 0 : 1,
	};
}

describe("scenario comparison position", () => {
	test("keeps all exact-tied ingredient configurations and the original candidate groups", () => {
		const entries = [entry("AAA", 10), entry("ABB", 10)];
		const groups: RankingScenarioGroup[] = [
			{ value: 10, entries },
			{ value: 5, entries: [] },
		];
		const position = locateScenarioComparison(groups, {
			status: "positive",
			value: 10,
		});
		expect(position).toEqual({ rank: 1, page: 1, groupIndex: 0 });
		expect(groups).toHaveLength(2);
		expect(groups[0].entries).toBe(entries);
		expect(entries.map((item) => item.ingredientKey)).toEqual(["AAA", "ABB"]);
	});

	test("uses unrounded values when finding the equivalent rank", () => {
		const groups = [
			{ value: 10.004, entries: [] },
			{ value: 10.002, entries: [] },
		];
		expect(
			locateScenarioComparison(groups, { status: "positive", value: 10.003 }),
		).toEqual({ rank: 2, page: 1, groupIndex: 1 });
		expect(groups.map((group) => group.value)).toEqual([10.004, 10.002]);
	});

	test("preserves the 100 candidate-group page boundary when comparison is between values", () => {
		const groups = Array.from({ length: 201 }, (_, index) => ({
			value: 300 - index,
			entries: [],
		}));
		const candidatePageTwo = groups.slice(100, 200);
		expect(
			locateScenarioComparison(groups, { status: "positive", value: 200.5 }),
		).toEqual({ rank: 101, page: 2, groupIndex: 100 });
		expect(groups).toHaveLength(201);
		expect(groups.slice(100, 200)).toEqual(candidatePageTwo);
		expect(
			locateScenarioComparison(groups, { status: "positive", value: 201 }),
		).toEqual({ rank: 100, page: 1, groupIndex: 99 });
	});

	test("keeps a below-all comparison on an extra page without shifting the full candidate page", () => {
		const groups = Array.from({ length: 100 }, (_, index) => ({
			value: 100 - index,
			entries: [],
		}));
		expect(
			locateScenarioComparison(groups, { status: "zero", value: 0 }),
		).toEqual({ rank: 101, page: 2, groupIndex: 100 });
		expect(groups).toHaveLength(100);
	});

	test("allows a comparison when no candidate is calculable", () => {
		expect(locateScenarioComparison([], { status: "zero", value: 0 })).toEqual({
			rank: 1,
			page: 1,
			groupIndex: 0,
		});
	});

	test("assigns no rank or page when absent or uncalculable", () => {
		const groups = [{ value: 5, entries: [] }];
		expect(locateScenarioComparison(groups, null)).toEqual({
			rank: null,
			page: null,
			groupIndex: null,
		});
		expect(
			locateScenarioComparison(groups, {
				status: "uncalculable",
				reason: "unknownIngredient",
			}),
		).toEqual({ rank: null, page: null, groupIndex: null });
	});
});

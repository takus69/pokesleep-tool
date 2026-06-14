import { describe, expect, test, vi } from "vitest";
import {
	calculateIngredientCount,
	calculateIngredientRanking,
	generateIngredientRankingCandidates,
	type IngredientRankingCandidate,
	type IngredientRankingStrengthCalculator,
	rankIngredientPokemon,
} from "./IngredientRanking";
import Nature from "./Nature";
import PokemonIv from "./PokemonIv";
import { createStrengthParameter } from "./PokemonStrength";
import SubSkillList from "./SubSkillList";

const parameter = createStrengthParameter({});

describe("generateIngredientRankingCandidates", () => {
	test("generates only final evolutions and preserves nature and sub-skills", () => {
		const baseIv = new PokemonIv({
			pokemonName: "Pikachu",
			level: 10,
			skillLevel: 6,
			nature: new Nature("Brave"),
			subSkills: new SubSkillList(),
			ribbon: 2,
			shiny: true,
			baseIngRate: 30,
			baseSkillRate: 8,
		});

		const candidates = generateIngredientRankingCandidates(baseIv, 59);
		const venusaur = candidates.find(
			(candidate) =>
				candidate.iv.pokemonName === "Venusaur" &&
				candidate.ingredientKey === "ABC",
		);

		expect(candidates.length).toBeGreaterThan(0);
		expect(
			candidates.every((candidate) => candidate.iv.pokemon.isFullyEvolved),
		).toBe(true);
		expect(
			candidates.some((candidate) => candidate.iv.pokemonName === "Bulbasaur"),
		).toBe(false);
		expect(venusaur).toBeDefined();
		expect(venusaur?.iv.level).toBe(59);
		expect(venusaur?.iv.ingredient).toBe("ABC");
		expect(venusaur?.iv.nature.name).toBe(baseIv.nature.name);
		expect(venusaur?.iv.subSkills).toBe(baseIv.subSkills);
		expect(venusaur?.iv.skillLevel).toBe(3);
		expect(venusaur?.iv.ribbon).toBe(0);
		expect(venusaur?.iv.shiny).toBe(false);
		expect(venusaur?.iv.baseIngRate).toBeUndefined();
		expect(venusaur?.iv.baseSkillRate).toBeUndefined();
	});

	test("uses all six normal patterns when ing3 exists", () => {
		const candidates = candidatesFor("Venusaur", 60);

		expect(candidates.map((candidate) => candidate.ingredientKey)).toEqual([
			"AAA",
			"AAB",
			"AAC",
			"ABA",
			"ABB",
			"ABC",
		]);
		expect(candidates.map((candidate) => candidate.ingredientOrder)).toEqual([
			0, 1, 2, 3, 4, 5,
		]);
	});

	test("excludes C patterns when ing3 does not exist", () => {
		const candidates = candidatesFor("Persian", 60);

		expect(candidates.map((candidate) => candidate.ingredientKey)).toEqual([
			"AAA",
			"AAB",
			"ABA",
			"ABB",
		]);
	});

	test("generates mythical Cartesian products from positive slot counts", () => {
		const mew = candidatesFor("Mew", 60);
		const darkrai = candidatesFor("Darkrai", 60);

		expect(mew).toHaveLength(7 * 7 * 8);
		expect(darkrai).toHaveLength(8 * 8 * 8);
		expect(new Set(mew.map((candidate) => candidate.ingredientKey)).size).toBe(
			mew.length,
		);
		expect(
			mew.some((candidate) => candidate.ingredientKey.startsWith("tail/")),
		).toBe(false);
		expect(
			mew.some((candidate) => candidate.ingredientKey.includes("/tail/")),
		).toBe(false);
		expect(
			mew.some((candidate) => candidate.ingredientKey.endsWith("/tail")),
		).toBe(true);
	});

	test("deduplicates identical mythical slot-name combinations", () => {
		const darkrai = candidatesFor("Darkrai", 60);

		expect(
			new Set(darkrai.map((candidate) => candidate.ingredientKey)).size,
		).toBe(darkrai.length);
	});
});

describe("calculateIngredientCount", () => {
	test.each([
		{ level: 29 as const, ingredient: "tomato" as const, expected: null },
		{ level: 30 as const, ingredient: "tomato" as const, expected: 12 },
		{ level: 59 as const, ingredient: "potato" as const, expected: null },
		{ level: 60 as const, ingredient: "potato" as const, expected: 12 },
	])("respects unlocked ingredients at level $level", ({
		level,
		ingredient,
		expected,
	}) => {
		const candidate = candidateFor("Venusaur", "ABC", level);
		const calculator = vi.fn(() =>
			strengthResult([{ name: ingredient, count: 12 }]),
		);

		expect(
			calculateIngredientCount(candidate, ingredient, parameter, calculator),
		).toEqual(expected === null ? null : { count: expected });
		expect(calculator).toHaveBeenCalledTimes(expected === null ? 0 : 1);
	});

	test("does not calculate a pattern that lacks the specified ingredient", () => {
		const calculator = vi.fn(() =>
			strengthResult([{ name: "potato", count: 100 }]),
		);

		expect(
			calculateIngredientCount(
				candidateFor("Venusaur", "AAA", 60),
				"potato",
				parameter,
				calculator,
			),
		).toBeNull();
		expect(calculator).not.toHaveBeenCalled();
	});

	test("excludes unknown unlocked slots safely", () => {
		const iv = new PokemonIv({
			pokemonName: "Darkrai",
			level: 60,
			mythIng1: "apple",
			mythIng2: "herb",
			mythIng3: "unknown",
		});
		const calculator = vi.fn(() =>
			strengthResult([{ name: "apple", count: 10 }]),
		);

		expect(
			calculateIngredientCount(
				makeCandidate(iv, "apple/herb/unknown"),
				"apple",
				parameter,
				calculator,
			),
		).toBeNull();
		expect(calculator).not.toHaveBeenCalled();
	});

	test("allows Mew using the ingredient rate from StrengthParameter", () => {
		const candidate = candidatesFor("Mew", 60)[0];

		const result = calculateIngredientCount(
			candidate,
			candidate.iv.mythIng1,
			parameter,
		);

		expect(result).not.toBeNull();
		expect(result?.count).toBeGreaterThan(0);
	});

	test("allows a rate-not-fixed candidate with a base ingredient-rate override", () => {
		const iv = new PokemonIv({
			pokemonName: "Mew",
			level: 60,
			mythIng1: "egg",
			mythIng2: "herb",
			mythIng3: "soy",
			baseIngRate: 20,
		});
		const calculator = vi.fn(() => strengthResult([{ name: "egg", count: 5 }]));

		expect(
			calculateIngredientCount(
				makeCandidate(iv, "egg/herb/soy"),
				"egg",
				parameter,
				calculator,
			),
		).toEqual({ count: 5 });
	});

	test.each([
		{ level: 59 as const, expected: null },
		{ level: 60 as const, expected: 8 },
	])("finds a mythical ingredient that appears only in slot 3 at level $level", ({
		level,
		expected,
	}) => {
		const iv = new PokemonIv({
			pokemonName: "Mew",
			level,
			mythIng1: "egg",
			mythIng2: "herb",
			mythIng3: "tail",
		});
		const calculator = vi.fn(() =>
			strengthResult([{ name: "tail", count: 8 }]),
		);

		expect(
			calculateIngredientCount(
				makeCandidate(iv, "egg/herb/tail"),
				"tail",
				parameter,
				calculator,
			),
		).toEqual(expected === null ? null : { count: expected });
		expect(calculator).toHaveBeenCalledTimes(expected === null ? 0 : 1);
	});

	test("turns calculator errors and invalid counts into exclusions", () => {
		const candidate = candidateFor("Venusaur", "AAA", 60);

		expect(
			calculateIngredientCount(candidate, "honey", parameter, () => {
				throw new Error("not calculable");
			}),
		).toBeNull();
		expect(
			calculateIngredientCount(candidate, "honey", parameter, () =>
				strengthResult([{ name: "honey", count: Number.NaN }]),
			),
		).toBeNull();
	});

	test("uses only the requested helper-produced ingredient count", () => {
		const candidate = candidateFor("Venusaur", "AAA", 60);
		const calculator: IngredientRankingStrengthCalculator = () =>
			strengthResult([
				{ name: "honey", count: 7 },
				{ name: "tomato", count: 999 },
			]);

		expect(
			calculateIngredientCount(candidate, "honey", parameter, calculator),
		).toEqual({ count: 7 });
	});
});

describe("calculateIngredientRanking", () => {
	test("uses the candidate level without mutating the StrengthParameter", () => {
		const fixedLevelParameter = createStrengthParameter({ level: 10 });
		const candidate = candidateFor("Venusaur", "AAA", 60);
		const calculator = vi.fn((iv: PokemonIv, received: typeof parameter) => {
			expect(iv.level).toBe(60);
			expect(received).not.toBe(fixedLevelParameter);
			expect(received.level).toBe(0);
			return strengthResult([{ name: "honey", count: 10 }]);
		});

		expect(
			calculateIngredientRanking(
				[candidate],
				"honey",
				fixedLevelParameter,
				calculator,
			),
		).toHaveLength(1);
		expect(fixedLevelParameter.level).toBe(10);
		expect(calculator).toHaveBeenCalledOnce();
	});

	test("sorts by requested ingredient count descending", () => {
		const candidates = [
			candidateFor("Venusaur", "AAA", 60, 0),
			candidateFor("Ditto", "AAA", 60, 1),
		];
		const calculator: IngredientRankingStrengthCalculator = (iv) =>
			strengthResult([
				{
					name: iv.pokemonName === "Ditto" ? "oil" : "honey",
					count: iv.pokemonName === "Ditto" ? 20 : 10,
				},
			]);

		const result = calculateIngredientRanking(
			candidates,
			"oil",
			parameter,
			calculator,
		);

		expect(result.map((entry) => entry.iv.pokemonName)).toEqual(["Ditto"]);
		expect(result[0].metric.count).toBe(20);
	});

	test("uses Pokedex number, form, pattern order, then ordinal as tie-breakers", () => {
		const candidates = [
			candidateFor("Toxtricity (Low Key)", "AAA", 60, 6, 0),
			candidateFor("Toxtricity (Amped)", "AAA", 60, 5, 1),
			candidateFor("Persian", "AAA", 60, 7, 0),
			candidateFor("Venusaur", "ABB", 60, 4, 4),
			candidateFor("Venusaur", "AAA", 60, 3, 0),
			candidateFor("Venusaur", "AAA", 60, 2, 0),
			candidateFor("Ditto", "AAA", 60, 1, 0),
		];
		const calculator: IngredientRankingStrengthCalculator = (iv) =>
			strengthResult([{ name: iv.ingredient1.name, count: 10 }]);

		const result = calculateIngredientRanking(
			candidates,
			"milk",
			parameter,
			calculator,
		);

		expect(
			result.map((entry) => [
				entry.iv.pokemonName,
				entry.ingredientOrder,
				entry.ordinal,
			]),
		).toEqual([
			["Persian", 0, 7],
			["Toxtricity (Amped)", 1, 5],
			["Toxtricity (Low Key)", 0, 6],
		]);

		const honeyResult = calculateIngredientRanking(
			candidates,
			"honey",
			parameter,
			() => strengthResult([{ name: "honey", count: 10 }]),
		);
		expect(
			honeyResult.map((entry) => [
				entry.iv.pokemonName,
				entry.ingredientOrder,
				entry.ordinal,
			]),
		).toEqual([
			["Venusaur", 0, 2],
			["Venusaur", 0, 3],
			["Venusaur", 4, 4],
		]);
	});

	test("rankIngredientPokemon combines generation and ranking", () => {
		const result = rankIngredientPokemon(
			new PokemonIv({ pokemonName: "Pikachu" }),
			29,
			"honey",
			parameter,
			(iv) =>
				strengthResult([
					{
						name: "honey",
						count: iv.pokemonName === "Venusaur" ? 10 : 0,
					},
				]),
		);

		expect(result.length).toBeGreaterThan(0);
		expect(result.every((entry) => entry.iv.pokemonName === "Venusaur")).toBe(
			true,
		);
	});

	test("supports the UI options API and exposes display fields", () => {
		const result = calculateIngredientRanking({
			baseIv: new PokemonIv({ pokemonName: "Pikachu" }),
			level: 29,
			ingredient: "honey",
			parameter,
			strengthCalculator: (iv) =>
				strengthResult([
					{
						name: "honey",
						count: iv.pokemonName === "Venusaur" ? 10 : 0,
					},
				]),
		});

		expect(result[0].pokemon).toBe(result[0].iv.pokemon);
		expect(result[0].ingredientSlots).toEqual([
			result[0].iv.ingredient1,
			result[0].iv.ingredient2,
			result[0].iv.ingredient3,
		]);
		expect(result[0].count).toBe(10);
	});
});

function candidatesFor(
	pokemonName: string,
	level: 29 | 30 | 59 | 60,
): IngredientRankingCandidate[] {
	return generateIngredientRankingCandidates(
		new PokemonIv({ pokemonName: "Pikachu" }),
		level,
	).filter((candidate) => candidate.iv.pokemonName === pokemonName);
}

function candidateFor(
	pokemonName: string,
	ingredientKey: string,
	level: 29 | 30 | 59 | 60,
	ordinal = 0,
	ingredientOrder = 0,
): IngredientRankingCandidate {
	const candidate = candidatesFor(pokemonName, level).find(
		(item) => item.ingredientKey === ingredientKey,
	);
	if (candidate === undefined) {
		throw new Error(`Missing candidate: ${pokemonName} ${ingredientKey}`);
	}
	return { ...candidate, ordinal, ingredientOrder };
}

function makeCandidate(
	iv: PokemonIv,
	ingredientKey: string,
): IngredientRankingCandidate {
	return { iv, ingredientKey, ingredientOrder: 0, ordinal: 0 };
}

function strengthResult(
	ingredients: Array<{ name: PokemonIv["ingredient1"]["name"]; count: number }>,
) {
	return {
		ingredients: ingredients.map(({ name, count }) => ({
			name,
			count,
			strength: 0,
			overflowCount: 0,
			helpCount: 0,
			countPerHelp: 0,
			slots: [],
		})),
	};
}

import { describe, expect, test, vi } from "vitest";
import Nature from "./Nature";
import {
	calculatePokemonRanking,
	calculatePokemonRankingAsync,
	groupPokemonRankingEntries,
	type PokemonRankingOptions,
	type PokemonRankingTarget,
} from "./PokemonRanking";
import PokemonStrength, { createStrengthParameter } from "./PokemonStrength";
import SubSkill from "./SubSkill";
import SubSkillList from "./SubSkillList";

const parameter = createStrengthParameter({});
const fixedNature = new Nature("Brave");
const fixedSubSkills = new SubSkillList({
	lv10: new SubSkill("Ingredient Finder M"),
	lv25: new SubSkill("Helping Speed M"),
});

const baseOptions = {
	target: "totalStrength",
	level: 60,
	ribbon: 2,
	nature: fixedNature,
	subSkills: fixedSubSkills,
	parameter,
	filters: {},
} satisfies PokemonRankingOptions;

describe("calculatePokemonRanking", () => {
	test("uses fixed traits and returns one best ingredient pattern per Pokemon", () => {
		const result = calculatePokemonRanking({
			...baseOptions,
			filters: { type: "ghost", specialty: "Ingredients", ingredient: "apple" },
			strengthCalculator: (iv) =>
				strengthResult({
					totalStrength:
						iv.pokemonName === "Skeledirge" && iv.ingredient === "ABC"
							? 10_000
							: iv.pokemon.id,
				}),
		});

		expect(result.length).toBeGreaterThan(0);
		expect(
			result.every(
				(entry) =>
					entry.pokemon.isFullyEvolved &&
					entry.pokemon.type === "ghost" &&
					entry.pokemon.specialty === "Ingredients" &&
					entry.iv.nature.name === fixedNature.name &&
					entry.iv.subSkills.isEqual(fixedSubSkills) &&
					entry.iv.ribbon === 2 &&
					entry.ingredientSlots.some((slot) => slot.name === "apple"),
			),
		).toBe(true);
		expect(new Set(result.map((entry) => entry.iv.idForm)).size).toBe(
			result.length,
		);
		expect(
			result.find((entry) => entry.iv.pokemonName === "Skeledirge")
				?.ingredientKey,
		).toBe("ABC");
	});

	test.each<{
		target: PokemonRankingTarget;
		ingredient?: "apple";
		expected: number;
	}>([
		{ target: "berryStrength", expected: 101 },
		{ target: "ingredientStrength", expected: 202 },
		{ target: "ingredientCount", expected: 7 },
		{ target: "specificIngredientCount", ingredient: "apple", expected: 4 },
		{ target: "totalStrength", expected: 303 },
		{ target: "skillCount", expected: 5 },
	])("evaluates $target", ({ target, ingredient, expected }) => {
		const result = calculatePokemonRanking({
			...baseOptions,
			target,
			ingredient,
			filters: { type: "fire" },
			strengthCalculator: () =>
				strengthResult({
					berryTotalStrength: 101,
					ingStrength: 202,
					totalStrength: 303,
					skillCount: 5,
					ingredients: [
						{ name: "apple", count: 4 },
						{ name: "sausage", count: 3 },
					],
				}),
		});

		expect(result.length).toBeGreaterThan(0);
		expect(result.every((entry) => entry.value === expected)).toBe(true);
	});

	test("requires an ingredient for the specific ingredient target", () => {
		expect(
			calculatePokemonRanking({
				...baseOptions,
				target: "specificIngredientCount",
			}),
		).toEqual([]);
	});

	test("combines filters and treats specialty as exact", () => {
		const result = calculatePokemonRanking({
			...baseOptions,
			filters: { type: "psychic", specialty: "Skills", ingredient: "apple" },
			strengthCalculator: (iv) =>
				strengthResult({ totalStrength: iv.pokemon.id }),
		});

		expect(result.length).toBeGreaterThan(0);
		expect(
			result.every(
				({ pokemon, ingredientSlots }) =>
					pokemon.type === "psychic" &&
					pokemon.specialty === "Skills" &&
					ingredientSlots.some((slot) => slot.name === "apple"),
			),
		).toBe(true);
		expect(result.some(({ pokemon }) => pokemon.specialty === "All")).toBe(
			false,
		);
	});

	test.each([
		{ level: 1, ingredient: "tomato" as const },
		{ level: 29, ingredient: "potato" as const },
	])("matches $ingredient in locked ingredient slots at level $level", ({
		level,
		ingredient,
	}) => {
		const result = calculatePokemonRanking({
			...baseOptions,
			level,
			filters: { type: "grass", specialty: "Ingredients", ingredient },
			strengthCalculator: (iv) =>
				strengthResult({ totalStrength: iv.pokemon.id }),
		});
		const venusaur = result.find(({ iv }) => iv.pokemonName === "Venusaur");

		expect(venusaur).toBeDefined();
		expect(venusaur?.ingredientSlots[0].name).not.toBe(ingredient);
		expect(
			venusaur?.ingredientSlots
				.slice(1)
				.some((slot) => slot.name === ingredient),
		).toBe(true);
	});

	test("keeps the requested nature instead of normalized Toxtricity forms", () => {
		const result = calculatePokemonRanking({
			...baseOptions,
			nature: new Nature("Hardy"),
			filters: { type: "poison" },
			strengthCalculator: (iv) =>
				strengthResult({ totalStrength: iv.pokemon.id }),
		});
		const toxtricity = result.filter(({ iv }) =>
			iv.pokemonName.startsWith("Toxtricity"),
		);

		expect(toxtricity).toHaveLength(1);
		expect(toxtricity[0].iv.pokemonName).toBe("Toxtricity (Amped)");
		expect(toxtricity[0].iv.nature.name).toBe("Hardy");
	});

	test("sorts descending with stable Pokedex and form tie-breaks", () => {
		const result = calculatePokemonRanking({
			...baseOptions,
			level: 9,
			strengthCalculator: (iv) =>
				strengthResult({
					totalStrength: iv.pokemonName === "Persian" ? 20 : 10,
				}),
		});

		expect(result[0].iv.pokemonName).toBe("Persian");
		expect(result.slice(1).map(({ pokemon }) => pokemon.id)).toEqual(
			result
				.slice(1)
				.map(({ pokemon }) => pokemon.id)
				.sort((a, b) => a - b),
		);
	});

	test("groups equal values after applying the same stable order", () => {
		const entries = calculatePokemonRanking({
			...baseOptions,
			level: 9,
			filters: { type: "fire" },
			strengthCalculator: (iv) =>
				strengthResult({ totalStrength: iv.pokemon.id % 2 }),
		});
		const groups = groupPokemonRankingEntries(entries);

		expect(groups.map((group) => group.value)).toEqual([1, 0]);
		expect(groups.flatMap((group) => group.entries)).toEqual(entries);
	});

	test("uses PokemonStrength by default", () => {
		const calculateSpy = vi.spyOn(PokemonStrength.prototype, "calculate");
		const result = calculatePokemonRanking({
			...baseOptions,
			level: 9,
			filters: { type: "fire" },
		});

		expect(result.length).toBeGreaterThan(0);
		expect(calculateSpy).toHaveBeenCalled();
		calculateSpy.mockRestore();
	});
});

describe("calculatePokemonRankingAsync", () => {
	test("matches the synchronous result", async () => {
		const options = {
			...baseOptions,
			level: 9,
			strengthCalculator: (iv) =>
				strengthResult({ totalStrength: iv.pokemon.id }),
		} satisfies PokemonRankingOptions;

		expect(await calculatePokemonRankingAsync(options)).toEqual(
			calculatePokemonRanking(options),
		);
	});

	test("rejects immediately when already aborted", async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(
			calculatePokemonRankingAsync({
				...baseOptions,
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	test("aborts while evaluating candidates", async () => {
		const controller = new AbortController();
		let calls = 0;
		await expect(
			calculatePokemonRankingAsync({
				...baseOptions,
				signal: controller.signal,
				strengthCalculator: () => {
					calls += 1;
					if (calls === 1) controller.abort();
					return strengthResult({ totalStrength: 1 });
				},
			}),
		).rejects.toMatchObject({ name: "AbortError" });
	});
});

function strengthResult({
	ingredients = [],
	...metrics
}: {
	ingredients?: Array<{ name: "apple" | "sausage"; count: number }>;
	totalStrength?: number;
	berryTotalStrength?: number;
	ingStrength?: number;
	skillCount?: number;
}) {
	return {
		...metrics,
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

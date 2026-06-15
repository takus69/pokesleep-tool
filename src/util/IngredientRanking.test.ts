import { describe, expect, test, vi } from "vitest";
import {
	calculateIngredientCount,
	calculateIngredientRanking,
	calculateIngredientRankingAsync,
	generateIngredientRankingCandidates,
	type IngredientRankingCandidate,
	type IngredientRankingStrengthCalculator,
	rankIngredientPokemon,
} from "./IngredientRanking";
import Nature from "./Nature";
import PokemonIv from "./PokemonIv";
import PokemonStrength, { createStrengthParameter } from "./PokemonStrength";
import SubSkill from "./SubSkill";
import SubSkillList from "./SubSkillList";

const parameter = createStrengthParameter({});

describe("generateIngredientRankingCandidates", () => {
	test("generates only final evolutions with a neutral baseline IV", () => {
		const inputSubSkills = new SubSkillList({
			lv10: new SubSkill("Ingredient Finder M"),
		});
		const baseIv = new PokemonIv({
			pokemonName: "Pikachu",
			level: 10,
			nature: new Nature("Brave"),
			subSkills: inputSubSkills,
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
		expect(venusaur?.iv.nature.isNeautral).toBe(true);
		expect(venusaur?.iv.nature.name).not.toBe(baseIv.nature.name);
		expect(venusaur?.iv.activeSubSkills).toEqual([]);
		expect(venusaur?.iv.subSkills).not.toBe(inputSubSkills);
	});

	test("candidate generation does not depend on baseIv", () => {
		const first = generateIngredientRankingCandidates(
			new PokemonIv({
				pokemonName: "Pikachu",
				nature: new Nature("Brave"),
				subSkills: new SubSkillList({
					lv10: new SubSkill("Ingredient Finder M"),
				}),
			}),
			60,
		);
		const second = generateIngredientRankingCandidates(
			new PokemonIv({
				pokemonName: "Mew",
				nature: new Nature("Quiet"),
				subSkills: new SubSkillList({
					lv10: new SubSkill("Berry Finding S"),
				}),
			}),
			60,
		);
		const summarize = (candidate: IngredientRankingCandidate) => ({
			pokemon: candidate.iv.pokemonName,
			level: candidate.iv.level,
			ingredientKey: candidate.ingredientKey,
			nature: candidate.iv.nature.name,
			subSkills: candidate.iv.activeSubSkills.map((skill) => skill.name),
		});

		expect(first.map(summarize)).toEqual(second.map(summarize));
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

	test("generates and deduplicates mythical Cartesian products", () => {
		const mew = candidatesFor("Mew", 60);
		const darkrai = candidatesFor("Darkrai", 60);

		expect(mew).toHaveLength(7 * 7 * 8);
		expect(darkrai).toHaveLength(8 * 8 * 8);
		expect(new Set(mew.map((candidate) => candidate.ingredientKey)).size).toBe(
			mew.length,
		);
		expect(
			new Set(darkrai.map((candidate) => candidate.ingredientKey)).size,
		).toBe(darkrai.length);
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
});

describe("calculateIngredientCount", () => {
	test.each([
		{ level: 29, ingredient: "tomato" as const, expected: null },
		{ level: 30, ingredient: "tomato" as const, expected: 12 },
		{ level: 59, ingredient: "potato" as const, expected: null },
		{ level: 60, ingredient: "potato" as const, expected: 12 },
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
		{ level: 59, expected: null },
		{ level: 60, expected: 8 },
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
		const calculator: IngredientRankingStrengthCalculator = () =>
			strengthResult([
				{ name: "honey", count: 7 },
				{ name: "tomato", count: 999 },
			]);

		expect(
			calculateIngredientCount(
				candidateFor("Venusaur", "AAA", 60),
				"honey",
				parameter,
				calculator,
			),
		).toEqual({ count: 7 });
	});
});

describe("calculateIngredientRanking", () => {
	test("keeps only the best ingredient pattern per Pokemon", () => {
		const aaa = candidateFor("Venusaur", "AAA", 9, 0, 0);
		const aab = candidateFor("Venusaur", "AAB", 9, 1, 1);
		const calculator: IngredientRankingStrengthCalculator = (iv) =>
			strengthResult([
				{
					name: "honey",
					count: iv.ingredient === "AAB" ? 20 : 10,
				},
			]);

		const result = calculateIngredientRanking(
			[aaa, aab],
			"honey",
			parameter,
			calculator,
		);

		expect(result).toHaveLength(1);
		expect(result[0].ingredientKey).toBe("AAB");
	});

	test("uses ingredient pattern order as the equal-count tie-break", () => {
		const aaa = candidateFor("Venusaur", "AAA", 9, 1, 0);
		const aab = candidateFor("Venusaur", "AAB", 9, 0, 1);

		const result = calculateIngredientRanking(
			[aab, aaa],
			"honey",
			parameter,
			() => strengthResult([{ name: "honey", count: 10 }]),
		);

		expect(result).toHaveLength(1);
		expect(result[0].ingredientKey).toBe("AAA");
	});

	test("evaluates all 25 natures after baseline selection", () => {
		const evaluatedNatures: string[] = [];
		let calls = 0;
		const calculator: IngredientRankingStrengthCalculator = (iv) => {
			calls += 1;
			if (calls > 1) {
				evaluatedNatures.push(iv.nature.name);
			}
			return strengthResult([{ name: "honey", count: 10 }]);
		};

		calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", 9)],
			"honey",
			parameter,
			calculator,
		);

		expect(calls).toBe(1 + 25);
		expect(evaluatedNatures).toEqual(
			Nature.allNatures.map((nature) => nature.name),
		);
	});

	test.each([
		{ level: 9, combinations: 1 },
		{ level: 10, combinations: 17 },
		{ level: 25, combinations: 136 },
		{ level: 50, combinations: 680 },
	])("evaluates canonical sub-skill combinations at level $level", ({
		level,
		combinations,
	}) => {
		const evaluated = new Set<string>();
		let calls = 0;
		const calculator: IngredientRankingStrengthCalculator = (iv) => {
			calls += 1;
			if (calls > 1) {
				evaluated.add(iv.activeSubSkills.map((skill) => skill.name).join("/"));
			}
			return strengthResult([{ name: "honey", count: 10 }]);
		};

		calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", level)],
			"honey",
			parameter,
			calculator,
		);

		expect(calls).toBe(1 + 25 * combinations);
		expect(evaluated.size).toBe(combinations);
	});

	test("does not inherit nature or sub-skills from the current IV", () => {
		const inheritedIv = new PokemonIv({
			...candidateFor("Venusaur", "AAA", 10).iv.toProps(),
			nature: new Nature("Brave"),
			subSkills: new SubSkillList({
				lv10: new SubSkill("Ingredient Finder M"),
			}),
		});
		const evaluated: PokemonIv[] = [];

		calculateIngredientRanking(
			[makeCandidate(inheritedIv, "AAA")],
			"honey",
			parameter,
			(iv) => {
				evaluated.push(iv);
				return strengthResult([{ name: "honey", count: 10 }]);
			},
		);

		expect(evaluated[0].nature.isNeautral).toBe(true);
		expect(evaluated[0].activeSubSkills).toEqual([]);
		expect(evaluated[1].nature.name).toBe(Nature.allNatures[0].name);
		expect(evaluated[1].activeSubSkills[0].name).toBe(
			SubSkill.allSubSkills[0].name,
		);
	});

	test("collapses exact equal counts to the first stable representative", () => {
		const result = calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", 10)],
			"honey",
			parameter,
			() => strengthResult([{ name: "honey", count: 10 }]),
		);

		expect(result).toHaveLength(1);
		expect(result[0].iv.nature.name).toBe(Nature.allNatures[0].name);
		expect(result[0].iv.activeSubSkills.map((skill) => skill.name)).toEqual([
			SubSkill.allSubSkills[0].name,
		]);
	});

	test("default-calculator cache preserves distinct counts and representatives", () => {
		const candidate = candidateFor("Venusaur", "AAA", 10);
		const cached = calculateIngredientRanking([candidate], "honey", parameter);
		const uncached = calculateIngredientRanking(
			[candidate],
			"honey",
			parameter,
			(iv, strengthParameter) =>
				new PokemonStrength(iv, strengthParameter).calculate(),
		);
		const summarize = (entry: (typeof cached)[number]) => ({
			count: entry.count,
			nature: entry.iv.nature.name,
			subSkills: entry.iv.activeSubSkills.map((skill) => skill.name),
		});

		expect(cached.length).toBeGreaterThan(1);
		expect(cached.map(summarize)).toEqual(uncached.map(summarize));
	});

	test("applies limit only after the final stable sort", () => {
		const calculator: IngredientRankingStrengthCalculator = (iv) =>
			strengthResult([
				{
					name: "honey",
					count: iv.pokemon.id * 100 + Nature.allNatures.indexOf(iv.nature),
				},
			]);
		const options = {
			level: 9,
			ingredient: "honey" as const,
			parameter,
			strengthCalculator: calculator,
		};
		const all = calculateIngredientRanking(options);
		const limited = calculateIngredientRanking({ ...options, limit: 7 });

		expect(limited).toEqual(all.slice(0, 7));
		expect(limited).toHaveLength(7);
	});

	test("async ranking matches synchronous ranking including limit", async () => {
		const calculator: IngredientRankingStrengthCalculator = (iv) =>
			strengthResult([
				{
					name: "honey",
					count:
						iv.pokemon.id +
						Nature.allNatures.indexOf(iv.nature) / Nature.allNatures.length,
				},
			]);
		const options = {
			level: 9,
			ingredient: "honey" as const,
			parameter,
			strengthCalculator: calculator,
			limit: 12,
		};

		const synchronous = calculateIngredientRanking(options);
		const asynchronous = await calculateIngredientRankingAsync(options);

		expect(asynchronous).toEqual(synchronous);
		expect(asynchronous).toHaveLength(12);
	});

	test("async ranking rejects immediately when already aborted", async () => {
		const controller = new AbortController();
		controller.abort();

		await expect(
			calculateIngredientRankingAsync({
				level: 9,
				ingredient: "honey",
				parameter,
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
	});

	test("async ranking aborts during ingredient candidate selection", async () => {
		const controller = new AbortController();
		let abortScheduled = false;
		let combinationEvaluationStarted = false;

		await expect(
			calculateIngredientRankingAsync({
				level: 50,
				ingredient: "honey",
				parameter,
				signal: controller.signal,
				strengthCalculator: (iv) => {
					if (iv.activeSubSkills.length > 0) {
						combinationEvaluationStarted = true;
					}
					if (!abortScheduled) {
						abortScheduled = true;
						setTimeout(() => controller.abort(), 0);
					}
					return strengthResult([{ name: "honey", count: 10 }]);
				},
			}),
		).rejects.toMatchObject({ name: "AbortError" });

		expect(abortScheduled).toBe(true);
		expect(combinationEvaluationStarted).toBe(false);
	});

	test("async ranking aborts during nature and sub-skill evaluation", async () => {
		const controller = new AbortController();
		let evaluationCalls = 0;
		let abortScheduled = false;

		await expect(
			calculateIngredientRankingAsync({
				level: 50,
				ingredient: "honey",
				parameter,
				signal: controller.signal,
				strengthCalculator: (iv) => {
					if (iv.activeSubSkills.length > 0) {
						evaluationCalls += 1;
						if (!abortScheduled) {
							abortScheduled = true;
							setTimeout(() => controller.abort(), 0);
						}
					}
					return strengthResult([{ name: "honey", count: 10 }]);
				},
			}),
		).rejects.toMatchObject({ name: "AbortError" });

		expect(evaluationCalls).toBeGreaterThan(0);
		expect(evaluationCalls).toBeLessThan(25 * 680);
	});

	test("options API works without baseIv", () => {
		const result = calculateIngredientRanking({
			level: 9,
			ingredient: "honey",
			parameter,
			strengthCalculator: (iv) =>
				strengthResult([
					{
						name: "honey",
						count: iv.pokemonName === "Venusaur" ? 10 : 0,
					},
				]),
			limit: 1,
		});

		expect(result).toHaveLength(1);
		expect(result[0].iv.pokemonName).toBe("Venusaur");
	});

	test("does not collapse equal counts across different Pokemon", () => {
		const result = calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", 9), candidateFor("Pinsir", "AAA", 9)],
			"honey",
			parameter,
			() => strengthResult([{ name: "honey", count: 10 }]),
		);

		expect(result.map((entry) => entry.iv.pokemonName)).toEqual([
			"Venusaur",
			"Pinsir",
		]);
	});

	test("sorts descending, then by Pokedex number and form", () => {
		const calculator: IngredientRankingStrengthCalculator = (iv) =>
			strengthResult([
				{
					name: iv.ingredient1.name,
					count:
						iv.pokemonName === "Persian"
							? 20
							: iv.pokemonName.startsWith("Toxtricity")
								? 10
								: 5,
				},
			]);
		const result = calculateIngredientRanking(
			[
				candidateFor("Toxtricity (Low Key)", "AAA", 9),
				candidateFor("Toxtricity (Amped)", "AAA", 9),
				candidateFor("Persian", "AAA", 9),
			],
			"milk",
			parameter,
			calculator,
		);

		expect(result.map((entry) => entry.iv.pokemonName)).toEqual([
			"Persian",
			"Toxtricity (Amped)",
			"Toxtricity (Low Key)",
		]);
		expect(result.map((entry) => entry.count)).toEqual([20, 10, 10]);
	});

	test("uses the candidate level without mutating StrengthParameter", () => {
		const fixedLevelParameter = createStrengthParameter({ level: 10 });
		const calculator = vi.fn((iv: PokemonIv, received: typeof parameter) => {
			expect(iv.level).toBe(9);
			expect(received).not.toBe(fixedLevelParameter);
			expect(received.level).toBe(0);
			return strengthResult([{ name: "honey", count: 10 }]);
		});

		calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", 9)],
			"honey",
			fixedLevelParameter,
			calculator,
		);

		expect(fixedLevelParameter.level).toBe(10);
		expect(calculator).toHaveBeenCalledTimes(26);
	});

	test("excludes candidates that cannot be calculated", () => {
		const result = calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", 9)],
			"honey",
			parameter,
			() => {
				throw new Error("not calculable");
			},
		);

		expect(result).toEqual([]);
	});

	test("rankIngredientPokemon and the options API expose display fields", () => {
		const result = rankIngredientPokemon(
			new PokemonIv({ pokemonName: "Pikachu" }),
			9,
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

		expect(result).toHaveLength(1);
		expect(result[0].iv.pokemonName).toBe("Venusaur");
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
	level: number,
): IngredientRankingCandidate[] {
	return generateIngredientRankingCandidates(
		new PokemonIv({ pokemonName: "Pikachu" }),
		level,
	).filter((candidate) => candidate.iv.pokemonName === pokemonName);
}

function candidateFor(
	pokemonName: string,
	ingredientKey: string,
	level: number,
	ordinal = 0,
	ingredientOrder?: number,
): IngredientRankingCandidate {
	const candidate = candidatesFor(pokemonName, level).find(
		(item) => item.ingredientKey === ingredientKey,
	);
	if (candidate === undefined) {
		throw new Error(`Missing candidate: ${pokemonName} ${ingredientKey}`);
	}
	return {
		...candidate,
		ordinal,
		ingredientOrder: ingredientOrder ?? candidate.ingredientOrder,
	};
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

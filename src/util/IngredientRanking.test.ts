import { describe, expect, test, vi } from "vitest";
import {
	calculateIngredientCount,
	calculateIngredientRanking,
	calculateIngredientRankingAsync,
	createIngredientRankingBaselineIv,
	evaluatePokemonIngredient,
	generateIngredientRankingCandidates,
	groupIngredientRankingEntries,
	type IngredientRankingCandidate,
	type IngredientRankingEntry,
	type IngredientRankingStrengthCalculator,
	mergeIngredientRankingComparison,
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

	test("generates candidates for only the requested final Pokemon/form", () => {
		const candidates = generateIngredientRankingCandidates(
			undefined,
			60,
			"Skeledirge",
		);

		expect(candidates).toHaveLength(6);
		expect(
			candidates.every(
				(candidate) => candidate.iv.pokemonName === "Skeledirge",
			),
		).toBe(true);
		expect(
			generateIngredientRankingCandidates(undefined, 60, "Fuecoco"),
		).toEqual([]);
	});

	test.each([
		"Toxtricity (Amped)",
		"Toxtricity (Low Key)",
	])("keeps Toxtricity form candidates separate for %s", (pokemonName) => {
		const candidates = generateIngredientRankingCandidates(
			undefined,
			60,
			pokemonName,
		);

		expect(candidates).toHaveLength(6);
		expect(
			candidates.every((candidate) => candidate.iv.pokemonName === pokemonName),
		).toBe(true);
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

describe("comparison calculation layer", () => {
	test("creates a neutral no-subskill IV from the top ingredient pattern", () => {
		const iv = createIngredientRankingBaselineIv({
			pokemonName: "Skeledirge",
			level: 60,
			ingredient: "apple",
			parameter,
			strengthCalculator: (candidate) =>
				strengthResult([
					{
						name: "apple",
						count: candidate.ingredient === "ABC" ? 30 : 10,
					},
				]),
		});

		expect(iv?.pokemonName).toBe("Skeledirge");
		expect(iv?.level).toBe(60);
		expect(iv?.ingredient).toBe("ABC");
		expect(iv?.nature.name).toBe("Serious");
		expect(iv?.activeSubSkills).toEqual([]);
	});

	test.each([
		{ pokemonName: "Toxtricity (Amped)", nature: "Hardy" },
		{ pokemonName: "Toxtricity (Low Key)", nature: "Serious" },
	])("uses the form-compatible neutral nature for $pokemonName", ({
		pokemonName,
		nature,
	}) => {
		const iv = createIngredientRankingBaselineIv({
			pokemonName,
			level: 60,
			ingredient: "milk",
			parameter,
			strengthCalculator: () => strengthResult([{ name: "milk", count: 10 }]),
		});

		expect(iv?.pokemonName).toBe(pokemonName);
		expect(iv?.nature.name).toBe(nature);
		expect(iv?.activeSubSkills).toEqual([]);
	});

	test("returns null when no ingredient pattern can provide the target", () => {
		expect(
			createIngredientRankingBaselineIv({
				pokemonName: "Skeledirge",
				level: 60,
				ingredient: "milk",
				parameter,
			}),
		).toBeNull();
	});

	test.each([
		{ level: 29, ingredient: "tomato" as const, status: "zero" },
		{ level: 30, ingredient: "tomato" as const, status: "positive" },
		{ level: 59, ingredient: "potato" as const, status: "zero" },
		{ level: 60, ingredient: "potato" as const, status: "positive" },
	])("distinguishes ingredient unlock boundaries at level $level", ({
		level,
		ingredient,
		status,
	}) => {
		const calculator = vi.fn(() =>
			strengthResult([{ name: ingredient, count: 12 }]),
		);
		const result = evaluatePokemonIngredient(
			candidateFor("Venusaur", "ABC", level).iv,
			ingredient,
			parameter,
			calculator,
		);

		expect(result.status).toBe(status);
		expect(calculator).toHaveBeenCalledTimes(status === "positive" ? 1 : 0);
	});

	test("uses the Pokemon level and overrides parameter.level to zero", () => {
		const fixedLevelParameter = createStrengthParameter({ level: 100 });
		const calculator = vi.fn(
			(iv: PokemonIv, received: typeof fixedLevelParameter) => {
				expect(iv.level).toBe(30);
				expect(received.level).toBe(0);
				return strengthResult([{ name: "tomato", count: 7 }]);
			},
		);

		expect(
			evaluatePokemonIngredient(
				candidateFor("Venusaur", "ABC", 30).iv,
				"tomato",
				fixedLevelParameter,
				calculator,
			),
		).toEqual({ status: "positive", count: 7 });
		expect(fixedLevelParameter.level).toBe(100);
	});

	test("distinguishes zero and uncalculable results", () => {
		const iv = candidateFor("Venusaur", "AAA", 60).iv;

		expect(evaluatePokemonIngredient(iv, "potato", parameter)).toEqual({
			status: "zero",
			count: 0,
		});
		expect(
			evaluatePokemonIngredient(iv, "honey", parameter, () => {
				throw new Error("not calculable");
			}),
		).toEqual({ status: "uncalculable" });
	});

	test("groups exact counts while preserving stable entry order", () => {
		const first = makeEntry(candidateFor("Pinsir", "AAA", 60), 10);
		const second = makeEntry(candidateFor("Venusaur", "AAA", 60), 20);
		const third = makeEntry(candidateFor("Ditto", "AAA", 60), 10);

		const groups = groupIngredientRankingEntries([first, third, second]);

		expect(groups.map((group) => group.count)).toEqual([20, 10]);
		expect(groups[1].entries).toEqual([first, third]);
	});

	test("merges equal and between-group comparisons with equivalent ranks", () => {
		const groups = [
			{ count: 100, entries: [] },
			{ count: 80, entries: [] },
			{ count: 60, entries: [] },
		];

		const tied = mergeIngredientRankingComparison(groups, {
			status: "positive",
			count: 80,
		});
		const between = mergeIngredientRankingComparison(groups, {
			status: "positive",
			count: 90,
		});

		expect(tied).toMatchObject({ rank: 2, groupIndex: 1, page: 0 });
		expect(tied.groups).toHaveLength(3);
		expect(tied.groups[1].includesComparison).toBe(true);
		expect(between).toMatchObject({ rank: 2, groupIndex: 1, page: 0 });
		expect(between.groups.map((group) => group.count)).toEqual([
			100, 90, 80, 60,
		]);
	});

	test("places zero last and leaves uncalculable without a rank", () => {
		const groups = [
			{ count: 30, entries: [] },
			{ count: 10, entries: [] },
		];
		const zero = mergeIngredientRankingComparison(groups, {
			status: "zero",
			count: 0,
		});
		const uncalculable = mergeIngredientRankingComparison(groups, {
			status: "uncalculable",
		});

		expect(zero).toMatchObject({ rank: 3, groupIndex: 2, page: 0 });
		expect(zero.groups.at(-1)).toMatchObject({
			count: 0,
			includesComparison: true,
		});
		expect(uncalculable).toMatchObject({
			rank: null,
			groupIndex: null,
			page: null,
		});
		expect(uncalculable.groups).toHaveLength(2);
	});

	test("returns a 100-row page index for the comparison group", () => {
		const groups = Array.from({ length: 101 }, (_, index) => ({
			count: 200 - index,
			entries: [],
		}));
		const result = mergeIngredientRankingComparison(groups, {
			status: "positive",
			count: 100,
		});

		expect(result).toMatchObject({
			rank: 101,
			groupIndex: 100,
			page: 1,
		});
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

	test("single-Pokemon ranking never calculates another Pokemon", () => {
		const calculator = vi.fn((iv: PokemonIv) => {
			expect(iv.pokemonName).toBe("Skeledirge");
			return strengthResult([{ name: "apple", count: 10 }]);
		});

		const result = calculateIngredientRanking({
			pokemonName: "Skeledirge",
			level: 9,
			ingredient: "apple",
			parameter,
			strengthCalculator: calculator,
		});

		expect(result).toHaveLength(1);
		expect(result[0].iv.pokemonName).toBe("Skeledirge");
		expect(calculator).toHaveBeenCalledTimes(6 + 1 + 21);
	});

	test.each([
		{ pokemonName: "Toxtricity (Amped)", baselineNature: "Hardy" },
		{ pokemonName: "Toxtricity (Low Key)", baselineNature: "Serious" },
	])("keeps $pokemonName results separate with its neutral baseline", ({
		pokemonName,
		baselineNature,
	}) => {
		const calculatedPokemonNames = new Set<string>();
		const result = calculateIngredientRanking({
			pokemonName,
			level: 9,
			ingredient: "milk",
			parameter,
			strengthCalculator: (iv) => {
				calculatedPokemonNames.add(iv.pokemonName);
				return strengthResult([{ name: "milk", count: 10 }]);
			},
		});

		expect(calculatedPokemonNames).toEqual(new Set([pokemonName]));
		expect(result).toHaveLength(1);
		expect(result[0].iv.pokemonName).toBe(pokemonName);
		expect(result[0].iv.nature.name).toBe(baselineNature);
		expect(result[0].iv.activeSubSkills).toEqual([]);
	});

	test("returns no ranking when the Pokemon has no target ingredient", () => {
		const calculator = vi.fn(() =>
			strengthResult([{ name: "milk", count: 10 }]),
		);

		const result = calculateIngredientRanking({
			pokemonName: "Skeledirge",
			level: 60,
			ingredient: "milk",
			parameter,
			strengthCalculator: calculator,
		});

		expect(result).toEqual([]);
		expect(calculator).not.toHaveBeenCalled();
	});

	test("selects the best normal ingredient pattern before ranking", () => {
		const result = calculateIngredientRanking({
			pokemonName: "Skeledirge",
			level: 60,
			ingredient: "apple",
			parameter,
			strengthCalculator: (iv) =>
				strengthResult([
					{
						name: "apple",
						count: iv.ingredient === "ABC" ? 30 : 10,
					},
				]),
		});

		expect(result).toHaveLength(1);
		expect(result[0].ingredientKey).toBe("ABC");
	});

	test("selects the best mythical ingredient pattern before ranking", () => {
		const result = calculateIngredientRanking({
			pokemonName: "Mew",
			level: 60,
			ingredient: "tail",
			parameter,
			strengthCalculator: (iv) =>
				strengthResult([
					{
						name: "tail",
						count: iv.mythIng1 === "egg" && iv.mythIng2 === "herb" ? 30 : 10,
					},
				]),
		});

		expect(result).toHaveLength(1);
		expect(result[0].ingredientKey).toBe("egg/herb/tail");
	});

	test("evaluates 21 ranking natures with neutral natures collapsed to Serious", () => {
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

		expect(calls).toBe(1 + 1 + 21);
		expect(evaluatedNatures[0]).toBe("Serious");
		expect(evaluatedNatures.slice(1)).toEqual([
			"Serious",
			...Nature.allNatures
				.filter((nature) => !nature.isNeautral)
				.map((nature) => nature.name),
		]);
	});

	test.each([
		{ level: 9, combinations: 1 },
		{ level: 10, combinations: 12 },
		{ level: 25, combinations: 66 },
		{ level: 50, combinations: 220 },
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

		expect(calls).toBe(1 + 1 + 21 * combinations);
		expect(evaluated.size).toBe(level < 10 ? 1 : combinations + 1);
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
		expect(evaluated[1].nature.name).toBe("Serious");
		expect(evaluated[1].activeSubSkills).toEqual([]);
		expect(evaluated[2].nature.name).toBe("Serious");
		expect(evaluated[2].activeSubSkills[0].name).toBe("Berry Finding S");
	});

	test("collapses exact equal counts to the first stable representative", () => {
		const result = calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", 10)],
			"honey",
			parameter,
			() => strengthResult([{ name: "honey", count: 10 }]),
		);

		expect(result).toHaveLength(1);
		expect(result[0].iv.nature.name).toBe("Serious");
		expect(result[0].iv.activeSubSkills).toEqual([]);
	});

	test("includes the Serious no-subskill baseline as a ranking candidate", () => {
		const result = calculateIngredientRanking(
			[candidateFor("Venusaur", "AAA", 10)],
			"honey",
			parameter,
			(iv) =>
				strengthResult([
					{
						name: "honey",
						count: iv.activeSubSkills.length === 0 ? 1 : 2,
					},
				]),
		);
		const baseline = result.find((entry) => entry.count === 1);

		expect(baseline?.iv.nature.name).toBe("Serious");
		expect(baseline?.iv.activeSubSkills).toEqual([]);
	});

	test("uses only the 12 ingredient-ranking sub-skills at level 60", () => {
		const evaluated = new Set<string>();
		let calls = 0;

		calculateIngredientRanking({
			pokemonName: "Skeledirge",
			level: 60,
			ingredient: "apple",
			parameter,
			strengthCalculator: (iv) => {
				calls += 1;
				if (iv.activeSubSkills.length === 3) {
					evaluated.add(
						iv.activeSubSkills.map((skill) => skill.name).join("/"),
					);
				}
				return strengthResult([{ name: "apple", count: 10 }]);
			},
		});

		expect(evaluated.size).toBe(220);
		expect(
			[...evaluated].some((combination) =>
				[
					"Dream Shard Bonus",
					"Research EXP Bonus",
					"Sleep EXP Bonus",
					"Skill Level Up M",
					"Skill Level Up S",
				].some((name) => combination.includes(name)),
			),
		).toBe(false);
		expect(
			[...evaluated].some((value) => value.includes("Energy Recovery Bonus")),
		).toBe(true);
		expect(calls).toBe(6 + 1 + 21 * 220);
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
		expect(evaluationCalls).toBeLessThan(21 * 220);
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
		expect(calculator).toHaveBeenCalledTimes(23);
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

function makeEntry(
	candidate: IngredientRankingCandidate,
	count: number,
): IngredientRankingEntry {
	return {
		...candidate,
		pokemon: candidate.iv.pokemon,
		ingredientSlots: [
			candidate.iv.ingredient1,
			candidate.iv.ingredient2,
			candidate.iv.ingredient3,
		],
		count,
		metric: { count },
	};
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

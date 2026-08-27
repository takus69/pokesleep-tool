import { describe, expect, test, vi } from "vitest";
import pokemons from "../data/pokemons";
import { getMaxSkillLevel, matchMainSkillName } from "./MainSkill";
import Nature from "./Nature";
import PokemonIv from "./PokemonIv";
import PokemonStrength, {
	createStrengthParameter,
	getCurrentFavoriteBerries,
} from "./PokemonStrength";
import {
	calculateRankingScenarioAsync,
	createRankingEnvironment,
	evaluateRankingComparison,
	type RankingScenarioConfig,
	type RankingScenarioPartialResult,
	validateRankingScenario,
} from "./RankingScenario";
import SubSkill from "./SubSkill";
import SubSkillList from "./SubSkillList";

const environment = createStrengthParameter({});
function config(
	patch: Partial<RankingScenarioConfig> = {},
): RankingScenarioConfig {
	return {
		purpose: "ingredients",
		target: "ingredientStrength",
		pokemonName: "Venusaur",
		level: 60,
		skillLevel: "max",
		ribbon: 0,
		nature: new Nature("Serious"),
		subSkills: new SubSkillList(),
		ingredientPattern: "ABC",
		mythical: "exclude",
		includeUnevolved: false,
		...patch,
	};
}
const constant = () => ({
	ingredients: [],
	ingStrength: 10,
	berryTotalStrength: 10,
	totalStrength: 10,
	skillCount: 10,
});
const fast = { strengthCalculator: constant };

describe("scenario candidate generation", () => {
	test("keeps every valid pattern and tied candidate, including locked slots and directly selected pre-evolutions", async () => {
		const result = await calculateRankingScenarioAsync(
			config({ pokemonName: "Bulbasaur", level: 1 }),
			environment,
			fast,
		);
		expect(result.entries.map((e) => e.ingredientKey)).toEqual([
			"AAA",
			"AAB",
			"AAC",
			"ABA",
			"ABB",
			"ABC",
		]);
		expect(result.groups).toHaveLength(1);
		expect(result.groups[0].entries).toHaveLength(6);
		expect(new Set(result.entries.map((e) => e.id)).size).toBe(6);
		expect(
			result.entries.every((e) => e.iv.level === 1 && e.iv.ribbon === 0),
		).toBe(true);
	});

	test("normal fixed ABC uses C-to-A normalization, while enumeration never duplicates C-less patterns", async () => {
		const fixed = await calculateRankingScenarioAsync(
			config({ purpose: "berry", target: "berryStrength", berry: "normal" }),
			environment,
			fast,
		);
		expect(
			fixed.entries.find((e) => e.iv.pokemonName === "Persian")?.ingredientKey,
		).toBe("ABA");
		const all = await calculateRankingScenarioAsync(
			config({ pokemonName: "Persian" }),
			environment,
			fast,
		);
		expect(all.entries.map((e) => e.ingredientKey)).toEqual([
			"AAA",
			"AAB",
			"ABA",
			"ABB",
		]);
	});

	test("search defaults exclude mythical and unevolved, without restricting specialty", async () => {
		const result = await calculateRankingScenarioAsync(
			config({ purpose: "berry", target: "berryStrength", berry: "psychic" }),
			environment,
			fast,
		);
		expect(result.entries.length).toBeGreaterThan(0);
		expect(
			result.entries.every(
				(e) =>
					e.iv.pokemon.type === "psychic" &&
					e.iv.pokemon.isFullyEvolved &&
					!e.iv.pokemon.mythIng,
			),
		).toBe(true);
		expect(
			new Set(result.entries.map((e) => e.iv.pokemon.specialty)).size,
		).toBeGreaterThan(1);
		const expanded = await calculateRankingScenarioAsync(
			config({
				purpose: "berry",
				target: "berryStrength",
				berry: "psychic",
				includeUnevolved: true,
			}),
			environment,
			fast,
		);
		expect(expanded.entries.some((e) => !e.iv.pokemon.isFullyEvolved)).toBe(
			true,
		);
	});

	test.each([
		29, 30, 59, 60,
	])("ingredient search checks only unlocked slots at level %i", async (level) => {
		const result = await calculateRankingScenarioAsync(
			config({
				purpose: "ingredient",
				target: "specificIngredientCount",
				ingredient: "potato",
				level,
			}),
			environment,
			fast,
		);
		const venusaur = result.entries.filter(
			(e) => e.iv.pokemonName === "Venusaur",
		);
		expect(venusaur.length).toBe(level < 60 ? 0 : 2);
		expect(
			result.entries.every((e) =>
				e.ingredientSlots
					.slice(0, level >= 60 ? 3 : level >= 30 ? 2 : 1)
					.some((s) => s.name === "potato"),
			),
		).toBe(true);
		expect(result.entries.every((e) => e.value === 0)).toBe(true);
	});

	test("mythical all/same overrides normal pattern, while directly selected mythical ignores exclusion", async () => {
		const all = await calculateRankingScenarioAsync(
			config({ pokemonName: "Mew" }),
			environment,
			fast,
		);
		expect(all.entries).toHaveLength(392);
		const same = await calculateRankingScenarioAsync(
			config({
				purpose: "berry",
				target: "berryStrength",
				berry: "psychic",
				mythical: "same",
			}),
			environment,
			fast,
		);
		const mew = same.entries.filter((e) => e.iv.pokemonName === "Mew");
		expect(mew.length).toBeGreaterThan(1);
		expect(
			mew.every(
				(e) => new Set(e.ingredientSlots.map((s) => s.name)).size === 1,
			),
		).toBe(true);
		const expanded = await calculateRankingScenarioAsync(
			config({
				purpose: "berry",
				target: "berryStrength",
				berry: "psychic",
				mythical: "all",
			}),
			environment,
			fast,
		);
		expect(
			expanded.entries.filter((e) => e.iv.pokemonName === "Mew"),
		).toHaveLength(392);
	});

	test("mythical ingredient filtering uses the actual unlocked slots", async () => {
		const result = await calculateRankingScenarioAsync(
			config({
				purpose: "ingredient",
				target: "specificIngredientCount",
				ingredient: "herb",
				mythical: "all",
				level: 1,
			}),
			environment,
			fast,
		);
		expect(result.entries.some((e) => e.iv.pokemonName === "Mew")).toBe(true);
		expect(result.entries.every((e) => e.iv.ingredient1.name === "herb")).toBe(
			true,
		);
	});

	test("traits uses one fixed pattern and preserves all zero-valued compatible variants", async () => {
		const result = await calculateRankingScenarioAsync(
			config({
				purpose: "traits",
				target: "specificIngredientCount",
				ingredient: "tail",
				ingredientPattern: "ABB",
				level: 10,
			}),
			environment,
			fast,
		);
		expect(result.entries).toHaveLength(25 * 13);
		expect(result.groups).toHaveLength(1);
		expect(
			result.entries.every((e) => e.iv.ingredient === "ABB" && e.value === 0),
		).toBe(true);
		expect(result.entries.some((e) => e.neutralSubSkillCount === 1)).toBe(true);
	});

	test("traits fixes one valid mythical pattern even when exploration setting is exclude", async () => {
		const result = await calculateRankingScenarioAsync(
			config({
				purpose: "traits",
				pokemonName: "Mew",
				level: 1,
				mythIng1: "herb",
				mythIng2: "herb",
				mythIng3: "herb",
			}),
			environment,
			fast,
		);
		expect(result.entries).toHaveLength(25);
		expect(
			result.entries.every((e) => e.ingredientKey === "herb/herb/herb"),
		).toBe(true);
	});

	test("skill search uses existing related-effect matching and the actual Mew skill, never evolution", async () => {
		const options = config({
			purpose: "skill",
			target: "skillCount",
			skill: "Ingredient Magnet S",
			mythical: "same",
			includeUnevolved: true,
			versatileSkill: "Metronome",
		});
		const result = await calculateRankingScenarioAsync(
			options,
			{ ...environment, evolved: true },
			fast,
		);
		expect(result.entries.length).toBeGreaterThan(0);
		expect(
			result.entries.every((e) =>
				matchMainSkillName(e.iv.pokemon, "Ingredient Magnet S", false, e.iv),
			),
		).toBe(true);
		expect(result.entries.some((e) => e.iv.pokemonName === "Mew")).toBe(false);
		expect(result.entries.some((e) => e.iv.pokemonName === "Toxel")).toBe(true);
		const plus = await calculateRankingScenarioAsync(
			{ ...options, skill: "Ingredient Magnet S (Plus)" },
			{ ...environment, evolved: true },
			fast,
		);
		expect(plus.entries.some((e) => e.iv.pokemonName === "Toxel")).toBe(false);
	});

	test("field filters to current shared favorites, including fixed islands", async () => {
		const parameter = { ...environment, fieldIndex: 1 };
		const result = await calculateRankingScenarioAsync(
			config({ purpose: "field", target: "berryStrength" }),
			parameter,
			fast,
		);
		const types = getCurrentFavoriteBerries(parameter).types;
		expect(result.entries.length).toBeGreaterThan(0);
		expect(result.entries.every((e) => types.includes(e.iv.pokemon.type))).toBe(
			true,
		);
	});

	test("incompatible fixed natures are excluded with a reason, not normalized silently", async () => {
		const result = await calculateRankingScenarioAsync(
			config({
				purpose: "berry",
				target: "berryStrength",
				berry: "poison",
				nature: new Nature("Hardy"),
			}),
			environment,
			fast,
		);
		expect(
			result.entries.some((e) => e.iv.pokemonName === "Toxtricity (Low Key)"),
		).toBe(false);
		expect(result.exclusions).toContainEqual({
			reason: "incompatibleNature",
			count: 1,
		});
	});
});

describe("shared evaluation and individual independence", () => {
	test("comparison preserves all own properties and disables all legacy transforms", () => {
		const iv = new PokemonIv({
			pokemonName: "Gastly",
			ingredient: "ABB",
			level: 25,
			skillLevel: 2,
			nature: new Nature("Brave"),
			subSkills: new SubSkillList({ lv10: new SubSkill("Skill Level Up M") }),
			ribbon: 3,
		});
		const before = iv.toProps();
		const parameter = {
			...environment,
			level: 100 as const,
			evolved: true,
			maxSkillLevel: true,
		};
		const result = evaluateRankingComparison(
			iv,
			config({ target: "totalStrength" }),
			parameter,
			(actual, shared) => {
				expect(actual).toBe(iv);
				expect(shared).toMatchObject({
					level: 0,
					evolved: false,
					maxSkillLevel: false,
				});
				return constant();
			},
		);
		expect(result).toEqual({ status: "positive", value: 10 });
		expect(iv.toProps()).toEqual(before);
		expect(parameter).toMatchObject({
			level: 100,
			evolved: true,
			maxSkillLevel: true,
		});
	});

	test("candidate numeric skill level is SLU-inclusive and MAX follows each skill's cap", async () => {
		const subSkills = new SubSkillList({
			lv10: new SubSkill("Skill Level Up M"),
		});
		const result = await calculateRankingScenarioAsync(
			config({ skillLevel: 5, subSkills }),
			environment,
			{
				strengthCalculator: (iv, parameter) => {
					expect(iv.skillLevel).toBe(5);
					expect(new PokemonStrength(iv, parameter).getSkillLevel()).toBe(5);
					return constant();
				},
			},
		);
		expect(result.entries).toHaveLength(6);
		const max = await calculateRankingScenarioAsync(
			config({ purpose: "berry", target: "berryStrength", berry: "water" }),
			environment,
			fast,
		);
		expect(
			max.entries.every(
				(e) => e.iv.skillLevel === getMaxSkillLevel(e.iv.pokemon.skill),
			),
		).toBe(true);
	});

	test("EX skill-level bonuses apply after the numeric normal level, capped per skill", () => {
		const iv = new PokemonIv({
			pokemonName: "Venusaur",
			level: 60,
			skillLevel: 5,
			subSkills: new SubSkillList({ lv10: new SubSkill("Skill Level Up M") }),
		});
		const shared = createRankingEnvironment({
			...environment,
			fieldIndex: 7,
			favoriteType: ["grass", "water", "fire"],
		});
		expect(new PokemonStrength(iv, shared).getSkillLevel()).toBe(6);
		expect(
			new PokemonStrength(
				iv.clone({ skillLevel: getMaxSkillLevel(iv.pokemon.skill) }),
				shared,
			).getSkillLevel(),
		).toBe(getMaxSkillLevel(iv.pokemon.skill));
	});

	test("event and EX bonuses combine after the fixed skill level", () => {
		const iv = new PokemonIv({
			pokemonName: "Venusaur",
			level: 60,
			skillLevel: 4,
			subSkills: new SubSkillList({ lv10: new SubSkill("Skill Level Up M") }),
		});
		const shared = createRankingEnvironment({
			...environment,
			event: "custom",
			fieldIndex: 7,
			favoriteType: ["grass", "water", "fire"],
			customEventBonus: {
				...environment.customEventBonus,
				effects: { ...environment.customEventBonus.effects, skillLevel: 2 },
			},
		});
		expect(new PokemonStrength(iv, shared).getSkillLevel()).toBe(
			Math.min(7, getMaxSkillLevel(iv.pokemon.skill)),
		);
	});

	test("unknown data is uncalculable, not zero, while valid comparisons without the target remain zero", () => {
		const selected = config({
			target: "specificIngredientCount",
			ingredient: "apple",
		});
		const unknownSlot = new PokemonIv({ pokemonName: "Mew", level: 60 });
		expect(
			evaluateRankingComparison(unknownSlot, selected, environment, constant),
		).toEqual({ status: "uncalculable", reason: "unknownIngredient" });
		const mew = new PokemonIv({
			pokemonName: "Mew",
			level: 60,
			mythIng1: "herb",
			mythIng2: "herb",
			mythIng3: "herb",
		});
		const unknownRate = {
			...environment,
			mew: { ...environment.mew, ing: Number.NaN },
		};
		expect(
			evaluateRankingComparison(mew, selected, unknownRate, constant),
		).toEqual({ status: "uncalculable", reason: "unknownRate" });
		expect(
			evaluateRankingComparison(mew, selected, environment, constant),
		).toEqual({ status: "zero", value: 0 });
		expect(
			evaluateRankingComparison(
				mew.clone({ baseIngRate: 20 }),
				selected,
				unknownRate,
				constant,
			),
		).toEqual({ status: "zero", value: 0 });
	});

	test("ingredient energy uses the whole helper result and does not sum skill gains", () => {
		const iv = new PokemonIv({ pokemonName: "Venusaur", level: 60 });
		const calculator = () => ({
			ingredients: [
				{ name: "honey" as const, count: 2 },
				{ name: "tomato" as const, count: 3 },
			].map((item) => ({
				...item,
				strength: 0,
				overflowCount: 0,
				helpCount: 0,
				countPerHelp: 0,
				slots: [],
			})),
			ingStrength: 700,
		});
		expect(
			evaluateRankingComparison(
				iv,
				config({ target: "ingredientStrength", ingredient: "honey" }),
				environment,
				calculator,
			),
		).toEqual({ status: "positive", value: 700 });
		expect(
			evaluateRankingComparison(
				iv,
				config({ target: "specificIngredientCount", ingredient: "honey" }),
				environment,
				calculator,
			),
		).toEqual({ status: "positive", value: 2 });
	});

	test("reports failed and invalid calculations distinctly, while retaining zero", async () => {
		const result = await calculateRankingScenarioAsync(config(), environment, {
			strengthCalculator: (iv) => {
				if (iv.ingredient === "AAA") throw new Error("test");
				return {
					...constant(),
					ingStrength: iv.ingredient === "ABC" ? Number.NaN : 0,
				};
			},
		});
		expect(result.entries).toHaveLength(4);
		expect(result.entries.every((e) => e.value === 0)).toBe(true);
		expect(result.exclusions).toEqual([
			{ reason: "calculationFailed", count: 1 },
			{ reason: "invalidValue", count: 1 },
		]);
		expect(
			evaluateRankingComparison(
				new PokemonIv({ pokemonName: "Venusaur" }),
				config(),
				environment,
				() => {
					throw new Error("failed");
				},
			),
		).toEqual({ status: "uncalculable", reason: "calculationFailed" });
	});

	test("trait effect caching agrees with uncached real calculations", async () => {
		const selected = config({
			purpose: "traits",
			target: "totalStrength",
			level: 10,
		});
		const cached = await calculateRankingScenarioAsync(selected, environment);
		const uncached = await calculateRankingScenarioAsync(
			selected,
			environment,
			{
				strengthCalculator: (iv, parameter) =>
					new PokemonStrength(iv, parameter).calculate(),
			},
		);
		expect(cached.entries.map((e) => [e.id, e.value])).toEqual(
			uncached.entries.map((e) => [e.id, e.value]),
		);
	});
});

describe("execution contract", () => {
	test("publishes throttled dense partial rankings without dropping tied conditions", async () => {
		let now = 0;
		const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
		const partials: Array<
			RankingScenarioPartialResult & { publishedAt: number }
		> = [];
		const result = await calculateRankingScenarioAsync(
			config({ purpose: "traits", target: "totalStrength", level: 60 }),
			environment,
			{
				strengthCalculator: (iv) => ({
					...constant(),
					totalStrength: iv.activeSubSkills.length,
				}),
				onProgress: () => {
					// Model 2 ms of candidate work between progress callbacks.
					now += 64;
				},
				onPartialResult: (partial) =>
					partials.push({ ...partial, publishedAt: now }),
			},
		);

		expect(partials.length).toBeGreaterThan(2);
		expect(partials[0].completed).toBe(128);
		expect(partials[0].result.entries).toHaveLength(128);
		expect(partials[0].result.groups.map((group) => group.value)).toEqual([
			3, 2, 1, 0,
		]);
		expect(
			partials[0].result.groups.every((group) =>
				group.entries.every((entry) => entry.value === group.value),
			),
		).toBe(true);
		for (let index = 1; index < partials.length; index += 1) {
			expect(
				partials[index].publishedAt - partials[index - 1].publishedAt,
			).toBeGreaterThanOrEqual(500);
			expect(
				partials[index].completed - partials[index - 1].completed,
			).toBeGreaterThanOrEqual(256);
		}
		expect(result.entries).toHaveLength(25 * 299);
		expect(partials.at(-1)?.completed).toBeLessThan(result.entries.length);
		clock.mockRestore();
	});

	test("validates main conditions, metric and real island without calculating", () => {
		expect(
			validateRankingScenario(config({ pokemonName: undefined }), environment),
		).toBe("missingPokemon");
		expect(
			validateRankingScenario(
				config({ purpose: "field", target: "berryStrength" }),
				environment,
			),
		).toBe("missingField");
		expect(
			validateRankingScenario(config({ target: "skillCount" }), environment),
		).toBe("invalidMetric");
		expect(
			validateRankingScenario(
				config({
					skillLevel:
						Math.max(...pokemons.map((p) => getMaxSkillLevel(p.skill))) + 1,
				}),
				environment,
			),
		).toBe("invalidSkillLevel");
	});

	test("abort works before and during calculation and progress yields", async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			calculateRankingScenarioAsync(config(), environment, {
				signal: controller.signal,
			}),
		).rejects.toMatchObject({ name: "AbortError" });
		const active = new AbortController();
		await expect(
			calculateRankingScenarioAsync(
				config({ purpose: "traits", level: 60 }),
				environment,
				{
					...fast,
					signal: active.signal,
					onProgress: (completed) => {
						expect(completed).toBe(32);
						active.abort();
					},
				},
			),
		).rejects.toMatchObject({ name: "AbortError" });
	});
});

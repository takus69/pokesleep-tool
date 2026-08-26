import { beforeEach, describe, expect, test, vi } from "vitest";
import Nature from "../util/Nature";
import SubSkill from "../util/SubSkill";
import SubSkillList from "../util/SubSkillList";
import {
	createRankingScenarioSettings,
	loadRankingScenarioSettings,
	normalizeRankingScenarioConfig,
	rankingScenarioPurposes,
	rankingScenarioStorageKey,
	resetRankingScenarioSettings,
	saveRankingScenarioSettings,
} from "./RankingScenarioState";

beforeEach(() => {
	localStorage.clear();
	vi.restoreAllMocks();
});

describe("ranking scenario persistence", () => {
	test("starts on unselected traits with scenario-specific metrics and independent defaults", () => {
		const state = createRankingScenarioSettings();
		expect(state.purpose).toBe("traits");
		expect(
			rankingScenarioPurposes.map((purpose) => state.configs[purpose].target),
		).toEqual([
			"specificIngredientCount",
			"ingredientStrength",
			"berryStrength",
			"specificIngredientCount",
			"skillCount",
			"berryStrength",
		]);
		for (const config of Object.values(state.configs)) {
			expect(config).toMatchObject({
				level: 60,
				skillLevel: "max",
				ribbon: 0,
				ingredientPattern: "ABC",
				mythical: "exclude",
				includeUnevolved: false,
			});
			expect(config.pokemonName).toBeUndefined();
			expect(config.ingredient).toBeUndefined();
			expect(config.nature.isNeautral).toBe(true);
			expect(config.subSkills.getActiveSubSkills(100)).toEqual([]);
		}
	});

	test("round trips all purposes and class-backed fixed options without saving environment", () => {
		const state = createRankingScenarioSettings();
		state.purpose = "ingredient";
		state.configs.traits = {
			...state.configs.traits,
			pokemonName: "Dragonite",
			ingredient: "herb",
			ingredientPattern: "AAA",
		};
		state.configs.ingredient = {
			...state.configs.ingredient,
			ingredient: "mushroom",
			nature: new Nature("Quiet"),
			subSkills: new SubSkillList({
				lv10: new SubSkill("Ingredient Finder M"),
			}),
			skillLevel: 5,
			mythical: "all",
			includeUnevolved: true,
		};
		state.configs.skill.skill = "Ingredient Magnet S";
		saveRankingScenarioSettings(state);
		const restored = loadRankingScenarioSettings();
		expect(restored).toEqual(state);
		expect(restored.configs.ingredient.nature).toBeInstanceOf(Nature);
		expect(restored.configs.ingredient.subSkills).toBeInstanceOf(SubSkillList);
		const raw = localStorage.getItem(rankingScenarioStorageKey);
		expect(raw).not.toContain("fieldIndex");
		expect(raw).not.toContain("teamMember");
	});

	test("resets only current purpose and preserves unrelated existing storage", () => {
		localStorage.setItem("PstIvState", "existing individual");
		localStorage.setItem("PstStrenghParam", "existing environment");
		localStorage.setItem("PstPokemonBox", "existing box");
		const state = createRankingScenarioSettings();
		state.purpose = "berry";
		state.configs.berry.berry = "fire";
		state.configs.traits.pokemonName = "Gengar";
		const reset = resetRankingScenarioSettings(state);
		saveRankingScenarioSettings(reset);
		expect(reset.configs.berry.berry).toBeUndefined();
		expect(reset.configs.traits).toBe(state.configs.traits);
		expect(state.configs.berry.berry).toBe("fire");
		expect(localStorage.getItem("PstIvState")).toBe("existing individual");
		expect(localStorage.getItem("PstStrenghParam")).toBe(
			"existing environment",
		);
		expect(localStorage.getItem("PstPokemonBox")).toBe("existing box");
	});

	test.each([
		"not json",
		"null",
		"[]",
		'{"version":2,"purpose":"berry"}',
		'{"version":1,"configs":null}',
	])("recovers corrupt or unsupported storage %s", (raw) => {
		localStorage.setItem(rankingScenarioStorageKey, raw);
		expect(loadRankingScenarioSettings()).toEqual(
			createRankingScenarioSettings(),
		);
	});

	test("normalizes invalid options, duplicate subskills and ignores extra environment fields", () => {
		const config = normalizeRankingScenarioConfig("ingredients", {
			purpose: "field",
			pokemonName: "Missing",
			target: "totalStrength",
			level: -1,
			skillLevel: 100,
			ribbon: 8,
			nature: "Missing",
			subSkills: {
				lv10: "Helping Bonus",
				lv25: "Helping Bonus",
				lv50: "Missing",
			},
			fieldIndex: 3,
			ingredientPattern: "ZZZ",
		});
		expect(config).toMatchObject({
			purpose: "ingredients",
			target: "ingredientStrength",
			level: 60,
			skillLevel: "max",
			ribbon: 0,
			ingredientPattern: "ABC",
		});
		expect(config).not.toHaveProperty("fieldIndex");
		expect(
			config.subSkills.getActiveSubSkills(100).map((skill) => skill.name),
		).toEqual(["Helping Bonus"]);
	});

	test("storage access failures do not prevent use", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("unavailable");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("full");
		});
		expect(loadRankingScenarioSettings()).toEqual(
			createRankingScenarioSettings(),
		);
		expect(() =>
			saveRankingScenarioSettings(createRankingScenarioSettings()),
		).not.toThrow();
	});
});

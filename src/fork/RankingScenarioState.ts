import pokemons, { IngredientNames, PokemonTypes } from "../data/pokemons";
import {
	getMaxSkillLevel,
	MainSkillNames,
	VersatileCandidates,
} from "../util/MainSkill";
import Nature from "../util/Nature";
import { IngredientTypes } from "../util/PokemonRp";
import {
	type RankingScenarioConfig,
	type RankingScenarioPurpose,
	rankingScenarioMetrics,
} from "../util/RankingScenario";
import SubSkill from "../util/SubSkill";
import SubSkillList, { type SubSkillListProps } from "../util/SubSkillList";

export const rankingScenarioStorageKey = "PstForkRankingScenarios.v1";
export const rankingScenarioPurposes: readonly RankingScenarioPurpose[] = [
	"traits",
	"ingredients",
	"berry",
	"ingredient",
	"skill",
	"field",
];
export { rankingScenarioMetrics };

export interface RankingScenarioSettings {
	purpose: RankingScenarioPurpose;
	configs: Record<RankingScenarioPurpose, RankingScenarioConfig>;
}

export function createRankingScenarioConfig(
	purpose: RankingScenarioPurpose,
): RankingScenarioConfig {
	return {
		purpose,
		target: rankingScenarioMetrics[purpose][0],
		level: 60,
		skillLevel: "max",
		ribbon: 0,
		nature: new Nature("Bashful"),
		subSkills: new SubSkillList(),
		ingredientPattern: "ABC",
		mythical: "exclude",
		includeUnevolved: false,
	};
}

function record(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function member<T extends string>(
	value: unknown,
	values: readonly T[],
): T | undefined {
	return values.find((item) => item === value);
}

/** Explicit whitelist keeps shared environment and comparison data out of this store. */
export function normalizeRankingScenarioConfig(
	purpose: RankingScenarioPurpose,
	value: unknown,
): RankingScenarioConfig {
	const input = record(value);
	const result = createRankingScenarioConfig(purpose);
	result.target =
		member(input.target, rankingScenarioMetrics[purpose]) ?? result.target;
	result.pokemonName = pokemons.find(
		(pokemon) => pokemon.name === input.pokemonName,
	)?.name;
	result.ingredient = member(input.ingredient, IngredientNames);
	result.berry = member(input.berry, PokemonTypes);
	result.skill = member(input.skill, [
		...MainSkillNames,
		...pokemons.map((pokemon) => pokemon.skill),
	]);
	result.versatileSkill = member(input.versatileSkill, VersatileCandidates);
	result.mythIng1 = member(input.mythIng1, IngredientNames);
	result.mythIng2 = member(input.mythIng2, IngredientNames);
	result.mythIng3 = member(input.mythIng3, IngredientNames);
	result.ingredientPattern =
		member(input.ingredientPattern, IngredientTypes) ?? "ABC";
	result.mythical =
		member(input.mythical, ["exclude", "same", "all"] as const) ?? "exclude";
	result.includeUnevolved = input.includeUnevolved === true;
	if (
		typeof input.level === "number" &&
		Number.isInteger(input.level) &&
		input.level >= 1 &&
		input.level <= 100
	)
		result.level = input.level;
	const maximumSkillLevel = Math.max(
		...pokemons.map((pokemon) => getMaxSkillLevel(pokemon.skill)),
	);
	if (
		typeof input.skillLevel === "number" &&
		Number.isInteger(input.skillLevel) &&
		input.skillLevel >= 1 &&
		input.skillLevel <= maximumSkillLevel
	)
		result.skillLevel = input.skillLevel;
	if (
		input.ribbon === 0 ||
		input.ribbon === 1 ||
		input.ribbon === 2 ||
		input.ribbon === 3 ||
		input.ribbon === 4
	)
		result.ribbon = input.ribbon;
	const natureName =
		input.nature instanceof Nature ? input.nature.name : input.nature;
	result.nature =
		Nature.allNatures.find((nature) => nature.name === natureName) ??
		result.nature;
	const skills =
		input.subSkills instanceof SubSkillList
			? input.subSkills.toProps()
			: record(input.subSkills);
	const props: Partial<SubSkillListProps> = {};
	const used = new Set<string>();
	for (const level of ["lv10", "lv25", "lv50", "lv70", "lv80"] as const) {
		const value = skills[level];
		const name = value instanceof SubSkill ? value.name : value;
		const skill = SubSkill.allSubSkills.find((skill) => skill.name === name);
		if (skill && !used.has(skill.name)) {
			props[level] = skill;
			used.add(skill.name);
		}
	}
	result.subSkills = new SubSkillList(props);
	return result;
}

export function serializeRankingScenarioConfig(
	config: RankingScenarioConfig,
): string {
	const normalized = normalizeRankingScenarioConfig(config.purpose, config);
	return JSON.stringify({
		...normalized,
		nature: normalized.nature.name,
		subSkills: Object.fromEntries(
			Object.entries(normalized.subSkills.toProps()).map(([level, skill]) => [
				level,
				skill?.name ?? null,
			]),
		),
	});
}

export function createRankingScenarioSettings(): RankingScenarioSettings {
	return {
		purpose: "traits",
		configs: {
			traits: createRankingScenarioConfig("traits"),
			ingredients: createRankingScenarioConfig("ingredients"),
			berry: createRankingScenarioConfig("berry"),
			ingredient: createRankingScenarioConfig("ingredient"),
			skill: createRankingScenarioConfig("skill"),
			field: createRankingScenarioConfig("field"),
		},
	};
}

export function loadRankingScenarioSettings(): RankingScenarioSettings {
	const result = createRankingScenarioSettings();
	try {
		const stored = record(
			JSON.parse(localStorage.getItem(rankingScenarioStorageKey) ?? "null"),
		);
		if (stored.version !== 1) return result;
		result.purpose =
			member(stored.purpose, rankingScenarioPurposes) ?? "traits";
		const configs = record(stored.configs);
		for (const purpose of rankingScenarioPurposes)
			result.configs[purpose] = normalizeRankingScenarioConfig(
				purpose,
				configs[purpose],
			);
	} catch {
		// Corrupt or inaccessible browser storage must not prevent ranking use.
	}
	return result;
}

export function saveRankingScenarioSettings(
	settings: RankingScenarioSettings,
): void {
	try {
		localStorage.setItem(
			rankingScenarioStorageKey,
			JSON.stringify({
				version: 1,
				purpose: settings.purpose,
				configs: Object.fromEntries(
					rankingScenarioPurposes.map((purpose) => [
						purpose,
						JSON.parse(
							serializeRankingScenarioConfig(settings.configs[purpose]),
						) as unknown,
					]),
				),
			}),
		);
	} catch {
		// Keep the in-memory settings usable when storage is unavailable or full.
	}
}

export function resetRankingScenarioSettings(
	settings: RankingScenarioSettings,
): RankingScenarioSettings {
	return {
		...settings,
		configs: {
			...settings.configs,
			[settings.purpose]: createRankingScenarioConfig(settings.purpose),
		},
	};
}

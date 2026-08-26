import pokemons, {
	type IngredientName,
	type PokemonData,
	type PokemonType,
} from "../data/pokemons";
import {
	generateIngredientRankingSubSkillCombinations,
	generateMythicalPatterns,
	generateNormalPatterns,
	getIngredientCalculationCacheKey,
	type IngredientRankingStrengthCalculator,
} from "./IngredientRanking";
import {
	getMaxSkillLevel,
	type MainSkillName,
	matchMainSkillName,
} from "./MainSkill";
import Nature from "./Nature";
import {
	evaluateNumericRankingValue,
	stableSortNumericRankingEntries,
} from "./NumericRanking";
import PokemonIv, { type IngredientSlot } from "./PokemonIv";
import type { IngredientType } from "./PokemonRp";
import PokemonStrength, {
	getCurrentFavoriteBerries,
	type StrengthParameter,
} from "./PokemonStrength";
import SubSkillList from "./SubSkillList";

export type RankingScenarioPurpose =
	| "traits"
	| "ingredients"
	| "berry"
	| "ingredient"
	| "skill"
	| "field";
export type RankingScenarioMetric =
	| "specificIngredientCount"
	| "ingredientStrength"
	| "berryStrength"
	| "skillCount"
	| "totalStrength";
export type RankingScenarioReason =
	| "missingPokemon"
	| "missingIngredient"
	| "missingBerry"
	| "missingSkill"
	| "missingField"
	| "invalidLevel"
	| "invalidSkillLevel"
	| "invalidMetric"
	| "incompatibleNature"
	| "unknownIngredient"
	| "unknownRate"
	| "calculationFailed"
	| "invalidValue";

export interface RankingScenarioConfig {
	purpose: RankingScenarioPurpose;
	target: RankingScenarioMetric;
	pokemonName?: string;
	ingredient?: IngredientName;
	berry?: PokemonType;
	skill?: MainSkillName;
	level: number;
	skillLevel: "max" | number;
	ribbon: 0 | 1 | 2 | 3 | 4;
	nature: Nature;
	subSkills: SubSkillList;
	ingredientPattern: IngredientType;
	mythIng1?: IngredientName;
	mythIng2?: IngredientName;
	mythIng3?: IngredientName;
	versatileSkill?: MainSkillName;
	mythical: "exclude" | "same" | "all";
	includeUnevolved: boolean;
}

export interface RankingScenarioEntry {
	id: string;
	iv: PokemonIv;
	value: number;
	ingredientKey: string;
	ingredientSlots: readonly IngredientSlot[];
	ordinal: number;
	natureOrder?: number;
	subSkillOrder?: number;
	neutralSubSkillCount?: number;
}
export interface RankingScenarioGroup {
	value: number;
	entries: RankingScenarioEntry[];
}
export interface RankingScenarioExclusion {
	reason: RankingScenarioReason;
	count: number;
}
export interface RankingScenarioResult {
	entries: RankingScenarioEntry[];
	groups: RankingScenarioGroup[];
	exclusions: RankingScenarioExclusion[];
}
export type RankingScenarioEvaluation =
	| { status: "positive" | "zero"; value: number }
	| { status: "uncalculable"; reason: RankingScenarioReason };
export interface RankingScenarioCalculationOptions {
	signal?: AbortSignal;
	onProgress?: (completed: number) => void;
	strengthCalculator?: IngredientRankingStrengthCalculator;
}

export const rankingScenarioMetrics: Record<
	RankingScenarioPurpose,
	readonly RankingScenarioMetric[]
> = {
	traits: [
		"specificIngredientCount",
		"ingredientStrength",
		"berryStrength",
		"skillCount",
		"totalStrength",
	],
	ingredients: ["ingredientStrength"],
	berry: ["berryStrength", "totalStrength"],
	ingredient: ["specificIngredientCount", "ingredientStrength"],
	skill: ["skillCount"],
	field: ["berryStrength", "totalStrength"],
};

/** Preserve the shared environment while disabling legacy individual transforms. */
export function createRankingEnvironment(
	parameter: StrengthParameter,
): StrengthParameter {
	return { ...parameter, level: 0, evolved: false, maxSkillLevel: false };
}

export function validateRankingScenario(
	config: RankingScenarioConfig,
	environment: StrengthParameter,
): RankingScenarioReason | null {
	if (!Number.isInteger(config.level) || config.level < 1 || config.level > 100)
		return "invalidLevel";
	const maximumSkillLevel = Math.max(
		...pokemons.map((pokemon) => getMaxSkillLevel(pokemon.skill)),
	);
	if (
		config.skillLevel !== "max" &&
		(!Number.isInteger(config.skillLevel) ||
			config.skillLevel < 1 ||
			config.skillLevel > maximumSkillLevel)
	)
		return "invalidSkillLevel";
	if (!rankingScenarioMetrics[config.purpose]?.includes(config.target))
		return "invalidMetric";
	if (
		(config.purpose === "traits" || config.purpose === "ingredients") &&
		!pokemons.some((p) => p.name === config.pokemonName)
	)
		return "missingPokemon";
	if (
		(config.purpose === "ingredient" ||
			config.target === "specificIngredientCount") &&
		config.ingredient === undefined
	)
		return "missingIngredient";
	if (config.purpose === "berry" && config.berry === undefined)
		return "missingBerry";
	if (config.purpose === "skill" && config.skill === undefined)
		return "missingSkill";
	if (config.purpose === "field" && environment.fieldIndex < 0)
		return "missingField";
	return null;
}

function unlockedSlots(iv: PokemonIv): IngredientSlot[] {
	return [
		iv.ingredient1,
		...(iv.level >= 30 ? [iv.ingredient2] : []),
		...(iv.level >= 60 ? [iv.ingredient3] : []),
	];
}

/** Compare the actual IV, never candidate filters or candidate fixed conditions. */
export function evaluateRankingComparison(
	iv: PokemonIv,
	config: RankingScenarioConfig,
	environment: StrengthParameter,
	calculator?: IngredientRankingStrengthCalculator,
): RankingScenarioEvaluation {
	let slots: IngredientSlot[];
	try {
		slots = unlockedSlots(iv);
	} catch {
		return { status: "uncalculable", reason: "unknownIngredient" };
	}
	try {
		if (
			slots.some(
				(slot) => /^unknown(?:[123])?$/.test(slot.name) || slot.count <= 0,
			)
		)
			return { status: "uncalculable", reason: "unknownIngredient" };
		if (
			iv.pokemon.rateNotFixed &&
			iv.baseIngRate === undefined &&
			!(
				iv.pokemonName === "Mew" &&
				Number.isFinite(environment.mew.ing) &&
				environment.mew.ing >= 0
			)
		)
			return { status: "uncalculable", reason: "unknownRate" };
		if (
			config.target === "specificIngredientCount" &&
			config.ingredient === undefined
		)
			return { status: "uncalculable", reason: "missingIngredient" };
		const parameter = createRankingEnvironment(environment);
		const result = calculator
			? calculator(iv, parameter)
			: new PokemonStrength(iv, parameter).calculate();
		let value: number;
		switch (config.target) {
			case "specificIngredientCount":
				value =
					result.ingredients.find((item) => item.name === config.ingredient)
						?.count ?? 0;
				break;
			case "ingredientStrength":
				value = result.ingStrength ?? Number.NaN;
				break;
			case "berryStrength":
				value = result.berryTotalStrength ?? Number.NaN;
				break;
			case "skillCount":
				value = result.skillCount ?? Number.NaN;
				break;
			case "totalStrength":
				value = result.totalStrength ?? Number.NaN;
				break;
		}
		if (evaluateNumericRankingValue(value) === null)
			return { status: "uncalculable", reason: "invalidValue" };
		return { status: value > 0 ? "positive" : "zero", value };
	} catch {
		return { status: "uncalculable", reason: "calculationFailed" };
	}
}

function compatible(pokemon: PokemonData, nature: Nature): boolean {
	return (
		!(pokemon.form === "Amped" && !nature.isAmped) &&
		!(pokemon.form === "Low Key" && !nature.isLowKey)
	);
}

function patterns(pokemon: PokemonData, config: RankingScenarioConfig) {
	const all =
		config.purpose === "ingredients" || config.purpose === "ingredient";
	if (pokemon.mythIng !== undefined) {
		if (config.purpose === "traits")
			return [
				{
					props: {
						mythIng1:
							config.mythIng1 ?? pokemon.mythIng.find((i) => i.c1 > 0)?.name,
						mythIng2:
							config.mythIng2 ?? pokemon.mythIng.find((i) => i.c2 > 0)?.name,
						mythIng3:
							config.mythIng3 ?? pokemon.mythIng.find((i) => i.c3 > 0)?.name,
					},
				},
			];
		const mythical = generateMythicalPatterns(pokemon);
		if (config.purpose === "ingredients" || config.mythical === "all")
			return mythical;
		return mythical.filter(
			(p) =>
				p.props.mythIng1 === p.props.mythIng2 &&
				p.props.mythIng2 === p.props.mythIng3,
		);
	}
	return all
		? generateNormalPatterns(pokemon)
		: [{ props: { ingredient: config.ingredientPattern } }];
}

interface Candidate {
	iv?: PokemonIv;
	natureOrder?: number;
	subSkillOrder?: number;
	neutralSubSkillCount?: number;
	reason?: RankingScenarioReason;
}

function* generateCandidates(
	config: RankingScenarioConfig,
	environment: StrengthParameter,
): Generator<Candidate> {
	const direct =
		config.purpose === "traits" || config.purpose === "ingredients";
	const favorites = getCurrentFavoriteBerries(environment).types;
	for (const pokemon of pokemons) {
		if (
			direct
				? pokemon.name !== config.pokemonName
				: (!config.includeUnevolved && !pokemon.isFullyEvolved) ||
					(config.mythical === "exclude" && pokemon.mythIng !== undefined)
		)
			continue;
		if (config.purpose === "berry" && pokemon.type !== config.berry) continue;
		if (config.purpose === "field" && !favorites.includes(pokemon.type))
			continue;
		for (const pattern of patterns(pokemon, config)) {
			try {
				const iv = new PokemonIv({
					pokemonName: pokemon.name,
					level: config.level,
					ribbon: config.ribbon,
					skillLevel:
						config.skillLevel === "max"
							? getMaxSkillLevel(pokemon.skill)
							: config.skillLevel,
					nature: config.purpose === "traits" ? undefined : config.nature,
					subSkills:
						config.purpose === "traits" ? new SubSkillList() : config.subSkills,
					versatileSkill: config.versatileSkill,
					...pattern.props,
				});
				if (
					config.purpose === "skill" &&
					!matchMainSkillName(iv.pokemon, config.skill ?? "", false, iv)
				)
					continue;
				if (
					config.purpose === "ingredient" &&
					!unlockedSlots(iv).some((s) => s.name === config.ingredient)
				)
					continue;
				if (config.purpose !== "traits") {
					yield {
						iv,
						reason: compatible(pokemon, config.nature)
							? undefined
							: "incompatibleNature",
					};
					continue;
				}
				for (const [natureOrder, nature] of Nature.allNatures.entries()) {
					if (!compatible(pokemon, nature)) continue;
					for (const combination of generateIngredientRankingSubSkillCombinations(
						config.level,
					)) {
						yield {
							iv: iv.clone({ nature, subSkills: combination.subSkills }),
							natureOrder,
							subSkillOrder: combination.order,
							neutralSubSkillCount: combination.neutralSubSkillCount,
						};
					}
				}
			} catch {
				yield { reason: "calculationFailed" };
			}
		}
	}
}

function finish(
	entries: RankingScenarioEntry[],
	excluded: Map<RankingScenarioReason, number>,
): RankingScenarioResult {
	const sorted = stableSortNumericRankingEntries(
		entries,
		(entry) => entry.value,
		(a, b) =>
			a.iv.pokemon.id - b.iv.pokemon.id ||
			a.iv.form - b.iv.form ||
			a.ordinal - b.ordinal,
	);
	const groups: RankingScenarioGroup[] = [];
	for (const entry of sorted) {
		const last = groups.at(-1);
		if (last?.value === entry.value) last.entries.push(entry);
		else groups.push({ value: entry.value, entries: [entry] });
	}
	return {
		entries: sorted,
		groups,
		exclusions: [...excluded].map(([reason, count]) => ({ reason, count })),
	};
}

/** Yield between bounded candidate batches so cancellation remains responsive. */
export async function calculateRankingScenarioAsync(
	config: RankingScenarioConfig,
	environment: StrengthParameter,
	options: RankingScenarioCalculationOptions = {},
): Promise<RankingScenarioResult> {
	options.signal?.throwIfAborted();
	const invalid = validateRankingScenario(config, environment);
	if (invalid !== null) throw new Error(invalid);
	const entries: RankingScenarioEntry[] = [];
	const exclusions = new Map<RankingScenarioReason, number>();
	const cache = new Map<string, RankingScenarioEvaluation>();
	let ordinal = 0;
	for (const candidate of generateCandidates(config, environment)) {
		options.signal?.throwIfAborted();
		const iv = candidate.iv;
		if (iv === undefined) {
			const reason = candidate.reason ?? "calculationFailed";
			exclusions.set(reason, (exclusions.get(reason) ?? 0) + 1);
			ordinal += 1;
			if (ordinal % 32 === 0) {
				options.onProgress?.(ordinal);
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
			continue;
		}
		// Only trait enumeration has equal effect signatures; species and pattern are fixed.
		const cacheKey =
			config.purpose === "traits" && options.strengthCalculator === undefined
				? getIngredientCalculationCacheKey(iv.nature, iv.activeSubSkills)
				: undefined;
		const evaluation = candidate.reason
			? { status: "uncalculable" as const, reason: candidate.reason }
			: ((cacheKey === undefined ? undefined : cache.get(cacheKey)) ??
				evaluateRankingComparison(
					iv,
					config,
					environment,
					options.strengthCalculator,
				));
		if (cacheKey !== undefined) cache.set(cacheKey, evaluation);
		if (evaluation.status === "uncalculable")
			exclusions.set(
				evaluation.reason,
				(exclusions.get(evaluation.reason) ?? 0) + 1,
			);
		else {
			try {
				const ingredientSlots = [
					iv.ingredient1,
					iv.ingredient2,
					iv.ingredient3,
				];
				const ingredientKey =
					iv.pokemon.mythIng === undefined
						? iv.ingredient
						: ingredientSlots.map((slot) => slot.name).join("/");
				entries.push({
					...candidate,
					id: `${iv.idForm}:${ingredientKey}:${ordinal}`,
					iv,
					value: evaluation.value,
					ingredientKey,
					ingredientSlots,
					ordinal,
				});
			} catch {
				exclusions.set(
					"unknownIngredient",
					(exclusions.get("unknownIngredient") ?? 0) + 1,
				);
			}
		}
		ordinal += 1;
		if (ordinal % 32 === 0) {
			options.onProgress?.(ordinal);
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}
	options.signal?.throwIfAborted();
	options.onProgress?.(ordinal);
	return finish(entries, exclusions);
}

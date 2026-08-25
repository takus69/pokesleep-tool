import type {
	IngredientName,
	PokemonData,
	PokemonSpecialty,
	PokemonType,
} from "../data/pokemons";
import {
	calculatePokemonRankingStrengthResult,
	generateIngredientRankingCandidates,
	type IngredientRankingCandidate,
	type IngredientRankingStrengthCalculator,
} from "./IngredientRanking";
import type Nature from "./Nature";
import {
	evaluateNumericRankingValue,
	groupNumericRankingEntries,
	stableSortNumericRankingEntries,
} from "./NumericRanking";
import PokemonIv, { type IngredientSlot } from "./PokemonIv";
import type { StrengthParameter } from "./PokemonStrength";
import type SubSkillList from "./SubSkillList";

export type PokemonRankingTarget =
	| "berryStrength"
	| "ingredientStrength"
	| "ingredientCount"
	| "specificIngredientCount"
	| "totalStrength"
	| "skillCount";

export interface PokemonRankingFilters {
	ingredient?: IngredientName;
	type?: PokemonType;
	specialty?: PokemonSpecialty;
}

export interface PokemonRankingOptions {
	target: PokemonRankingTarget;
	/** Ingredient measured by the specificIngredientCount target. */
	ingredient?: IngredientName;
	level: number;
	ribbon: 0 | 1 | 2 | 3 | 4;
	nature: Nature;
	subSkills: SubSkillList;
	parameter: StrengthParameter;
	filters?: PokemonRankingFilters;
	strengthCalculator?: IngredientRankingStrengthCalculator;
	signal?: AbortSignal;
}

export interface PokemonRankingEntry {
	iv: PokemonIv;
	pokemon: PokemonData;
	ingredientSlots: readonly IngredientSlot[];
	ingredientKey: string;
	ingredientOrder: number;
	ordinal: number;
	value: number;
}

export interface PokemonRankingGroup {
	value: number;
	entries: readonly PokemonRankingEntry[];
}

const asyncYieldInterval = 32;

/** Rank Pokemon under one fixed nature and sub-skill configuration. */
export function calculatePokemonRanking(
	options: PokemonRankingOptions,
): PokemonRankingEntry[] {
	const context = createPokemonRankingContext(options);
	if (context === null) return [];

	const bestByPokemon = new Map<string, PokemonRankingEntry>();
	for (const candidate of context.candidates) {
		selectPokemonRankingCandidate(bestByPokemon, candidate, context);
	}
	return sortPokemonRankingEntries([...bestByPokemon.values()]);
}

/** Async variant with abort checks and event-loop yielding. */
export async function calculatePokemonRankingAsync(
	options: PokemonRankingOptions,
): Promise<PokemonRankingEntry[]> {
	options.signal?.throwIfAborted();
	const context = createPokemonRankingContext(options);
	if (context === null) return [];

	const bestByPokemon = new Map<string, PokemonRankingEntry>();
	for (const [index, candidate] of context.candidates.entries()) {
		selectPokemonRankingCandidate(bestByPokemon, candidate, context);
		if ((index + 1) % asyncYieldInterval === 0) {
			await yieldToEventLoop(options.signal);
		}
	}
	options.signal?.throwIfAborted();
	return sortPokemonRankingEntries([...bestByPokemon.values()]);
}

export function groupPokemonRankingEntries(
	entries: readonly PokemonRankingEntry[],
): PokemonRankingGroup[] {
	return groupNumericRankingEntries(
		entries,
		(entry) => entry.value,
		comparePokemonRankingEntryTies,
	);
}

interface PokemonRankingContext {
	candidates: readonly IngredientRankingCandidate[];
	target: PokemonRankingTarget;
	ingredient?: IngredientName;
	filters: PokemonRankingFilters;
	parameter: StrengthParameter;
	calculator?: IngredientRankingStrengthCalculator;
	nature: Nature;
	subSkills: SubSkillList;
}

function createPokemonRankingContext(
	options: PokemonRankingOptions,
): PokemonRankingContext | null {
	if (
		!Number.isInteger(options.level) ||
		options.level < 1 ||
		options.level > 100 ||
		(options.target === "specificIngredientCount" &&
			options.ingredient === undefined)
	) {
		return null;
	}

	return {
		candidates: generateIngredientRankingCandidates(
			undefined,
			options.level,
			undefined,
			options.ribbon,
		),
		target: options.target,
		ingredient: options.ingredient,
		filters: options.filters ?? {},
		parameter: options.parameter,
		calculator: options.strengthCalculator,
		nature: options.nature,
		subSkills: options.subSkills,
	};
}

function selectPokemonRankingCandidate(
	selected: Map<string, PokemonRankingEntry>,
	candidate: IngredientRankingCandidate,
	context: PokemonRankingContext,
): void {
	if (
		!matchesPokemonFilters(candidate.iv.pokemon, context.filters) ||
		!isNatureCompatible(candidate.iv.pokemon, context.nature)
	) {
		return;
	}

	const iv = new PokemonIv({
		...candidate.iv.toProps(),
		nature: context.nature,
		subSkills: context.subSkills,
	});
	if (iv.nature.name !== context.nature.name) return;
	if (
		context.filters.ingredient !== undefined &&
		!getIngredientSlots(iv).some(
			(slot) => slot.name === context.filters.ingredient,
		)
	) {
		return;
	}

	const result = calculatePokemonRankingStrengthResult(
		iv,
		context.parameter,
		context.calculator,
	);
	if (result === null) return;
	const value = evaluateNumericRankingValue(
		getPokemonRankingValue(result, context.target, context.ingredient),
	);
	if (value === null) return;

	const entry: PokemonRankingEntry = {
		iv,
		pokemon: iv.pokemon,
		ingredientSlots: getIngredientSlots(iv),
		ingredientKey: candidate.ingredientKey,
		ingredientOrder: candidate.ingredientOrder,
		ordinal: candidate.ordinal,
		value,
	};
	const pokemonKey = `${iv.pokemon.id}:${iv.form}`;
	const current = selected.get(pokemonKey);
	if (
		current === undefined ||
		entry.value > current.value ||
		(entry.value === current.value &&
			comparePokemonRankingEntryTies(entry, current) < 0)
	) {
		selected.set(pokemonKey, entry);
	}
}

function matchesPokemonFilters(
	pokemon: PokemonData,
	filters: PokemonRankingFilters,
): boolean {
	return (
		(filters.type === undefined || pokemon.type === filters.type) &&
		(filters.specialty === undefined || pokemon.specialty === filters.specialty)
	);
}

function isNatureCompatible(pokemon: PokemonData, nature: Nature): boolean {
	return !(
		(pokemon.form === "Amped" && !nature.isAmped) ||
		(pokemon.form === "Low Key" && !nature.isLowKey)
	);
}

function getPokemonRankingValue(
	result: NonNullable<ReturnType<typeof calculatePokemonRankingStrengthResult>>,
	target: PokemonRankingTarget,
	ingredient: IngredientName | undefined,
): number {
	switch (target) {
		case "berryStrength":
			return result.berryTotalStrength ?? Number.NaN;
		case "ingredientStrength":
			return result.ingStrength ?? Number.NaN;
		case "ingredientCount":
			return result.ingredients.reduce((sum, item) => sum + item.count, 0);
		case "specificIngredientCount":
			return (
				result.ingredients.find((item) => item.name === ingredient)?.count ?? 0
			);
		case "totalStrength":
			return result.totalStrength ?? Number.NaN;
		case "skillCount":
			return result.skillCount ?? Number.NaN;
	}
}

function sortPokemonRankingEntries(
	entries: readonly PokemonRankingEntry[],
): PokemonRankingEntry[] {
	return stableSortNumericRankingEntries(
		entries,
		(entry) => entry.value,
		comparePokemonRankingEntryTies,
	);
}

function comparePokemonRankingEntryTies(
	a: PokemonRankingEntry,
	b: PokemonRankingEntry,
): number {
	return (
		a.pokemon.id - b.pokemon.id ||
		a.iv.form - b.iv.form ||
		a.ingredientOrder - b.ingredientOrder ||
		a.ordinal - b.ordinal
	);
}

function getIngredientSlots(iv: PokemonIv): IngredientSlot[] {
	return [iv.ingredient1, iv.ingredient2, iv.ingredient3];
}

async function yieldToEventLoop(signal?: AbortSignal): Promise<void> {
	signal?.throwIfAborted();
	await new Promise((resolve) => setTimeout(resolve, 0));
	signal?.throwIfAborted();
}

import pokemons, {
	type IngredientName,
	type PokemonData,
} from "../data/pokemons";
import PokemonIv, { type IngredientSlot } from "./PokemonIv";
import { type IngredientType, IngredientTypes } from "./PokemonRp";
import PokemonStrength, {
	type IngredientStrength,
	type StrengthParameter,
} from "./PokemonStrength";

export type IngredientRankingLevel = number;

export type IngredientRankingStrengthResult = {
	ingredients: IngredientStrength[];
};

export type IngredientRankingStrengthCalculator = (
	iv: PokemonIv,
	parameter: StrengthParameter,
) => IngredientRankingStrengthResult;

export interface IngredientRankingCandidate {
	iv: PokemonIv;
	/** Normal ingredient pattern or mythical slot names. */
	ingredientKey: string;
	/** Order within the Pokemon's generated ingredient patterns. */
	ingredientOrder: number;
	/** Stable fallback order across all generated candidates. */
	ordinal: number;
}

export interface IngredientCountMetric {
	count: number;
}

export interface IngredientRankingEntry extends IngredientRankingCandidate {
	pokemon: PokemonData;
	ingredientSlots: IngredientSlot[];
	count: number;
	metric: IngredientCountMetric;
}

export interface IngredientRankingOptions {
	baseIv: PokemonIv;
	level: IngredientRankingLevel;
	ingredient: IngredientName;
	parameter: StrengthParameter;
	strengthCalculator?: IngredientRankingStrengthCalculator;
}

const unknownIngredientPattern = /^unknown(?:[123])?$/;

/**
 * Generate all ingredient-pattern candidates for calculable final evolutions.
 * Calculation-specific exclusions are deliberately left to the ranking step.
 */
export function generateIngredientRankingCandidates(
	baseIv: PokemonIv,
	level: IngredientRankingLevel,
): IngredientRankingCandidate[] {
	if (!Number.isInteger(level) || level < 1 || level > 100) {
		return [];
	}

	const candidates: IngredientRankingCandidate[] = [];
	let ordinal = 0;

	for (const pokemon of pokemons) {
		if (!pokemon.isFullyEvolved) {
			continue;
		}

		const patterns =
			pokemon.mythIng === undefined
				? generateNormalPatterns(pokemon)
				: generateMythicalPatterns(pokemon);

		for (const pattern of patterns) {
			const props = {
				pokemonName: pokemon.name,
				level,
				nature: baseIv.nature,
				subSkills: baseIv.subSkills,
				...pattern.props,
			};
			candidates.push({
				iv: new PokemonIv(props),
				ingredientKey: pattern.key,
				ingredientOrder: pattern.order,
				ordinal,
			});
			ordinal += 1;
		}
	}

	return candidates;
}

/**
 * Calculate the helper-produced count of one ingredient for a candidate.
 * Main-skill ingredient gains are not part of StrengthResult.ingredients.
 */
export function calculateIngredientCount(
	candidate: IngredientRankingCandidate,
	ingredient: IngredientName,
	parameter: StrengthParameter,
	strengthCalculator: IngredientRankingStrengthCalculator = defaultStrengthCalculator,
): IngredientCountMetric | null {
	const unlockedSlots = getUnlockedIngredientSlots(candidate.iv);
	if (
		isUnknownIngredient(ingredient) ||
		unlockedSlots === null ||
		!isCandidateCalculable(candidate, parameter, unlockedSlots) ||
		!unlockedSlots.some((slot) => slot.name === ingredient)
	) {
		return null;
	}

	try {
		const rankingParameter = {
			...parameter,
			level: 0,
		} satisfies StrengthParameter;
		const result = strengthCalculator(candidate.iv, rankingParameter);
		const count =
			result.ingredients.find((item) => item.name === ingredient)?.count ?? 0;
		if (!Number.isFinite(count) || count <= 0) {
			return null;
		}
		return { count };
	} catch {
		return null;
	}
}

/**
 * Rank candidates by helper-produced ingredient count.
 */
export function calculateIngredientRanking(
	options: IngredientRankingOptions,
): IngredientRankingEntry[];
export function calculateIngredientRanking(
	candidates: readonly IngredientRankingCandidate[],
	ingredient: IngredientName,
	parameter: StrengthParameter,
	strengthCalculator?: IngredientRankingStrengthCalculator,
): IngredientRankingEntry[];
export function calculateIngredientRanking(
	optionsOrCandidates:
		| IngredientRankingOptions
		| readonly IngredientRankingCandidate[],
	ingredient?: IngredientName,
	parameter?: StrengthParameter,
	strengthCalculator?: IngredientRankingStrengthCalculator,
): IngredientRankingEntry[] {
	const options = Array.isArray(optionsOrCandidates)
		? null
		: (optionsOrCandidates as IngredientRankingOptions);
	const candidates = options
		? generateIngredientRankingCandidates(options.baseIv, options.level)
		: (optionsOrCandidates as readonly IngredientRankingCandidate[]);
	const targetIngredient = options?.ingredient ?? ingredient;
	const strengthParameter = options?.parameter ?? parameter;
	const calculator =
		options?.strengthCalculator ??
		strengthCalculator ??
		defaultStrengthCalculator;

	if (targetIngredient === undefined || strengthParameter === undefined) {
		return [];
	}

	const entries: IngredientRankingEntry[] = [];

	for (const candidate of candidates) {
		const metric = calculateIngredientCount(
			candidate,
			targetIngredient,
			strengthParameter,
			calculator,
		);
		if (metric !== null) {
			entries.push({
				...candidate,
				pokemon: candidate.iv.pokemon,
				ingredientSlots: getIngredientSlots(candidate.iv),
				count: metric.count,
				metric,
			});
		}
	}

	return entries.sort(compareIngredientRankingEntries);
}

/**
 * Generate and rank all candidates in one call.
 */
export function rankIngredientPokemon(
	baseIv: PokemonIv,
	level: IngredientRankingLevel,
	ingredient: IngredientName,
	parameter: StrengthParameter,
	strengthCalculator?: IngredientRankingStrengthCalculator,
): IngredientRankingEntry[] {
	return calculateIngredientRanking(
		generateIngredientRankingCandidates(baseIv, level),
		ingredient,
		parameter,
		strengthCalculator,
	);
}

export function compareIngredientRankingEntries(
	a: IngredientRankingEntry,
	b: IngredientRankingEntry,
): number {
	return (
		b.metric.count - a.metric.count ||
		a.iv.pokemon.id - b.iv.pokemon.id ||
		a.iv.form - b.iv.form ||
		a.ingredientOrder - b.ingredientOrder ||
		a.ordinal - b.ordinal
	);
}

function generateNormalPatterns(pokemon: PokemonData): Array<{
	key: IngredientType;
	order: number;
	props: { ingredient: IngredientType };
}> {
	return IngredientTypes.flatMap((ingredient, order) =>
		pokemon.ing3 === undefined && ingredient.endsWith("C")
			? []
			: [{ key: ingredient, order, props: { ingredient } }],
	);
}

function generateMythicalPatterns(pokemon: PokemonData): Array<{
	key: string;
	order: number;
	props: {
		mythIng1: IngredientName;
		mythIng2: IngredientName;
		mythIng3: IngredientName;
	};
}> {
	if (pokemon.mythIng === undefined) {
		return [];
	}

	const slot1 = pokemon.mythIng.filter((item) => item.c1 > 0);
	const slot2 = pokemon.mythIng.filter((item) => item.c2 > 0);
	const slot3 = pokemon.mythIng.filter((item) => item.c3 > 0);
	const seen = new Set<string>();
	const patterns: ReturnType<typeof generateMythicalPatterns> = [];

	for (const ing1 of slot1) {
		for (const ing2 of slot2) {
			for (const ing3 of slot3) {
				const key = `${ing1.name}/${ing2.name}/${ing3.name}`;
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
				patterns.push({
					key,
					order: patterns.length,
					props: {
						mythIng1: ing1.name,
						mythIng2: ing2.name,
						mythIng3: ing3.name,
					},
				});
			}
		}
	}
	return patterns;
}

function isCandidateCalculable(
	candidate: IngredientRankingCandidate,
	parameter: StrengthParameter,
	slots: readonly IngredientSlot[],
): boolean {
	const iv = candidate.iv;
	if (
		iv.pokemon.rateNotFixed &&
		iv.baseIngRate === undefined &&
		!(
			iv.pokemon.name === "Mew" &&
			Number.isFinite(parameter.mew.ing) &&
			parameter.mew.ing >= 0
		)
	) {
		return false;
	}

	return slots.every(
		(slot) => slot.count > 0 && !isUnknownIngredient(slot.name),
	);
}

function getUnlockedIngredientSlots(iv: PokemonIv): IngredientSlot[] | null {
	const slots = [iv.ingredient1];
	if (iv.level >= 30) {
		slots.push(iv.ingredient2);
	}
	if (iv.level >= 60) {
		try {
			slots.push(iv.ingredient3);
		} catch {
			return null;
		}
	}
	return slots;
}

function isUnknownIngredient(ingredient: IngredientName): boolean {
	return unknownIngredientPattern.test(ingredient);
}

function getIngredientSlots(iv: PokemonIv): IngredientSlot[] {
	return [iv.ingredient1, iv.ingredient2, iv.ingredient3];
}

function defaultStrengthCalculator(
	iv: PokemonIv,
	parameter: StrengthParameter,
): IngredientRankingStrengthResult {
	return new PokemonStrength(iv, parameter).calculate();
}

import pokemons, {
	type IngredientName,
	type PokemonData,
} from "../data/pokemons";
import Nature from "./Nature";
import PokemonIv, { type IngredientSlot } from "./PokemonIv";
import { type IngredientType, IngredientTypes } from "./PokemonRp";
import PokemonStrength, {
	type IngredientStrength,
	type StrengthParameter,
} from "./PokemonStrength";
import SubSkill from "./SubSkill";
import SubSkillList from "./SubSkillList";

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
	/** Nature order in Nature.allNatures. */
	natureOrder?: number;
	/** Canonical sub-skill combination order. */
	subSkillOrder?: number;
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
	/** Retained for caller compatibility; candidate generation ignores it. */
	baseIv?: PokemonIv;
	/** Restricts candidates to one exact Pokemon/form name. */
	pokemonName?: string;
	level: IngredientRankingLevel;
	ingredient: IngredientName;
	parameter: StrengthParameter;
	strengthCalculator?: IngredientRankingStrengthCalculator;
	/** Maximum number of entries returned after the final stable sort. */
	limit?: number;
	/** Cancels asynchronous ranking with an AbortError. */
	signal?: AbortSignal;
}

const unknownIngredientPattern = /^unknown(?:[123])?$/;
const asyncSelectionYieldInterval = 32;
const asyncCombinationYieldInterval = 64;
const excludedRankingSubSkillNames = new Set<SubSkill["name"]>([
	"Dream Shard Bonus",
	"Research EXP Bonus",
	"Sleep EXP Bonus",
	"Skill Level Up M",
	"Skill Level Up S",
]);
const rankingSubSkills = SubSkill.allSubSkills.filter(
	(skill) => !excludedRankingSubSkillNames.has(skill.name),
);
const rankingNatures = [
	new Nature("Serious"),
	...Nature.allNatures.filter((nature) => !nature.isNeautral),
];

/**
 * Generate all ingredient-pattern candidates for calculable final evolutions.
 * Calculation-specific exclusions are deliberately left to the ranking step.
 */
export function generateIngredientRankingCandidates(
	_baseIv: PokemonIv | undefined,
	level: IngredientRankingLevel,
	pokemonName?: string,
): IngredientRankingCandidate[] {
	if (!Number.isInteger(level) || level < 1 || level > 100) {
		return [];
	}

	const candidates: IngredientRankingCandidate[] = [];
	let ordinal = 0;

	for (const pokemon of pokemons) {
		if (
			!pokemon.isFullyEvolved ||
			(pokemonName !== undefined && pokemon.name !== pokemonName)
		) {
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
				nature: getNeutralNature(pokemon.name),
				subSkills: new SubSkillList(),
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
 * Select each Pokemon's best ingredient pattern, then rank every nature and
 * active sub-skill combination by helper-produced ingredient count.
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
	const context = createRankingContext(
		optionsOrCandidates,
		ingredient,
		parameter,
		strengthCalculator,
	);
	if (context === null) {
		return [];
	}

	const selectedCandidates = selectBestIngredientCandidates(
		context.candidates,
		context.ingredient,
		context.parameter,
		context.calculator,
	);
	const entries: IngredientRankingEntry[] = [];

	for (const selected of selectedCandidates) {
		entries.push(...evaluateSelectedCandidate(selected, context));
	}

	return finalizeRankingEntries(entries, context.limit);
}

/**
 * Async ranking variant that yields during selection and combination
 * evaluation while preserving the synchronous result and ordering.
 */
export async function calculateIngredientRankingAsync(
	options: IngredientRankingOptions,
): Promise<IngredientRankingEntry[]> {
	throwIfAborted(options.signal);
	const context = createRankingContext(options);
	if (context === null) {
		return [];
	}

	const selectedCandidates = await selectBestIngredientCandidatesAsync(
		context.candidates,
		context.ingredient,
		context.parameter,
		context.calculator,
		options.signal,
	);
	const entries: IngredientRankingEntry[] = [];

	for (const selected of selectedCandidates) {
		entries.push(
			...(await evaluateSelectedCandidateAsync(
				selected,
				context,
				options.signal,
			)),
		);
	}

	throwIfAborted(options.signal);
	return finalizeRankingEntries(entries, context.limit);
}

interface IngredientRankingContext {
	candidates: readonly IngredientRankingCandidate[];
	ingredient: IngredientName;
	parameter: StrengthParameter;
	calculator: IngredientRankingStrengthCalculator;
	limit?: number;
}

function createRankingContext(
	optionsOrCandidates:
		| IngredientRankingOptions
		| readonly IngredientRankingCandidate[],
	ingredient?: IngredientName,
	parameter?: StrengthParameter,
	strengthCalculator?: IngredientRankingStrengthCalculator,
): IngredientRankingContext | null {
	const options = Array.isArray(optionsOrCandidates)
		? null
		: (optionsOrCandidates as IngredientRankingOptions);
	const candidates = options
		? generateIngredientRankingCandidates(
				options.baseIv,
				options.level,
				options.pokemonName,
			)
		: (optionsOrCandidates as readonly IngredientRankingCandidate[]);
	const targetIngredient = options?.ingredient ?? ingredient;
	const strengthParameter = options?.parameter ?? parameter;

	if (targetIngredient === undefined || strengthParameter === undefined) {
		return null;
	}

	return {
		candidates,
		ingredient: targetIngredient,
		parameter: strengthParameter,
		calculator:
			options?.strengthCalculator ??
			strengthCalculator ??
			defaultStrengthCalculator,
		limit: options?.limit,
	};
}

interface CandidateEvaluationState {
	entriesByCount: Map<number, IngredientRankingEntry>;
	metricCache: Set<string> | null;
}

type SubSkillCombination = {
	subSkills: SubSkillList;
	skills: SubSkill[];
	order: number;
};

function evaluateSelectedCandidate(
	selected: IngredientRankingCandidate,
	context: IngredientRankingContext,
): IngredientRankingEntry[] {
	const state = createCandidateEvaluationState(context);
	evaluateBaselineCandidate(state, selected, context);

	for (const [natureOrder, nature] of rankingNatures.entries()) {
		const normalizedNature = normalizeNatureForCache(
			selected,
			nature,
			state.metricCache,
		);
		for (const combination of generateSubSkillCombinations(selected.iv.level)) {
			evaluateCandidateCombination(
				state,
				selected,
				nature,
				normalizedNature,
				natureOrder,
				combination,
				context,
			);
		}
	}

	return [...state.entriesByCount.values()];
}

async function evaluateSelectedCandidateAsync(
	selected: IngredientRankingCandidate,
	context: IngredientRankingContext,
	signal?: AbortSignal,
): Promise<IngredientRankingEntry[]> {
	const state = createCandidateEvaluationState(context);
	let iteration = 0;
	evaluateBaselineCandidate(state, selected, context);

	for (const [natureOrder, nature] of rankingNatures.entries()) {
		const normalizedNature = normalizeNatureForCache(
			selected,
			nature,
			state.metricCache,
		);
		for (const combination of generateSubSkillCombinations(selected.iv.level)) {
			evaluateCandidateCombination(
				state,
				selected,
				nature,
				normalizedNature,
				natureOrder,
				combination,
				context,
			);
			iteration += 1;
			if (iteration % asyncCombinationYieldInterval === 0) {
				await yieldToEventLoop(signal);
			}
		}
	}

	throwIfAborted(signal);
	return [...state.entriesByCount.values()];
}

function createCandidateEvaluationState(
	context: IngredientRankingContext,
): CandidateEvaluationState {
	return {
		entriesByCount: new Map(),
		metricCache:
			context.calculator === defaultStrengthCalculator
				? new Set<string>()
				: null,
	};
}

function evaluateBaselineCandidate(
	state: CandidateEvaluationState,
	selected: IngredientRankingCandidate,
	context: IngredientRankingContext,
): void {
	const nature = getNeutralNature(selected.iv.pokemonName);
	evaluateCandidateCombination(
		state,
		selected,
		nature,
		nature,
		0,
		{
			subSkills: new SubSkillList(),
			skills: [],
			order: -1,
		},
		context,
	);
}

function evaluateCandidateCombination(
	state: CandidateEvaluationState,
	selected: IngredientRankingCandidate,
	nature: Nature,
	normalizedNature: Nature,
	natureOrder: number,
	combination: SubSkillCombination,
	context: IngredientRankingContext,
): void {
	const cacheKey =
		state.metricCache &&
		getIngredientCalculationCacheKey(normalizedNature, combination.skills);
	if (
		cacheKey !== null &&
		cacheKey !== undefined &&
		state.metricCache?.has(cacheKey)
	) {
		return;
	}

	const iv = new PokemonIv({
		...selected.iv.toProps(),
		nature,
		subSkills: combination.subSkills,
	});
	const candidate = {
		...selected,
		iv,
		natureOrder,
		subSkillOrder: combination.order,
	};
	const metric = calculateIngredientCount(
		candidate,
		context.ingredient,
		context.parameter,
		context.calculator,
	);
	if (cacheKey !== null && cacheKey !== undefined) {
		state.metricCache?.add(cacheKey);
	}
	if (metric === null || state.entriesByCount.has(metric.count)) {
		return;
	}
	state.entriesByCount.set(metric.count, {
		...candidate,
		pokemon: iv.pokemon,
		ingredientSlots: getIngredientSlots(iv),
		count: metric.count,
		metric,
	});
}

function normalizeNatureForCache(
	selected: IngredientRankingCandidate,
	nature: Nature,
	metricCache: Set<string> | null,
): Nature {
	return metricCache === null
		? nature
		: new PokemonIv({
				...selected.iv.toProps(),
				nature,
				subSkills: new SubSkillList(),
			}).nature;
}

function finalizeRankingEntries(
	entries: IngredientRankingEntry[],
	limit?: number,
): IngredientRankingEntry[] {
	entries.sort(compareIngredientRankingEntries);
	if (limit === undefined || !Number.isFinite(limit)) {
		return entries;
	}
	return entries.slice(0, Math.max(0, Math.floor(limit)));
}

async function yieldToEventLoop(signal?: AbortSignal): Promise<void> {
	throwIfAborted(signal);
	await new Promise((resolve) => setTimeout(resolve, 0));
	throwIfAborted(signal);
}

function throwIfAborted(signal?: AbortSignal): void {
	signal?.throwIfAborted();
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
		(a.natureOrder ?? 0) - (b.natureOrder ?? 0) ||
		(a.subSkillOrder ?? 0) - (b.subSkillOrder ?? 0) ||
		a.ordinal - b.ordinal
	);
}

interface SelectedIngredientCandidate {
	candidate: IngredientRankingCandidate;
	count: number;
}

function selectBestIngredientCandidates(
	candidates: readonly IngredientRankingCandidate[],
	ingredient: IngredientName,
	parameter: StrengthParameter,
	strengthCalculator: IngredientRankingStrengthCalculator,
): IngredientRankingCandidate[] {
	const selected = new Map<string, SelectedIngredientCandidate>();

	for (const candidate of candidates) {
		selectIngredientCandidate(
			selected,
			candidate,
			ingredient,
			parameter,
			strengthCalculator,
		);
	}

	return [...selected.values()].map(({ candidate }) => candidate);
}

async function selectBestIngredientCandidatesAsync(
	candidates: readonly IngredientRankingCandidate[],
	ingredient: IngredientName,
	parameter: StrengthParameter,
	strengthCalculator: IngredientRankingStrengthCalculator,
	signal?: AbortSignal,
): Promise<IngredientRankingCandidate[]> {
	const selected = new Map<string, SelectedIngredientCandidate>();

	for (const [index, candidate] of candidates.entries()) {
		selectIngredientCandidate(
			selected,
			candidate,
			ingredient,
			parameter,
			strengthCalculator,
		);
		if ((index + 1) % asyncSelectionYieldInterval === 0) {
			await yieldToEventLoop(signal);
		}
	}

	throwIfAborted(signal);
	return [...selected.values()].map(({ candidate }) => candidate);
}

function selectIngredientCandidate(
	selected: Map<string, SelectedIngredientCandidate>,
	candidate: IngredientRankingCandidate,
	ingredient: IngredientName,
	parameter: StrengthParameter,
	strengthCalculator: IngredientRankingStrengthCalculator,
): void {
	const baselineCandidate = {
		...candidate,
		iv: new PokemonIv({
			...candidate.iv.toProps(),
			nature: getNeutralNature(candidate.iv.pokemonName),
			subSkills: new SubSkillList(),
		}),
	};
	const metric = calculateIngredientCount(
		baselineCandidate,
		ingredient,
		parameter,
		strengthCalculator,
	);
	if (metric === null) {
		return;
	}

	const pokemonKey = `${baselineCandidate.iv.pokemon.id}:${baselineCandidate.iv.form}`;
	const current = selected.get(pokemonKey);
	if (
		current === undefined ||
		metric.count > current.count ||
		(metric.count === current.count &&
			compareIngredientCandidateOrder(baselineCandidate, current.candidate) < 0)
	) {
		selected.set(pokemonKey, {
			candidate: baselineCandidate,
			count: metric.count,
		});
	}
}

function compareIngredientCandidateOrder(
	a: IngredientRankingCandidate,
	b: IngredientRankingCandidate,
): number {
	return a.ingredientOrder - b.ingredientOrder || a.ordinal - b.ordinal;
}

function* generateSubSkillCombinations(
	level: number,
): Generator<SubSkillCombination> {
	const count = level < 10 ? 0 : level < 25 ? 1 : level < 50 ? 2 : 3;
	const skills = rankingSubSkills;
	const selected: SubSkill[] = [];
	let order = 0;

	function* visit(start: number): Generator<SubSkill[]> {
		if (selected.length === count) {
			yield [...selected];
			return;
		}
		for (let index = start; index < skills.length; index += 1) {
			selected.push(skills[index]);
			yield* visit(index + 1);
			selected.pop();
		}
	}

	for (const combination of visit(0)) {
		yield {
			subSkills: new SubSkillList({
				lv10: combination[0],
				lv25: combination[1],
				lv50: combination[2],
			}),
			skills: combination,
			order,
		};
		order += 1;
	}
}

function getIngredientCalculationCacheKey(
	nature: Nature,
	activeSubSkills: readonly SubSkill[],
): string {
	return [
		nature.energyRecoveryFactor,
		nature.speedOfHelpFactor,
		nature.ingredientFindingFactor,
		activeSubSkills.reduce((sum, skill) => sum + skill.helpingSpeed, 0),
		activeSubSkills.reduce((sum, skill) => sum + skill.ingredientFinder, 0),
		activeSubSkills.reduce((sum, skill) => sum + skill.inventory, 0),
		activeSubSkills.some((skill) => skill.name === "Helping Bonus"),
		activeSubSkills.some((skill) => skill.name === "Energy Recovery Bonus"),
		activeSubSkills.some((skill) => skill.isBFS),
	].join(":");
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

const neutralNatureCache = new Map<string, Nature>();

function getNeutralNature(pokemonName: string): Nature {
	const cached = neutralNatureCache.get(pokemonName);
	if (cached !== undefined) {
		return cached;
	}
	const nature = new PokemonIv({ pokemonName }).nature;
	neutralNatureCache.set(pokemonName, nature);
	return nature;
}

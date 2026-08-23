import {
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	FormLabel,
	InputLabel,
	MenuItem,
	Pagination,
	Select,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
} from "@mui/material";
import { styled } from "@mui/system";
import React from "react";
import { useTranslation } from "react-i18next";
import pokemons, {
	type IngredientName,
	IngredientNames,
} from "../data/pokemons";
import IngredientCountIcon from "../ui/IvCalc/IngredientCountIcon";
import IngredientIcon from "../ui/IvCalc/IngredientIcon";
import IvForm from "../ui/IvCalc/IvForm/IvForm";
import PokemonSelectDialog from "../ui/IvCalc/IvForm/PokemonSelectDialog";
import type { PokemonOption } from "../ui/IvCalc/IvForm/PokemonTextField";
import SleepingTimeControl from "../ui/IvCalc/IvForm/SleepingTimeControl";
import type IvState from "../ui/IvCalc/IvState";
import type { IvAction } from "../ui/IvCalc/IvState";
import PokemonIcon from "../ui/IvCalc/PokemonIcon";
import StrengthSettingForm from "../ui/IvCalc/Strength/StrengthParameterForm";
import StrengthParameterSummary from "../ui/IvCalc/Strength/StrengthParameterSummary";
import {
	calculateIngredientRankingAsync,
	createIngredientRankingBaselineIv,
	evaluatePokemonRankingTarget,
	groupIngredientRankingEntries,
	type IngredientRankingEntry,
	type IngredientRankingTarget,
	mergeIngredientRankingComparison,
} from "../util/IngredientRanking";
import PokemonIv from "../util/PokemonIv";

const pageSize = 100;
const rankingI18nKey = (key: string) => `fork.ingredientRanking.${key}`;

type ComparisonMode = "baseline" | "manual" | "registered";
const rankingTargets: IngredientRankingTarget[] = [
	"ingredientCount",
	"totalStrength",
	"berryStrength",
	"skillCount",
];
const rankingTargetLabelKeys = {
	ingredientCount: "ranking target ingredient count",
	totalStrength: "ranking target total strength",
	berryStrength: "ranking target berry strength",
	skillCount: "ranking target skill count",
} satisfies Record<IngredientRankingTarget, string>;

const IngredientRankingView = React.memo(
	({
		state,
		dispatch,
	}: {
		state: IvState;
		dispatch: React.Dispatch<IvAction>;
	}) => {
		const { i18n, t } = useTranslation();
		const parameter = state.parameter;
		const [pokemonName, setPokemonName] = React.useState("Skeledirge");
		const [rankingTarget, setRankingTarget] =
			React.useState<IngredientRankingTarget>("ingredientCount");
		const [ingredient, setIngredient] = React.useState<IngredientName>("apple");
		const [level, setLevel] = React.useState(60);
		const [ribbon, setRibbon] = React.useState<0 | 1 | 2 | 3 | 4>(0);
		const [ranking, setRanking] = React.useState<IngredientRankingEntry[]>([]);
		const [calculating, setCalculating] = React.useState(true);
		const [page, setPage] = React.useState(1);
		const [pokemonDialogOpen, setPokemonDialogOpen] = React.useState(false);
		const [comparisonMode, setComparisonMode] =
			React.useState<ComparisonMode>("baseline");
		const [manualIv, setManualIv] = React.useState(
			() => new PokemonIv({ pokemonName: "Skeledirge", level: 60 }),
		);
		const [manualDialogOpen, setManualDialogOpen] = React.useState(false);
		const [detailedSettingsOpen, setDetailedSettingsOpen] =
			React.useState(false);
		const [registeredId, setRegisteredId] = React.useState<number | "">("");
		const resetComparisonRef = React.useRef(true);

		const pokemonOptions = React.useMemo<PokemonOption[]>(
			() =>
				pokemons
					.filter((pokemon) => pokemon.isFullyEvolved)
					.map((pokemon) => ({
						...pokemon,
						idForm: new PokemonIv({ pokemonName: pokemon.name }).idForm,
						localName: t(`pokemons.${pokemon.name}`),
						isNonEvolving: pokemon.evolutionCount === -1,
						isFullyEvolved: true,
						ing1Name: pokemon.ing1.name,
						ing2Name: pokemon.ing2.name,
						ing3Name: pokemon.ing3?.name,
					})),
			[t],
		);
		const selectedPokemon = pokemonOptions.find(
			(option) => option.name === pokemonName,
		);
		if (selectedPokemon === undefined) {
			throw new Error(`Pokemon ${pokemonName} is not available`);
		}

		React.useEffect(() => {
			const controller = new AbortController();
			let active = true;
			setCalculating(true);
			setPage(1);

			calculateIngredientRankingAsync({
				pokemonName,
				target: rankingTarget,
				ingredient,
				level,
				ribbon,
				parameter,
				signal: controller.signal,
			})
				.then((result) => {
					if (active) {
						setRanking(result);
						setCalculating(false);
					}
				})
				.catch((error: unknown) => {
					if (error instanceof Error && error.name === "AbortError") {
						return;
					}
					console.error(error);
					if (active) {
						setRanking([]);
						setCalculating(false);
					}
				});

			return () => {
				active = false;
				controller.abort();
			};
		}, [ingredient, level, parameter, pokemonName, rankingTarget, ribbon]);

		const onPokemonButtonClick = React.useCallback(() => {
			setPokemonDialogOpen(true);
		}, []);
		const onPokemonDialogClose = React.useCallback(() => {
			setPokemonDialogOpen(false);
		}, []);
		const onPokemonChange = React.useCallback(
			(value: PokemonOption) => {
				resetComparisonRef.current = true;
				setComparisonMode("baseline");
				setRegisteredId("");
				setManualIv(new PokemonIv({ pokemonName: value.name, level }));
				setPokemonName(value.name);
				setPage(1);
			},
			[level],
		);

		const onIngredientChange = React.useCallback(
			(event: { target: { value: unknown } }) => {
				setIngredient(event.target.value as IngredientName);
				setPage(1);
			},
			[],
		);
		const onRankingTargetChange = React.useCallback(
			(event: { target: { value: unknown } }) => {
				setRankingTarget(event.target.value as IngredientRankingTarget);
				setPage(1);
			},
			[],
		);
		const onLevelChange = React.useCallback(
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const value = Number(event.target.value);
				if (Number.isInteger(value) && value >= 1 && value <= 100) {
					setLevel(value);
					setPage(1);
				}
			},
			[],
		);
		const onRibbonChange = React.useCallback((value: 0 | 1 | 2 | 3 | 4) => {
			setRibbon(value);
			setPage(1);
		}, []);
		const onPageChange = React.useCallback(
			(_event: React.ChangeEvent<unknown>, value: number) => {
				setPage(value);
			},
			[],
		);
		const onComparisonModeChange = React.useCallback(
			(_event: React.MouseEvent<HTMLElement>, value: ComparisonMode | null) => {
				if (value === null) {
					return;
				}
				if (
					value === "registered" &&
					registeredId === "" &&
					state.box.items[0] !== undefined
				) {
					setRegisteredId(state.box.items[0].id);
				}
				setComparisonMode(value);
				setPage(1);
			},
			[registeredId, state.box.items],
		);
		const onRegisteredChange = React.useCallback(
			(event: { target: { value: unknown } }) => {
				setRegisteredId(Number(event.target.value));
				setPage(1);
			},
			[],
		);
		const onManualEditClick = React.useCallback(() => {
			setManualDialogOpen(true);
		}, []);
		const onManualDialogClose = React.useCallback(() => {
			setManualDialogOpen(false);
		}, []);
		const countFormatter = React.useMemo(
			() =>
				new Intl.NumberFormat(i18n.language, {
					maximumFractionDigits: 2,
				}),
			[i18n.language],
		);
		const renderIngredient = React.useCallback(
			(name: IngredientName) => (
				<StyledIngredientOption>
					<IngredientIcon name={name} />
					<span>{t(rankingI18nKey(`ingredient names.${name}`))}</span>
				</StyledIngredientOption>
			),
			[t],
		);

		const baselineIv = React.useMemo(
			() =>
				createIngredientRankingBaselineIv({
					pokemonName,
					level,
					target: rankingTarget,
					ingredient,
					ribbon,
					parameter,
				}),
			[ingredient, level, parameter, pokemonName, rankingTarget, ribbon],
		);
		React.useEffect(() => {
			if (resetComparisonRef.current && baselineIv !== null) {
				setManualIv(baselineIv);
				resetComparisonRef.current = false;
			}
		}, [baselineIv]);
		const registeredItem =
			registeredId === ""
				? undefined
				: state.box.items.find((item) => item.id === registeredId);
		const comparisonIv =
			comparisonMode === "baseline"
				? baselineIv
				: comparisonMode === "manual"
					? manualIv
					: (registeredItem?.iv ?? null);
		const comparisonName =
			comparisonMode === "registered" && registeredItem !== undefined
				? registeredItem.filledNickname(t)
				: comparisonIv === null
					? ""
					: t(`pokemons.${comparisonIv.pokemonName}`);
		const comparisonEvaluation = React.useMemo(
			() =>
				calculating || comparisonIv === null
					? { status: "uncalculable" as const }
					: evaluatePokemonRankingTarget(
							comparisonIv,
							rankingTarget,
							ingredient,
							parameter,
						),
			[calculating, comparisonIv, ingredient, parameter, rankingTarget],
		);
		const rankingGroups = React.useMemo(
			() => groupIngredientRankingEntries(ranking),
			[ranking],
		);
		const comparison = React.useMemo(
			() =>
				mergeIngredientRankingComparison(
					rankingGroups,
					comparisonEvaluation,
					pageSize,
				),
			[comparisonEvaluation, rankingGroups],
		);
		const comparisonCount =
			comparison.evaluation.status === "uncalculable"
				? null
				: comparison.evaluation.count;
		const rankingTargetLabel = t(
			rankingI18nKey(rankingTargetLabelKeys[rankingTarget]),
		);
		const comparisonRank = comparison.rank;
		const theoreticalPageCount = Math.ceil(rankingGroups.length / pageSize);
		const pageCount = Math.max(
			1,
			theoreticalPageCount,
			comparison.page === null ? 0 : comparison.page + 1,
		);
		const clampedPage = Math.min(Math.max(page, 1), pageCount);
		const pageStart = (clampedPage - 1) * pageSize;
		const pageEnd = Math.min(pageStart + pageSize, rankingGroups.length);
		const pageGroups = rankingGroups.slice(pageStart, pageEnd);
		const comparisonGroupIndex = comparison.groupIndex;
		const comparisonOnPage =
			comparison.page === clampedPage - 1 && comparisonGroupIndex !== null;

		React.useEffect(() => {
			setPage((current) => Math.min(Math.max(current, 1), pageCount));
		}, [pageCount]);

		const onGoToRankClick = React.useCallback(() => {
			if (comparison.page !== null) {
				setPage(comparison.page + 1);
			}
		}, [comparison.page]);
		const onDetailedSettingsClick = React.useCallback(() => {
			setDetailedSettingsOpen(true);
		}, []);
		const onDetailedSettingsClose = React.useCallback(() => {
			setDetailedSettingsOpen(false);
		}, []);

		return (
			<StyledRanking>
				<StyledConditionSummary>
					<StyledConditionHeader>
						<strong>{t(rankingI18nKey("ranking common settings"))}</strong>
						<Button size="small" onClick={onDetailedSettingsClick}>
							{t(rankingI18nKey("detailed settings"))}
						</Button>
					</StyledConditionHeader>
					<StrengthParameterSummary state={state} dispatch={dispatch} />
					<StyledSleepScore>
						{t("sleep score")}: {parameter.sleepScore}
					</StyledSleepScore>
					<StyledRankingLevelNote>
						{t(rankingI18nKey("ranking uses selected levels"))}
					</StyledRankingLevelNote>
				</StyledConditionSummary>
				<StyledControls>
					<FormControl required>
						<StyledPokemonLabel>{t("pokemon")}</StyledPokemonLabel>
						<StyledPokemonButton
							variant="outlined"
							size="small"
							onClick={onPokemonButtonClick}
						>
							<PokemonIcon
								idForm={selectedPokemon.idForm}
								shiny={false}
								size={28}
							/>
							<span>{selectedPokemon.localName}</span>
						</StyledPokemonButton>
					</FormControl>
					<FormControl variant="standard" size="small" required>
						<InputLabel id="ingredient-ranking-target-kind-label">
							{t(rankingI18nKey("ranking target"))}
						</InputLabel>
						<Select
							labelId="ingredient-ranking-target-kind-label"
							value={rankingTarget}
							onChange={onRankingTargetChange}
						>
							{rankingTargets.map((target) => (
								<MenuItem key={target} value={target}>
									{t(rankingI18nKey(rankingTargetLabelKeys[target]))}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					{rankingTarget === "ingredientCount" && (
						<FormControl variant="standard" size="small" required>
							<InputLabel id="ingredient-ranking-target-label">
								{t(rankingI18nKey("target ingredient"))}
							</InputLabel>
							<Select
								labelId="ingredient-ranking-target-label"
								value={ingredient}
								onChange={onIngredientChange}
								renderValue={renderIngredient}
							>
								{IngredientNames.map((name) => (
									<MenuItem key={name} value={name}>
										{renderIngredient(name)}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}
					<TextField
						variant="standard"
						size="small"
						type="number"
						label={t("level")}
						value={level}
						required
						onChange={onLevelChange}
						slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
					/>
					<StyledSleepingTimeControl>
						<FormLabel>{t("sleeping time shared")}</FormLabel>
						<SleepingTimeControl value={ribbon} onChange={onRibbonChange} />
					</StyledSleepingTimeControl>
				</StyledControls>
				<Dialog
					fullWidth
					maxWidth="sm"
					open={detailedSettingsOpen}
					onClose={onDetailedSettingsClose}
				>
					<DialogTitle>{t(rankingI18nKey("detailed settings"))}</DialogTitle>
					<StyledDetailedSettingsContent>
						<StrengthSettingForm
							value={parameter}
							items={state.box.items}
							hasHelpingBonus={state.pokemonIv.hasHelpingBonusInActiveSubSkills}
							dispatch={dispatch}
						/>
					</StyledDetailedSettingsContent>
					<DialogActions>
						<Button onClick={onDetailedSettingsClose}>{t("close")}</Button>
					</DialogActions>
				</Dialog>
				<PokemonSelectDialog
					open={pokemonDialogOpen}
					shiny={false}
					pokemonOptions={pokemonOptions}
					selectedValue={selectedPokemon}
					onClose={onPokemonDialogClose}
					onChange={onPokemonChange}
				/>

				<StyledComparisonCard>
					<StyledComparisonHeader>
						<strong>{t(rankingI18nKey("comparison target"))}</strong>
						<ToggleButtonGroup
							exclusive
							size="small"
							value={comparisonMode}
							onChange={onComparisonModeChange}
						>
							<ToggleButton value="baseline">
								{t(rankingI18nKey("comparison baseline"))}
							</ToggleButton>
							<ToggleButton value="manual">
								{t(rankingI18nKey("comparison manual"))}
							</ToggleButton>
							<ToggleButton value="registered">
								{t(rankingI18nKey("comparison registered"))}
							</ToggleButton>
						</ToggleButtonGroup>
					</StyledComparisonHeader>
					{comparisonMode === "registered" && (
						<FormControl variant="standard" size="small">
							<InputLabel>{t(rankingI18nKey("registered pokemon"))}</InputLabel>
							<Select
								value={registeredId}
								onChange={onRegisteredChange}
								label={t(rankingI18nKey("registered pokemon"))}
							>
								{state.box.items.map((item) => (
									<MenuItem key={item.id} value={item.id}>
										<PokemonIcon
											idForm={item.iv.idForm}
											shiny={item.iv.shiny}
											size={24}
										/>
										<span>{item.filledNickname(t)}</span>
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}
					{comparisonMode === "manual" && (
						<Button size="small" onClick={onManualEditClick}>
							{t(rankingI18nKey("edit comparison target"))}
						</Button>
					)}
					{comparisonIv !== null ? (
						<ComparisonSummary
							iv={comparisonIv}
							name={comparisonName}
							count={comparisonCount}
							rank={comparisonRank}
							valueLabel={rankingTargetLabel}
							countFormatter={countFormatter}
							onGoToRankClick={onGoToRankClick}
						/>
					) : (
						<StyledUnavailable>
							{t(rankingI18nKey("comparison unavailable"))}
						</StyledUnavailable>
					)}
				</StyledComparisonCard>
				<Dialog
					fullWidth
					maxWidth="sm"
					open={manualDialogOpen}
					onClose={onManualDialogClose}
				>
					<DialogTitle>
						{t(rankingI18nKey("edit comparison target"))}
					</DialogTitle>
					<DialogContent>
						<IvForm
							parameter={parameter}
							pokemonIv={manualIv}
							dispatch={dispatch}
							onChange={(value) => {
								setManualIv(value);
								setPage(1);
							}}
						/>
					</DialogContent>
				</Dialog>

				<StyledPaginationSummary>
					<span>
						{t(rankingI18nKey("ranking result range"), {
							start: pageGroups.length === 0 ? 0 : pageStart + 1,
							end: pageGroups.length === 0 ? 0 : pageEnd,
							total: ranking.length,
							groups: rankingGroups.length,
						})}
					</span>
					<Pagination
						count={pageCount}
						page={clampedPage}
						size="small"
						onChange={onPageChange}
					/>
				</StyledPaginationSummary>
				<StyledResults>
					<StyledHeader>
						<span>{t(rankingI18nKey("rank"))}</span>
						<span>{t("pokemon")}</span>
						<span>{t(rankingI18nKey("ingredient configuration"))}</span>
						<span>{rankingTargetLabel}</span>
					</StyledHeader>
					{calculating && (
						<StyledLoading>
							<CircularProgress size={30} />
						</StyledLoading>
					)}
					{!calculating && ranking.length === 0 && (
						<StyledEmpty>{t(rankingI18nKey("no ranking results"))}</StyledEmpty>
					)}
					{!calculating &&
						pageGroups.flatMap((group, index) => {
							const rank = pageStart + index + 1;
							const rows: React.ReactNode[] = [];
							if (
								comparisonOnPage &&
								comparisonGroupIndex === pageStart + index &&
								comparisonIv !== null
							) {
								rows.push(
									<ComparisonRow
										key={`comparison-row-${comparisonRank}`}
										iv={comparisonIv}
										name={comparisonName}
										count={comparisonCount}
										rank={comparisonRank}
										countFormatter={countFormatter}
									/>,
								);
							}
							rows.push(
								...group.entries.map((result) => (
									<RankingRow
										key={`${result.pokemon.id}-${result.iv.form}-${result.ordinal}-${result.natureOrder}-${result.subSkillOrder}-${result.count}-${result.variants.length}`}
										result={result}
										rank={rank}
										countFormatter={countFormatter}
									/>
								)),
							);
							return rows;
						})}
					{!calculating &&
						comparisonOnPage &&
						comparisonGroupIndex === pageEnd &&
						comparisonIv !== null && (
							<ComparisonRow
								iv={comparisonIv}
								name={comparisonName}
								count={comparisonCount}
								rank={comparisonRank}
								countFormatter={countFormatter}
							/>
						)}
				</StyledResults>
				<StyledPaginationSummary>
					<span />
					<Pagination
						count={pageCount}
						page={clampedPage}
						size="small"
						onChange={onPageChange}
					/>
				</StyledPaginationSummary>
			</StyledRanking>
		);
	},
);

const RankingRow = React.memo(
	({
		result,
		rank,
		countFormatter,
	}: {
		result: IngredientRankingEntry;
		rank: number;
		countFormatter: Intl.NumberFormat;
	}) => {
		const { t } = useTranslation();
		const [selectedVariantIndex, setSelectedVariantIndex] = React.useState(0);
		const variantIndex = Math.min(
			selectedVariantIndex,
			Math.max(result.variants.length - 1, 0),
		);
		const selectedVariant = result.variants[variantIndex] ?? result.variants[0];
		const selectedIv = selectedVariant?.iv ?? result.iv;

		return (
			<StyledRow>
				<strong>{rank}</strong>
				<PokemonSummary
					iv={selectedIv}
					nameKey={`pokemons.${result.pokemon.name}`}
					neutralSubSkillCount={selectedVariant?.neutralSubSkillCount ?? 0}
					traitSelector={
						result.variants.length > 1 ? (
							<StyledVariantSelect
								variant="standard"
								size="small"
								value={variantIndex}
								onChange={(event) => {
									setSelectedVariantIndex(Number(event.target.value));
								}}
								aria-label={t(rankingI18nKey("ranking equivalent variants"))}
								renderValue={(value) =>
									t(rankingI18nKey("ranking variant label"), {
										current: Number(value) + 1,
										count: result.variants.length,
									})
								}
							>
								{result.variants.map((variant, index) => (
									<MenuItem
										key={`${variant.natureOrder}-${variant.subSkillOrder}-${variant.neutralSubSkillCount}`}
										value={index}
									>
										<RankingVariantOption variant={variant} />
									</MenuItem>
								))}
							</StyledVariantSelect>
						) : undefined
					}
				/>
				<IngredientConfiguration iv={result.iv} />
				<StyledCount>{countFormatter.format(result.count)}</StyledCount>
			</StyledRow>
		);
	},
);

const RankingVariantOption = React.memo(
	({ variant }: { variant: IngredientRankingEntry["variants"][number] }) => {
		const { t } = useTranslation();
		const subSkillNames = variant.iv.activeSubSkills.map((subSkill) =>
			t(`subskill.${subSkill.name}`),
		);
		if (variant.neutralSubSkillCount > 0) {
			subSkillNames.push(
				`${t(rankingI18nKey("neutral subskill"))} ×${variant.neutralSubSkillCount}`,
			);
		}

		return (
			<StyledVariantOption>
				<strong>{t(`natures.${variant.iv.nature.name}`)}</strong>
				<span>{subSkillNames.join(" / ") || "-"}</span>
			</StyledVariantOption>
		);
	},
);

const ComparisonRow = React.memo(
	({
		iv,
		name,
		count,
		rank,
		countFormatter,
	}: {
		iv: PokemonIv;
		name: string;
		count: number | null;
		rank: number | null;
		countFormatter: Intl.NumberFormat;
	}) => {
		const { t } = useTranslation();
		return (
			<StyledRow className="comparison">
				<strong>{rank ?? "-"}</strong>
				<PokemonSummary iv={iv} name={name} />
				<IngredientConfiguration iv={iv} />
				<StyledCount>
					{count === null
						? t(rankingI18nKey("comparison unavailable"))
						: countFormatter.format(count)}
				</StyledCount>
			</StyledRow>
		);
	},
);

const PokemonSummary = React.memo(
	({
		iv,
		name,
		nameKey,
		neutralSubSkillCount = 0,
		traitSelector,
	}: {
		iv: PokemonIv;
		name?: string;
		nameKey?: string;
		neutralSubSkillCount?: number;
		traitSelector?: React.ReactNode;
	}) => {
		const { t } = useTranslation();
		return (
			<StyledPokemon>
				<PokemonIcon idForm={iv.idForm} shiny={iv.shiny} size={40} />
				<StyledPokemonSummary>
					<StyledPokemonName>
						{name ?? (nameKey === undefined ? "" : t(nameKey))}
					</StyledPokemonName>
					{traitSelector}
					<AppliedTraits iv={iv} neutralSubSkillCount={neutralSubSkillCount} />
				</StyledPokemonSummary>
			</StyledPokemon>
		);
	},
);

const AppliedTraits = React.memo(
	({
		iv,
		neutralSubSkillCount = 0,
	}: {
		iv: PokemonIv;
		neutralSubSkillCount?: number;
	}) => {
		const { t } = useTranslation();
		const subSkillNames = iv.activeSubSkills.map((subSkill) =>
			t(`subskill.${subSkill.name}`),
		);
		if (neutralSubSkillCount > 0) {
			subSkillNames.push(
				`${t(rankingI18nKey("neutral subskill"))} ×${neutralSubSkillCount}`,
			);
		}
		return (
			<StyledAppliedTraits>
				<span>
					<StyledTraitLabel>{t("sub skills")}:</StyledTraitLabel>
					{subSkillNames.join(" / ") || "-"}
				</span>
				<span>
					<StyledTraitLabel>{t("nature")}:</StyledTraitLabel>
					{iv.nature.upEffect === "No effect" ? (
						t("nature effect.No effect")
					) : (
						<>
							<StyledNatureUp>UP</StyledNatureUp>
							{t(`nature effect.${iv.nature.upEffect}`)}{" "}
							<StyledNatureDown>DOWN</StyledNatureDown>
							{t(`nature effect.${iv.nature.downEffect}`)}
						</>
					)}
				</span>
			</StyledAppliedTraits>
		);
	},
);

const IngredientConfiguration = React.memo(({ iv }: { iv: PokemonIv }) => (
	<StyledIngredients>
		{getIngredientSlots(iv).map((slot) => (
			<IngredientCountIcon
				key={slot.index}
				name={slot.name}
				count={slot.count}
			/>
		))}
	</StyledIngredients>
));

const ComparisonSummary = React.memo(
	({
		iv,
		name,
		count,
		rank,
		valueLabel,
		countFormatter,
		onGoToRankClick,
	}: {
		iv: PokemonIv;
		name: string;
		count: number | null;
		rank: number | null;
		valueLabel: string;
		countFormatter: Intl.NumberFormat;
		onGoToRankClick: () => void;
	}) => {
		const { t } = useTranslation();
		return (
			<StyledComparisonSummary>
				<PokemonSummary iv={iv} name={name} />
				<div>
					<strong>{t("level")}:</strong> {iv.level}
				</div>
				<IngredientConfiguration iv={iv} />
				<div>
					<strong>{valueLabel}:</strong>{" "}
					{count === null
						? t(rankingI18nKey("comparison unavailable"))
						: countFormatter.format(count)}
				</div>
				<div>
					<strong>{t(rankingI18nKey("equivalent rank"))}:</strong>{" "}
					{rank === null ? t(rankingI18nKey("comparison unavailable")) : rank}
				</div>
				<Button size="small" disabled={rank === null} onClick={onGoToRankClick}>
					{t(rankingI18nKey("go to comparison rank"))}
				</Button>
			</StyledComparisonSummary>
		);
	},
);

function getIngredientSlots(iv: PokemonIv) {
	try {
		return [iv.ingredient1, iv.ingredient2, iv.ingredient3];
	} catch {
		return [iv.ingredient1, iv.ingredient2];
	}
}

const StyledRanking = styled("section")({
	paddingBottom: ".4rem",
});

const StyledDetailedSettingsContent = styled(DialogContent)({
	"& > div": {
		padding: 0,
		marginBottom: 0,
	},
});

const StyledConditionSummary = styled("section")({
	marginBottom: ".8rem",
	"& .edit": {
		display: "none",
	},
	"& .level": {
		display: "none",
	},
});

const StyledConditionHeader = styled("div")({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	marginBottom: ".2rem",
	fontSize: ".8rem",
	"& > button": {
		padding: 0,
		fontSize: ".75rem",
		textTransform: "none",
	},
});

const StyledSleepScore = styled("div")({
	marginTop: ".25rem",
	paddingLeft: ".6rem",
	color: "#555",
	fontSize: ".75rem",
});

const StyledRankingLevelNote = styled("div")({
	paddingLeft: ".6rem",
	color: "#555",
	fontSize: ".75rem",
});

const StyledControls = styled("div")({
	display: "grid",
	gridTemplateColumns:
		"minmax(10rem, 1.2fr) minmax(8rem, .8fr) minmax(10rem, 1fr) minmax(5rem, .4fr) minmax(8rem, .7fr)",
	gap: "1rem",
	alignItems: "end",
	marginBottom: ".8rem",
	"& svg": {
		verticalAlign: "middle",
	},
	"@media (max-width: 600px)": {
		gridTemplateColumns: "minmax(0, 1fr) minmax(5rem, .45fr)",
		"& > div:first-of-type": {
			gridColumn: "1 / -1",
		},
	},
});

const StyledSleepingTimeControl = styled(FormControl)({
	minWidth: 0,
	"& > label": {
		marginBottom: ".15rem",
		fontSize: ".75rem",
		lineHeight: 1,
	},
	"& .MuiInputBase-root": {
		minWidth: 0,
		maxWidth: "100%",
	},
});

const StyledComparisonCard = styled("section")({
	display: "flex",
	flexDirection: "column",
	gap: ".6rem",
	marginBottom: ".8rem",
	padding: ".6rem",
	border: "1px solid #ccd5dd",
	borderRadius: ".6rem",
	background: "#f8fafc",
	"& .MuiSelect-select": {
		display: "flex",
		alignItems: "center",
		gap: ".4rem",
	},
});

const StyledComparisonHeader = styled("div")({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: ".5rem",
	"& .MuiToggleButton-root": {
		padding: ".2rem .5rem",
		fontSize: ".72rem",
		textTransform: "none",
	},
	"@media (max-width: 600px)": {
		alignItems: "stretch",
		flexDirection: "column",
	},
});

const StyledComparisonSummary = styled("div")({
	display: "grid",
	gridTemplateColumns: "minmax(10rem, 1.4fr) auto auto auto auto",
	gap: ".5rem 1rem",
	alignItems: "center",
	fontSize: ".78rem",
	"& > button": {
		whiteSpace: "nowrap",
	},
	"@media (max-width: 700px)": {
		gridTemplateColumns: "minmax(0, 1fr) auto",
		"& > div:first-of-type": {
			gridColumn: "1 / -1",
		},
	},
});

const StyledUnavailable = styled("div")({
	color: "#666",
	fontSize: ".8rem",
});

const StyledPaginationSummary = styled("div")({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: ".5rem",
	margin: ".35rem 0",
	color: "#666",
	fontSize: ".75rem",
	"@media (max-width: 600px)": {
		alignItems: "flex-start",
		flexDirection: "column",
	},
});

const StyledPokemonLabel = styled(FormLabel)({
	marginBottom: ".15rem",
	fontSize: ".75rem",
	lineHeight: 1,
});

const StyledPokemonButton = styled(Button)({
	justifyContent: "flex-start",
	gap: ".4rem",
	minWidth: 0,
	padding: ".2rem .5rem",
	color: "inherit",
	textTransform: "none",
	"& > span": {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
});

const StyledIngredientOption = styled("span")({
	display: "inline-flex",
	alignItems: "center",
	gap: ".4rem",
});

const StyledResults = styled("div")({
	maxHeight: "min(52vh, 36rem)",
	overflowY: "auto",
	borderBottom: "1px solid #ddd",
});

const StyledHeader = styled("div")({
	display: "grid",
	gridTemplateColumns: "3rem minmax(9rem, 1fr) minmax(9rem, 1fr) 7rem",
	gap: ".5rem",
	padding: ".35rem .5rem",
	color: "#666",
	fontSize: ".75rem",
	borderBottom: "1px solid #ddd",
	position: "sticky",
	top: 0,
	zIndex: 1,
	background: "#f9f9f9",
	"& > span:last-of-type": {
		textAlign: "right",
	},
	"@media (max-width: 600px)": {
		display: "none",
	},
});

const StyledRow = styled("div")({
	display: "grid",
	gridTemplateColumns: "3rem minmax(9rem, 1fr) minmax(9rem, 1fr) 7rem",
	gap: ".5rem",
	alignItems: "center",
	minHeight: "52px",
	padding: ".35rem .5rem",
	borderBottom: "1px solid #eee",
	"&.comparison": {
		background: "#fff6d6",
		borderTop: "2px solid #e0a800",
		borderBottom: "2px solid #e0a800",
	},
	"& > strong": {
		textAlign: "center",
	},
	"@media (max-width: 600px)": {
		gridTemplateColumns: "2.5rem minmax(8rem, 1fr) max-content",
	},
});

const StyledPokemon = styled("div")({
	display: "flex",
	alignItems: "center",
	gap: ".5rem",
	minWidth: 0,
	"@media (max-width: 600px)": {
		gridColumn: "2 / 4",
	},
});

const StyledPokemonSummary = styled("div")({
	display: "flex",
	flexDirection: "column",
	gap: ".15rem",
	minWidth: 0,
});

const StyledPokemonName = styled("span")({
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
});

const StyledVariantSelect = styled(Select)({
	width: "min(100%, 12rem)",
	minWidth: 0,
	fontSize: ".68rem",
	"& .MuiSelect-select": {
		overflow: "hidden",
		paddingTop: ".1rem",
		paddingBottom: ".1rem",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	"@media (max-width: 600px)": {
		width: "100%",
	},
});

const StyledVariantOption = styled("span")({
	display: "flex",
	flexDirection: "column",
	maxWidth: "min(28rem, 75vw)",
	fontSize: ".75rem",
	lineHeight: 1.3,
	whiteSpace: "normal",
	wordBreak: "break-word",
});

const StyledAppliedTraits = styled("div")({
	display: "flex",
	flexDirection: "column",
	gap: ".1rem",
	minWidth: 0,
	color: "#666",
	fontSize: ".68rem",
	lineHeight: 1.25,
	"& > span": {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
});

const StyledTraitLabel = styled("strong")({
	marginRight: ".25rem",
	fontWeight: 500,
});

const StyledNatureUp = styled("strong")({
	marginRight: ".2rem",
	color: "#d32f2f",
	fontSize: ".62rem",
});

const StyledNatureDown = styled("strong")({
	marginRight: ".2rem",
	marginLeft: ".5rem",
	color: "#1976d2",
	fontSize: ".62rem",
});

const StyledIngredients = styled("div")({
	display: "flex",
	alignItems: "center",
	minHeight: "28px",
	"@media (max-width: 600px)": {
		gridColumn: "2 / 3",
	},
});

const StyledCount = styled("div")({
	textAlign: "right",
	fontWeight: 700,
	fontVariantNumeric: "tabular-nums",
	"@media (max-width: 600px)": {
		gridColumn: 3,
	},
});

const StyledEmpty = styled("p")({
	margin: "1rem .5rem",
	color: "#666",
	fontSize: ".9rem",
});

const StyledLoading = styled("div")({
	display: "flex",
	justifyContent: "center",
	padding: "1.5rem",
});

export default IngredientRankingView;

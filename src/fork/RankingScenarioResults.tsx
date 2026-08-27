import {
	Alert,
	Box,
	Button,
	ButtonBase,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Pagination,
	Stack,
	Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import IngredientCountIcon from "../ui/IvCalc/IngredientCountIcon";
import {
	StyledNatureDownEffect,
	StyledNatureUpEffect,
} from "../ui/IvCalc/IvForm/NatureTextField";
import PokemonIcon from "../ui/IvCalc/PokemonIcon";
import type PokemonIv from "../util/PokemonIv";
import type { StrengthParameter } from "../util/PokemonStrength";
import type {
	RankingScenarioEntry,
	RankingScenarioEvaluation,
	RankingScenarioGroup,
	RankingScenarioResult,
} from "../util/RankingScenario";
import RankingPokemonDetailDialog from "./RankingPokemonDetailDialog";
import { ribbonLabels } from "./RankingScenarioOptions";

export const rankingPageSize = 100;
export const partialRankingGroupLimit = 25;

interface RankingScenarioResultsProps {
	result: RankingScenarioResult;
	comparison: RankingScenarioEvaluation | null;
	comparisonIv: PokemonIv | null;
	stale: boolean;
	metricLabel: string;
	environment: StrengthParameter;
	isPartial?: boolean;
	onAddComparison: () => void;
	onEditComparison: () => void;
	onRemoveComparison: () => void;
}

/** Same dense insertion semantics as the existing ingredient comparison flow. */
export function locateScenarioComparison(
	groups: readonly RankingScenarioGroup[],
	comparison: RankingScenarioEvaluation | null,
) {
	if (!comparison || comparison.status === "uncalculable")
		return { rank: null, page: null, groupIndex: null };
	let index = groups.findIndex((group) => group.value <= comparison.value);
	if (index < 0) index = groups.length;
	return {
		rank: index + 1,
		page: Math.floor(index / rankingPageSize) + 1,
		groupIndex: index,
	};
}

export function ScenarioIvSummary({
	iv,
	neutralSubSkillCount = 0,
	onClick,
}: {
	iv: PokemonIv;
	neutralSubSkillCount?: number;
	onClick?: () => void;
}) {
	const { t } = useTranslation();
	const slots = [
		[1, iv.ingredient1],
		[30, iv.ingredient2],
		[60, iv.ingredient3],
	] as const;
	const subSkills = iv.activeSubSkills.map((skill) =>
		t(`subskill.${skill.name}`),
	);
	if (neutralSubSkillCount > 0)
		subSkills.push(
			t("fork.ingredientRanking.neutral subskill") +
				` ×${neutralSubSkillCount}`,
		);
	const summary = (
		<Stack direction="row" gap={1} alignItems="center" sx={{ minWidth: 0 }}>
			<PokemonIcon idForm={iv.idForm} shiny={iv.shiny} size={36} />
			<div>
				<Typography variant="body2" fontWeight="bold">
					{t(`pokemons.${iv.pokemonName}`)} · Lv {iv.level}
				</Typography>
				<Stack direction="row" alignItems="center" sx={{ minHeight: 28 }}>
					{slots.map(([level, slot]) => (
						<IngredientCountIcon
							key={level}
							name={slot.name}
							count={slot.count}
						/>
					))}
				</Stack>
				<Typography variant="caption" component="div" color="text.secondary">
					<strong>{t("sub skills")}:</strong> {subSkills.join(" / ") || "-"}
				</Typography>
				<Typography variant="caption" component="div" color="text.secondary">
					<strong>{t("nature")}:</strong>{" "}
					{iv.nature.upEffect === "No effect" ? (
						t("nature effect.No effect")
					) : (
						<>
							<StyledNatureUpEffect>UP</StyledNatureUpEffect>{" "}
							{t(`nature effect.${iv.nature.upEffect}`)}{" "}
							<StyledNatureDownEffect>DOWN</StyledNatureDownEffect>{" "}
							{t(`nature effect.${iv.nature.downEffect}`)}
						</>
					)}
					{` · ${t("skill level")} ${iv.skillLevel} · ${t(ribbonLabels[iv.ribbon])}`}
				</Typography>
			</div>
		</Stack>
	);
	if (!onClick) return summary;
	return (
		<ButtonBase
			onClick={onClick}
			aria-label={`${t(`pokemons.${iv.pokemonName}`)} ${t("details")}`}
			sx={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
		>
			{summary}
		</ButtonBase>
	);
}

function RankingScenarioResults({
	result,
	comparison,
	comparisonIv,
	stale,
	metricLabel,
	environment,
	isPartial = false,
	onAddComparison,
	onEditComparison,
	onRemoveComparison,
}: RankingScenarioResultsProps) {
	const { t, i18n } = useTranslation();
	const [page, setPage] = React.useState(1);
	const [detailEntries, setDetailEntries] = React.useState<
		readonly RankingScenarioEntry[] | null
	>(null);
	const [detailPage, setDetailPage] = React.useState(1);
	const [abilityIv, setAbilityIv] = React.useState<PokemonIv | null>(null);
	const openAbility = (iv: PokemonIv) => {
		setDetailEntries(null);
		setAbilityIv(iv);
	};
	const merged = React.useMemo(
		() => locateScenarioComparison(result.groups, comparison),
		[result.groups, comparison],
	);
	const formatter = React.useMemo(
		() => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }),
		[i18n.language],
	);
	const pageCount = isPartial
		? 1
		: Math.max(
				1,
				Math.ceil(result.groups.length / rankingPageSize),
				merged.page ?? 1,
			);
	const currentPage = Math.min(page, pageCount);
	const start = isPartial ? 0 : (currentPage - 1) * rankingPageSize;
	const end = Math.min(
		start + (isPartial ? partialRankingGroupLimit : rankingPageSize),
		result.groups.length,
	);
	const previousResult = React.useRef(result);
	React.useEffect(() => {
		if (previousResult.current !== result) {
			setPage(1);
			setDetailEntries(null);
			previousResult.current = result;
		}
	}, [result]);
	const jump = () => {
		if (merged.page === null) return;
		setPage(merged.page);
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				document
					.getElementById("ranking-comparison-row")
					?.scrollIntoView({ block: "center", behavior: "smooth" }),
			),
		);
	};
	const comparisonRow =
		comparisonIv && comparison && comparison.status !== "uncalculable" ? (
			<Box
				id="ranking-comparison-row"
				key="comparison"
				sx={{
					border: "2px solid",
					borderColor: "primary.main",
					p: 1,
					bgcolor: "action.selected",
				}}
			>
				<Stack direction="row" justifyContent="space-between">
					<Typography fontWeight="bold">
						{merged.rank} · {t("fork.scenario.comparison")}
					</Typography>
					<Typography fontWeight="bold">
						{formatter.format(comparison.value)}
					</Typography>
				</Stack>
				<ScenarioIvSummary iv={comparisonIv} />
			</Box>
		) : null;
	return (
		<Stack gap={1}>
			<Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
				<Typography variant="h6" sx={{ mr: "auto" }}>
					{metricLabel}
				</Typography>
				{!comparisonIv && (
					<Button onClick={() => onAddComparison()}>
						{t("fork.scenario.add comparison")}
					</Button>
				)}
			</Stack>
			{comparisonIv && (
				<Box
					sx={{
						border: "2px solid",
						borderColor: "primary.main",
						p: 1,
						borderRadius: 1,
					}}
				>
					<Typography fontWeight="bold">
						{t("fork.scenario.comparison")}
						{merged.rank !== null &&
							` · ${t("fork.ingredientRanking.rank")} ${merged.rank}`}
					</Typography>
					<ScenarioIvSummary iv={comparisonIv} />
					{comparison?.status === "uncalculable" ? (
						<Alert severity="warning">
							{t(`fork.scenario.reason ${comparison.reason}`)}
						</Alert>
					) : comparison ? (
						<Typography>
							{metricLabel}: {formatter.format(comparison.value)}
						</Typography>
					) : (
						<Typography>
							{t(
								stale
									? "fork.scenario.stale comparison"
									: "fork.scenario.comparison pending",
							)}
						</Typography>
					)}
					<Button onClick={onEditComparison}>{t("edit")}</Button>
					<Button disabled={merged.page === null} onClick={jump}>
						{t("fork.scenario.jump")}
					</Button>
					<Button onClick={onRemoveComparison}>
						{t("fork.scenario.remove comparison")}
					</Button>
				</Box>
			)}
			{result.exclusions.map((exclusion) => (
				<Alert key={exclusion.reason} severity="warning">
					{t("fork.scenario.excluded", {
						count: exclusion.count,
						reason: t(`fork.scenario.reason ${exclusion.reason}`),
					})}
				</Alert>
			))}
			<Typography variant="body2" color="text.secondary">
				{t("fork.scenario.result counts", {
					start:
						result.groups.length === 0 || start >= result.groups.length
							? 0
							: start + 1,
					end: start >= result.groups.length ? 0 : end,
					groups: result.groups.length,
					count: result.entries.length,
				})}
			</Typography>
			{result.groups.length === 0 && (
				<Typography>
					{t("fork.ingredientRanking.no ranking results")}
				</Typography>
			)}
			{pageCount > 1 && (
				<Pagination
					count={pageCount}
					page={currentPage}
					onChange={(_event, next) => setPage(next)}
					size="small"
				/>
			)}
			{result.groups.slice(start, end).map((group, offset) => (
				<React.Fragment key={group.value}>
					{merged.page === currentPage &&
						merged.groupIndex === start + offset &&
						comparisonRow}
					<Box
						data-testid="ranking-result-group"
						sx={{ borderBottom: "1px solid", borderColor: "divider", p: 1 }}
					>
						<Stack
							direction="row"
							alignItems="center"
							justifyContent="space-between"
							gap={1}
						>
							<Typography fontWeight="bold">{start + offset + 1}</Typography>
							<Typography fontWeight="bold">
								{formatter.format(group.value)}
							</Typography>
						</Stack>
						{group.entries[0] && (
							<ScenarioIvSummary
								iv={group.entries[0].iv}
								neutralSubSkillCount={group.entries[0].neutralSubSkillCount}
								onClick={() => openAbility(group.entries[0].iv)}
							/>
						)}
						{group.entries.length > 0 && (
							<Stack direction="row" flexWrap="wrap">
								<Button
									size="small"
									onClick={() => {
										setDetailEntries(group.entries);
										setDetailPage(1);
									}}
								>
									{t("fork.scenario.show conditions", {
										count: group.entries.length,
									})}
								</Button>
							</Stack>
						)}
					</Box>
				</React.Fragment>
			))}
			{merged.page === currentPage &&
				merged.groupIndex === end &&
				comparisonRow}
			{pageCount > 1 && (
				<Pagination
					count={pageCount}
					page={currentPage}
					onChange={(_event, next) => setPage(next)}
					size="small"
				/>
			)}
			<Dialog
				open={detailEntries !== null}
				onClose={() => setDetailEntries(null)}
				fullWidth
				maxWidth="sm"
			>
				<DialogTitle>{t("fork.scenario.conditions")}</DialogTitle>
				<DialogContent>
					{detailEntries
						?.slice((detailPage - 1) * 50, detailPage * 50)
						.map((entry) => (
							<Box key={entry.id} sx={{ mb: 2 }}>
								<ScenarioIvSummary
									iv={entry.iv}
									neutralSubSkillCount={entry.neutralSubSkillCount}
									onClick={() => openAbility(entry.iv)}
								/>
							</Box>
						))}
					{detailEntries && detailEntries.length > 50 && (
						<Pagination
							count={Math.ceil(detailEntries.length / 50)}
							page={detailPage}
							onChange={(_event, next) => setDetailPage(next)}
							size="small"
						/>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDetailEntries(null)}>{t("close")}</Button>
				</DialogActions>
			</Dialog>
			{abilityIv && (
				<RankingPokemonDetailDialog
					open
					iv={abilityIv}
					environment={environment}
					summary={<ScenarioIvSummary iv={abilityIv} />}
					onClose={() => setAbilityIv(null)}
				/>
			)}
		</Stack>
	);
}

// Progress is updated every small candidate batch so abort stays responsive.
// The ranking itself only changes on a throttled partial/final result; memoizing
// here prevents those progress-only parent renders from rebuilding 25–100 rows.
export default React.memo(RankingScenarioResults);

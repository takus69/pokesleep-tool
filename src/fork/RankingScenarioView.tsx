import {
	Alert,
	Autocomplete,
	Box,
	Button,
	CircularProgress,
	MenuItem,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import fields from "../data/fields";
import pokemons, {
	type IngredientName,
	IngredientNames,
	type PokemonType,
	PokemonTypes,
} from "../data/pokemons";
import IngredientIcon from "../ui/IvCalc/IngredientIcon";
import type IvState from "../ui/IvCalc/IvState";
import type { IvAction } from "../ui/IvCalc/IvState";
import { type MainSkillName, MainSkillNames } from "../util/MainSkill";
import type PokemonIv from "../util/PokemonIv";
import {
	getCurrentFavoriteBerries,
	type StrengthParameter,
} from "../util/PokemonStrength";
import {
	type RankingScenarioConfig,
	type RankingScenarioMetric,
	type RankingScenarioPurpose,
	rankingScenarioMetrics,
	validateRankingScenario,
} from "../util/RankingScenario";
import RankingEnvironmentDialog from "./RankingEnvironmentDialog";
import RankingScenarioOptions, {
	RankingOptionSummary,
} from "./RankingScenarioOptions";
import RankingScenarioResults from "./RankingScenarioResults";
import { rankingScenarioPurposes } from "./RankingScenarioState";
import useRankingScenario from "./useRankingScenario";

const key = (value: string) => `fork.scenario.${value}`;
const metricKeys: Record<RankingScenarioMetric, string> = {
	specificIngredientCount: "ranking target specific ingredient count",
	ingredientStrength: "ranking target ingredient strength",
	berryStrength: "ranking target berry strength",
	skillCount: "ranking target skill count",
	totalStrength: "ranking target total strength",
};

const metricNoteKeys: Partial<Record<RankingScenarioMetric, string>> = {
	specificIngredientCount: "metric note specific ingredient count",
	ingredientStrength: "metric note ingredient strength",
	skillCount: "metric note skill count",
};

export function RankingEnvironmentSummary({
	parameter,
}: {
	parameter: StrengthParameter;
}) {
	const { t } = useTranslation();
	const berries = getCurrentFavoriteBerries(parameter).types;
	const periodKeys: Record<number, string> = {
		0: "whistle",
		1: "1hour",
		3: "3hours",
		8: "8hours",
		16: "16hours",
		24: "1day",
		168: "1week",
		[-10]: "help x10",
		[-30]: "help x30",
		[-100]: "help x100",
	};
	const tap = (value: number) =>
		value === 0
			? t("none")
			: value === 1
				? t("every minute")
				: t("hour2", { count: value / 60 });
	return (
		<>
			<Typography variant="body2" color="text.secondary">
				{parameter.fieldIndex >= 0
					? `${t(`area.${parameter.fieldIndex}`)} · ${berries.map((type) => t(`types.${type}`)).join(" / ")}`
					: `${t("favorite berry")}: ${t(parameter.fieldIndex === -1 ? "none" : "all")}`}
				{` · ${t("area bonus")} ${parameter.fieldBonus}% · ${t("good camp ticket")}: ${t(parameter.isGoodCampTicketSet ? "on" : "off")} · ${t("period")}: ${t(periodKeys[parameter.period] ?? "period")} · ${t("event")}: ${t(`events.${parameter.event === "custom" ? "advanced" : parameter.event}`)}`}
				{` · ${t(key("total components"))}: ${
					["Berries", "Ingredients", "Skills"]
						.filter((_value, index) => parameter.totalFlags[index])
						.map((value) => t(`fork.ingredientRanking.specialty ${value}`))
						.join(" / ") || t("none")
				}`}
			</Typography>
			<details>
				<summary>{t("details")}</summary>
				<Typography variant="caption" component="div">
					{`${t("tap frequency")} (${t("awake")} / ${t("asleep")}): ${tap(parameter.tapFrequencyAwake)} / ${tap(parameter.tapFrequencyAsleep)}`}
					{` · ${t("energy")}: ${t("always 81%+")} ${t(parameter.isEnergyAlwaysFull ? "on" : "off")} · ${t("sleep score")}: ${parameter.sleepScore} · ${t("e4e per pokemon")}: ${parameter.e4eEnergy} × ${parameter.e4eCount}`}
					{` · ${t("helping bonus")}: ${parameter.helpBonusCount} · ${t("helping bonus addition label")}: ${t(parameter.addHelpingBonusEffect ? "on" : "off")} · ${t("include pity proc")}: ${t(parameter.pityProc ? "on" : "off")}`}
					{` · ${t("average recipe level")}: ${parameter.recipeLevel} · ${t("recipe bonus")}: ${parameter.recipeBonus}%`}
				</Typography>
			</details>
		</>
	);
}

export default function RankingScenarioView({
	state,
	dispatch,
	comparisonIv,
	onAddComparison,
	onEditComparison,
	onRemoveComparison,
}: {
	state: IvState;
	dispatch: React.Dispatch<IvAction>;
	comparisonIv: PokemonIv | null;
	onAddComparison: () => void;
	onEditComparison: () => void;
	onRemoveComparison: () => void;
}) {
	const { t } = useTranslation();
	const ranking = useRankingScenario(state.parameter, comparisonIv);
	const [environmentOpen, setEnvironmentOpen] = React.useState(false);
	const config = ranking.currentConfig;
	const metricNoteKey = metricNoteKeys[config.target];
	const update = (patch: Partial<RankingScenarioConfig>) =>
		ranking.setConfig({ ...config, ...patch });
	const validation = validateRankingScenario(config, state.parameter);
	const metricLabel = (value: RankingScenarioConfig) =>
		`${t(`fork.ingredientRanking.${metricKeys[value.target]}`)}${value.target === "specificIngredientCount" && value.ingredient ? ` (${t(`ingredients.${value.ingredient}`)})` : ""}`;
	const changeField = (fieldIndex: number) =>
		dispatch({
			type: "changeParameter",
			payload: { parameter: { ...state.parameter, fieldIndex } },
		});
	return (
		<Stack gap={2} sx={{ p: 1 }}>
			<TextField
				select
				label={t(key("purpose"))}
				value={config.purpose}
				onChange={(event) =>
					ranking.setPurpose(event.target.value as RankingScenarioPurpose)
				}
				fullWidth
				size="small"
			>
				{rankingScenarioPurposes.map((purpose) => (
					<MenuItem key={purpose} value={purpose} sx={{ whiteSpace: "normal" }}>
						{t(key(`purpose ${purpose}`))}
					</MenuItem>
				))}
			</TextField>
			{["traits", "ingredients"].includes(config.purpose) && (
				<Autocomplete
					options={pokemons}
					value={
						pokemons.find((pokemon) => pokemon.name === config.pokemonName) ??
						null
					}
					getOptionLabel={(pokemon) => t(`pokemons.${pokemon.name}`)}
					isOptionEqualToValue={(a, b) => a.name === b.name}
					onChange={(_event, pokemon) =>
						update({
							pokemonName: pokemon?.name,
							mythIng1: undefined,
							mythIng2: undefined,
							mythIng3: undefined,
						})
					}
					renderInput={(params) => (
						<TextField {...params} label={t("pokemon")} size="small" />
					)}
				/>
			)}
			{config.purpose === "berry" && (
				<TextField
					select
					label={t(key("berry"))}
					value={config.berry ?? ""}
					size="small"
					onChange={(event) =>
						update({ berry: event.target.value as PokemonType })
					}
				>
					<MenuItem value="" disabled>
						{t(key("select condition"))}
					</MenuItem>
					{PokemonTypes.map((type) => (
						<MenuItem key={type} value={type}>
							{t(`types.${type}`)}
						</MenuItem>
					))}
				</TextField>
			)}
			{config.purpose === "skill" && (
				<TextField
					select
					label={t("main skill")}
					value={config.skill ?? ""}
					size="small"
					onChange={(event) =>
						update({ skill: event.target.value as MainSkillName })
					}
				>
					<MenuItem value="" disabled>
						{t(key("select condition"))}
					</MenuItem>
					{MainSkillNames.map((skill) => (
						<MenuItem key={skill} value={skill}>
							{t(`skills.${skill}.name`)}
						</MenuItem>
					))}
				</TextField>
			)}
			{config.purpose === "field" && (
				<Stack direction="row" gap={1} alignItems="center">
					<TextField
						select
						fullWidth
						size="small"
						label={t(key("map"))}
						value={
							state.parameter.fieldIndex >= 0 ? state.parameter.fieldIndex : ""
						}
						onChange={(event) => changeField(Number(event.target.value))}
					>
						<MenuItem value="" disabled>
							{t(key("select condition"))}
						</MenuItem>
						{fields.map((field) => (
							<MenuItem key={field.index} value={field.index}>
								{field.emoji} {t(`area.${field.index}`)}
							</MenuItem>
						))}
					</TextField>
					<Button
						onClick={() => setEnvironmentOpen(true)}
						sx={{ whiteSpace: "nowrap" }}
					>
						{t(key("map details"))}
					</Button>
				</Stack>
			)}
			<TextField
				select
				label={t("fork.ingredientRanking.ranking target")}
				value={config.target}
				size="small"
				onChange={(event) =>
					update({ target: event.target.value as RankingScenarioMetric })
				}
			>
				{rankingScenarioMetrics[config.purpose].map((metric) => (
					<MenuItem key={metric} value={metric}>
						{t(`fork.ingredientRanking.${metricKeys[metric]}`)}
					</MenuItem>
				))}
			</TextField>
			{(config.purpose === "ingredient" ||
				config.target === "specificIngredientCount") && (
				<TextField
					select
					label={t("fork.ingredientRanking.target ingredient")}
					value={config.ingredient ?? ""}
					size="small"
					onChange={(event) =>
						update({ ingredient: event.target.value as IngredientName })
					}
				>
					<MenuItem value="" disabled>
						{t(key("select condition"))}
					</MenuItem>
					{IngredientNames.filter((name) => !name.startsWith("unknown")).map(
						(name) => (
							<MenuItem key={name} value={name}>
								<Stack direction="row" gap={1} alignItems="center">
									<IngredientIcon name={name} />
									<span>{t(`ingredients.${name}`)}</span>
								</Stack>
							</MenuItem>
						),
					)}
				</TextField>
			)}
			{metricNoteKey && (
				<Typography variant="caption" color="text.secondary">
					{t(key(metricNoteKey))}
				</Typography>
			)}
			<RankingScenarioOptions config={config} onChange={ranking.setConfig} />
			<Button
				size="small"
				onClick={ranking.resetCurrent}
				sx={{ alignSelf: "flex-end" }}
			>
				{t(key("reset purpose"))}
			</Button>
			<Box
				sx={{
					border: "1px solid",
					borderColor: "divider",
					borderRadius: 1,
					p: 1,
				}}
			>
				<Stack
					direction="row"
					justifyContent="space-between"
					alignItems="center"
				>
					<Typography>{t(key("environment"))}</Typography>
					<Button onClick={() => setEnvironmentOpen(true)}>{t("edit")}</Button>
				</Stack>
				<RankingEnvironmentSummary parameter={state.parameter} />
			</Box>
			{validation && (
				<Alert severity="info">{t(key(`reason ${validation}`))}</Alert>
			)}
			<Stack direction="row" gap={1} alignItems="center">
				<Button
					variant="contained"
					disabled={validation !== null || ranking.status === "running"}
					onClick={() => void ranking.calculate()}
				>
					{t(key(ranking.status === "error" ? "retry" : "calculate"))}
				</Button>
				{ranking.status === "running" && (
					<>
						<CircularProgress size={20} />
						<Typography variant="body2">
							{t(key("calculating"), { count: ranking.progress })}
						</Typography>
						<Button onClick={ranking.cancel}>{t("cancel")}</Button>
					</>
				)}
			</Stack>
			{ranking.status === "cancelled" && (
				<Alert severity="info">{t(key("cancelled"))}</Alert>
			)}
			{ranking.error && (
				<Alert severity="error">
					{t(key("failed"))}:{" "}
					{t(key(`reason ${ranking.error}`), { defaultValue: ranking.error })}
				</Alert>
			)}
			{ranking.result && ranking.snapshot && (
				<>
					{ranking.status === "running" && (
						<Alert severity="info">{t(key("partial result"))}</Alert>
					)}
					{ranking.stale && <Alert severity="warning">{t(key("stale"))}</Alert>}
					<Box>
						<Typography variant="subtitle2">
							{t(key("result conditions"))}:{" "}
							{t(key(`purpose ${ranking.snapshot.config.purpose}`))}
						</Typography>
						<Typography variant="body2">
							{ranking.snapshot.config.pokemonName &&
								t(`pokemons.${ranking.snapshot.config.pokemonName}`)}
							{ranking.snapshot.config.berry &&
								t(`types.${ranking.snapshot.config.berry}`)}
							{ranking.snapshot.config.skill &&
								t(`skills.${ranking.snapshot.config.skill}.name`)}
							{ranking.snapshot.config.ingredient &&
								` · ${t(`ingredients.${ranking.snapshot.config.ingredient}`)}`}
						</Typography>
						<RankingOptionSummary config={ranking.snapshot.config} />
						<RankingEnvironmentSummary
							parameter={ranking.snapshot.environment}
						/>
					</Box>
					<RankingScenarioResults
						result={ranking.result}
						comparison={ranking.comparison}
						comparisonIv={comparisonIv}
						stale={ranking.stale}
						metricLabel={metricLabel(ranking.snapshot.config)}
						environment={ranking.snapshot.environment}
						isPartial={ranking.status === "running"}
						onAddComparison={onAddComparison}
						onEditComparison={onEditComparison}
						onRemoveComparison={onRemoveComparison}
					/>
				</>
			)}
			<RankingEnvironmentDialog
				open={environmentOpen}
				onClose={() => setEnvironmentOpen(false)}
				state={state}
				dispatch={dispatch}
			/>
		</Stack>
	);
}

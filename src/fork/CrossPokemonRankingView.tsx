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
} from "@mui/material";
import { styled } from "@mui/system";
import React from "react";
import { useTranslation } from "react-i18next";
import {
	type IngredientName,
	IngredientNames,
	type PokemonSpecialty,
	type PokemonType,
	PokemonTypes,
	SpecialtyNames,
} from "../data/pokemons";
import IngredientCountIcon from "../ui/IvCalc/IngredientCountIcon";
import IngredientIcon from "../ui/IvCalc/IngredientIcon";
import NatureTextField from "../ui/IvCalc/IvForm/NatureTextField";
import SleepingTimeControl from "../ui/IvCalc/IvForm/SleepingTimeControl";
import SubSkillControl from "../ui/IvCalc/IvForm/SubSkillControl";
import type IvState from "../ui/IvCalc/IvState";
import type { IvAction } from "../ui/IvCalc/IvState";
import PokemonIcon from "../ui/IvCalc/PokemonIcon";
import StrengthSettingForm from "../ui/IvCalc/Strength/StrengthParameterForm";
import StrengthParameterSummary from "../ui/IvCalc/Strength/StrengthParameterSummary";
import type PokemonIv from "../util/PokemonIv";
import {
	calculatePokemonRankingAsync,
	groupPokemonRankingEntries,
	type PokemonRankingEntry,
	type PokemonRankingTarget,
} from "../util/PokemonRanking";

const pageSize = 100;
const key = (name: string) => `fork.ingredientRanking.${name}`;
const targets: PokemonRankingTarget[] = [
	"berryStrength",
	"ingredientStrength",
	"ingredientCount",
	"specificIngredientCount",
	"totalStrength",
	"skillCount",
];
const targetLabels = {
	berryStrength: "ranking target berry strength",
	ingredientStrength: "ranking target ingredient strength",
	ingredientCount: "ranking target all ingredient count",
	specificIngredientCount: "ranking target specific ingredient count",
	totalStrength: "ranking target total strength",
	skillCount: "ranking target skill count",
} satisfies Record<PokemonRankingTarget, string>;

export interface CrossPokemonRankingConfig {
	fixedIv: PokemonIv;
	target: PokemonRankingTarget;
	targetIngredient: IngredientName;
	filterIngredient: IngredientName | "";
	filterType: PokemonType | "";
	filterSpecialty: PokemonSpecialty | "";
}

const CrossPokemonRankingView = React.memo(
	({
		state,
		dispatch,
		config,
		onConfigChange,
	}: {
		state: IvState;
		dispatch: React.Dispatch<IvAction>;
		config: CrossPokemonRankingConfig;
		onConfigChange: (value: CrossPokemonRankingConfig) => void;
	}) => {
		const { i18n, t } = useTranslation();
		const {
			fixedIv,
			target,
			targetIngredient,
			filterIngredient,
			filterType,
			filterSpecialty,
		} = config;
		const updateConfig = React.useCallback(
			(value: Partial<CrossPokemonRankingConfig>) =>
				onConfigChange({ ...config, ...value }),
			[config, onConfigChange],
		);
		const [ranking, setRanking] = React.useState<PokemonRankingEntry[]>([]);
		const [calculating, setCalculating] = React.useState(true);
		const [page, setPage] = React.useState(1);
		const [detailedSettingsOpen, setDetailedSettingsOpen] =
			React.useState(false);

		React.useEffect(() => {
			const controller = new AbortController();
			let active = true;
			setCalculating(true);
			setPage(1);
			calculatePokemonRankingAsync({
				target,
				ingredient: targetIngredient,
				level: fixedIv.level,
				ribbon: fixedIv.ribbon,
				nature: fixedIv.nature,
				subSkills: fixedIv.subSkills,
				parameter: state.parameter,
				filters: {
					...(filterIngredient === "" ? {} : { ingredient: filterIngredient }),
					...(filterType === "" ? {} : { type: filterType }),
					...(filterSpecialty === "" ? {} : { specialty: filterSpecialty }),
				},
				signal: controller.signal,
			})
				.then((entries) => {
					if (active) setRanking(entries);
				})
				.catch((error: unknown) => {
					if (error instanceof Error && error.name === "AbortError") return;
					console.error(error);
					if (active) setRanking([]);
				})
				.finally(() => {
					if (active) setCalculating(false);
				});
			return () => {
				active = false;
				controller.abort();
			};
		}, [
			filterIngredient,
			filterSpecialty,
			filterType,
			fixedIv,
			state.parameter,
			target,
			targetIngredient,
		]);

		const formatter = React.useMemo(
			() => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
			[i18n.language],
		);
		const groups = React.useMemo(
			() => groupPokemonRankingEntries(ranking),
			[ranking],
		);
		const pageCount = Math.max(1, Math.ceil(groups.length / pageSize));
		const clampedPage = Math.min(page, pageCount);
		const pageStart = (clampedPage - 1) * pageSize;
		const pageGroups = groups.slice(pageStart, pageStart + pageSize);
		const targetLabel = t(key(targetLabels[target]));

		return (
			<StyledRanking>
				<StyledConditionSummary>
					<StyledConditionHeader>
						<strong>{t(key("ranking common settings"))}</strong>
						<Button size="small" onClick={() => setDetailedSettingsOpen(true)}>
							{t(key("detailed settings"))}
						</Button>
					</StyledConditionHeader>
					<StrengthParameterSummary state={state} dispatch={dispatch} />
				</StyledConditionSummary>

				<StyledFixedConditions>
					<TextField
						variant="standard"
						size="small"
						type="number"
						label={t("level")}
						value={fixedIv.level}
						onChange={(event) => {
							const level = Number(event.target.value);
							if (Number.isInteger(level) && level >= 1 && level <= 100) {
								updateConfig({ fixedIv: fixedIv.clone({ level }) });
							}
						}}
						slotProps={{ htmlInput: { min: 1, max: 100 } }}
					/>
					<StyledTraitControl>
						<FormLabel>{t("nature")}</FormLabel>
						<NatureTextField
							iv={fixedIv}
							onChange={(nature) =>
								updateConfig({ fixedIv: fixedIv.clone({ nature }) })
							}
						/>
					</StyledTraitControl>
					<StyledTraitControl>
						<FormLabel>{t("sub skills")}</FormLabel>
						<SubSkillControl
							value={fixedIv.subSkills}
							onChange={({ value }) =>
								updateConfig({ fixedIv: fixedIv.clone({ subSkills: value }) })
							}
						/>
					</StyledTraitControl>
					<StyledTraitControl>
						<FormLabel>{t("sleeping time shared")}</FormLabel>
						<SleepingTimeControl
							value={fixedIv.ribbon}
							onChange={(ribbon) =>
								updateConfig({ fixedIv: fixedIv.clone({ ribbon }) })
							}
						/>
					</StyledTraitControl>
					<StyledNatureNote>
						{t(key("toxtricity nature note"))}
					</StyledNatureNote>
				</StyledFixedConditions>

				<StyledControls>
					<SelectControl
						label={t(key("ranking target"))}
						value={target}
						onChange={(value) =>
							updateConfig({ target: value as PokemonRankingTarget })
						}
					>
						{targets.map((value) => (
							<MenuItem key={value} value={value}>
								{t(key(targetLabels[value]))}
							</MenuItem>
						))}
					</SelectControl>
					{target === "specificIngredientCount" && (
						<IngredientSelect
							label={t(key("target ingredient"))}
							value={targetIngredient}
							onChange={(value) =>
								updateConfig({ targetIngredient: value as IngredientName })
							}
						/>
					)}
					<IngredientSelect
						allowAll
						label={t(key("filter ingredient"))}
						value={filterIngredient}
						onChange={(value) =>
							updateConfig({ filterIngredient: value as IngredientName | "" })
						}
					/>
					<SelectControl
						label={t(key("filter berry type"))}
						value={filterType}
						onChange={(value) =>
							updateConfig({ filterType: value as PokemonType | "" })
						}
					>
						<MenuItem value="">{t(key("all pokemon"))}</MenuItem>
						{PokemonTypes.map((value) => (
							<MenuItem key={value} value={value}>
								{t(`types.${value}`)}
							</MenuItem>
						))}
					</SelectControl>
					<SelectControl
						label={t(key("filter specialty"))}
						value={filterSpecialty}
						onChange={(value) =>
							updateConfig({
								filterSpecialty: value as PokemonSpecialty | "",
							})
						}
					>
						<MenuItem value="">{t(key("all pokemon"))}</MenuItem>
						{SpecialtyNames.map((value) => (
							<MenuItem key={value} value={value}>
								{t(key(`specialty ${value}`))}
							</MenuItem>
						))}
					</SelectControl>
				</StyledControls>

				<Dialog
					fullWidth
					maxWidth="sm"
					open={detailedSettingsOpen}
					onClose={() => setDetailedSettingsOpen(false)}
				>
					<DialogTitle>{t(key("detailed settings"))}</DialogTitle>
					<DialogContent>
						<StrengthSettingForm
							value={state.parameter}
							items={state.box.items}
							hasHelpingBonus={fixedIv.hasHelpingBonusInActiveSubSkills}
							dispatch={dispatch}
						/>
					</DialogContent>
					<DialogActions>
						<Button onClick={() => setDetailedSettingsOpen(false)}>
							{t("close")}
						</Button>
					</DialogActions>
				</Dialog>

				<StyledPagination>
					<span>
						{t(key("cross ranking result range"), {
							start: pageGroups.length === 0 ? 0 : pageStart + 1,
							end: pageStart + pageGroups.length,
							groups: groups.length,
							total: ranking.length,
						})}
					</span>
					<Pagination
						count={pageCount}
						page={clampedPage}
						size="small"
						onChange={(_event, value) => setPage(value)}
					/>
				</StyledPagination>
				<StyledResults>
					<StyledHeader>
						<span>{t(key("rank"))}</span>
						<span>{t("pokemon")}</span>
						<span>{t(key("ingredient configuration"))}</span>
						<span>{targetLabel}</span>
					</StyledHeader>
					{calculating && (
						<StyledMessage>
							<CircularProgress size={30} />
						</StyledMessage>
					)}
					{!calculating && ranking.length === 0 && (
						<StyledMessage>{t(key("no ranking results"))}</StyledMessage>
					)}
					{!calculating &&
						pageGroups.flatMap((group, groupIndex) =>
							group.entries.map((entry) => (
								<RankingRow
									key={entry.iv.pokemonName}
									entry={entry}
									rank={pageStart + groupIndex + 1}
									formatter={formatter}
								/>
							)),
						)}
				</StyledResults>
			</StyledRanking>
		);
	},
);

const SelectControl = ({
	label,
	value,
	onChange,
	children,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	children: React.ReactNode;
}) => {
	const labelId = React.useId();
	return (
		<FormControl variant="standard" size="small">
			<InputLabel id={labelId}>{label}</InputLabel>
			<Select
				labelId={labelId}
				value={value}
				label={label}
				onChange={(event) => onChange(String(event.target.value))}
			>
				{children}
			</Select>
		</FormControl>
	);
};

const IngredientSelect = ({
	label,
	value,
	onChange,
	allowAll = false,
}: {
	label: string;
	value: IngredientName | "";
	onChange: (value: string) => void;
	allowAll?: boolean;
}) => {
	const { t } = useTranslation();
	const labelId = React.useId();
	const render = (name: IngredientName) => (
		<StyledIngredient>
			<IngredientIcon name={name} />
			<span>{t(key(`ingredient names.${name}`))}</span>
		</StyledIngredient>
	);
	return (
		<FormControl variant="standard" size="small">
			<InputLabel id={labelId}>{label}</InputLabel>
			<Select
				labelId={labelId}
				value={value}
				label={label}
				onChange={(event) => onChange(String(event.target.value))}
				renderValue={(selected) =>
					!selected ? t(key("all pokemon")) : render(selected as IngredientName)
				}
			>
				{allowAll && <MenuItem value="">{t(key("all pokemon"))}</MenuItem>}
				{IngredientNames.map((name) => (
					<MenuItem key={name} value={name}>
						{render(name)}
					</MenuItem>
				))}
			</Select>
		</FormControl>
	);
};

const RankingRow = React.memo(
	({
		entry,
		rank,
		formatter,
	}: {
		entry: PokemonRankingEntry;
		rank: number;
		formatter: Intl.NumberFormat;
	}) => {
		const { t } = useTranslation();
		const activeTraits = entry.iv.activeSubSkills
			.map((subSkill) => t(`subskill.${subSkill.name}`))
			.join(" / ");
		return (
			<StyledRow>
				<strong>{rank}</strong>
				<StyledPokemon>
					<PokemonIcon idForm={entry.iv.idForm} shiny={false} size={40} />
					<StyledPokemonText>
						<span>{t(`pokemons.${entry.iv.pokemonName}`)}</span>
						<small>{t(`natures.${entry.iv.nature.name}`)}</small>
						<small>{activeTraits || "-"}</small>
					</StyledPokemonText>
				</StyledPokemon>
				<StyledIngredients>
					{entry.ingredientSlots.map((slot) => (
						<IngredientCountIcon
							key={slot.index}
							name={slot.name}
							count={slot.count}
						/>
					))}
				</StyledIngredients>
				<StyledValue>{formatter.format(entry.value)}</StyledValue>
			</StyledRow>
		);
	},
);

const StyledRanking = styled("section")({ paddingBottom: ".4rem" });
const StyledConditionSummary = styled("section")({
	marginBottom: ".7rem",
	padding: ".4rem .6rem",
	border: "1px solid #ccd5dd",
	borderRadius: ".5rem",
	background: "#f8fafc",
	"& .level": { display: "none" },
});
const StyledConditionHeader = styled("div")({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	fontSize: ".8rem",
	"& button": { padding: 0, fontSize: ".75rem", textTransform: "none" },
});
const StyledFixedConditions = styled("section")({
	display: "grid",
	gridTemplateColumns:
		"5rem minmax(8rem, .7fr) minmax(14rem, 1.5fr) minmax(8rem, .8fr)",
	gap: ".7rem",
	alignItems: "end",
	marginBottom: ".7rem",
	padding: ".6rem",
	border: "1px solid #d8dde2",
	borderRadius: ".5rem",
	"@media (max-width: 700px)": {
		gridTemplateColumns: "1fr 1fr",
		"& > div:nth-of-type(3)": { gridColumn: "1 / -1" },
	},
});
const StyledTraitControl = styled(FormControl)({
	minWidth: 0,
	"& > label": { fontSize: ".75rem" },
});
const StyledNatureNote = styled("small")({
	gridColumn: "1 / -1",
	color: "#666",
	fontSize: ".7rem",
});
const StyledControls = styled("div")({
	display: "grid",
	gridTemplateColumns: "repeat(4, minmax(8rem, 1fr))",
	gap: ".8rem",
	alignItems: "end",
	marginBottom: ".8rem",
	"@media (max-width: 650px)": { gridTemplateColumns: "1fr 1fr" },
});
const StyledIngredient = styled("span")({
	display: "inline-flex",
	alignItems: "center",
	gap: ".3rem",
	"& svg": { width: 22, height: 22 },
});
const StyledPagination = styled("div")({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: ".5rem",
	margin: ".4rem 0",
	color: "#555",
	fontSize: ".75rem",
});
const StyledResults = styled("div")({
	border: "1px solid #ccd5dd",
	borderRadius: ".5rem",
	overflow: "hidden",
});
const rowGrid = {
	display: "grid",
	gridTemplateColumns:
		"3.5rem minmax(9rem, 1.2fr) minmax(9rem, 1fr) minmax(6rem, .6fr)",
	gap: ".5rem",
	alignItems: "center",
};
const StyledHeader = styled("div")({
	...rowGrid,
	padding: ".45rem .6rem",
	background: "#e9eef2",
	fontSize: ".75rem",
	fontWeight: 700,
});
const StyledRow = styled("div")({
	...rowGrid,
	minHeight: "3.4rem",
	padding: ".4rem .6rem",
	borderTop: "1px solid #e0e4e7",
	"@media (max-width: 520px)": {
		gridTemplateColumns:
			"2.5rem minmax(7rem, 1fr) minmax(5rem, .6fr) minmax(4rem, .5fr)",
	},
});
const StyledPokemon = styled("div")({
	display: "flex",
	alignItems: "center",
	gap: ".5rem",
	minWidth: 0,
});
const StyledPokemonText = styled("span")({
	display: "flex",
	flexDirection: "column",
	minWidth: 0,
	"& small": { color: "#666", fontSize: ".7rem" },
});
const StyledIngredients = styled("div")({
	display: "flex",
	flexWrap: "wrap",
	gap: ".25rem",
});
const StyledValue = styled("strong")({ textAlign: "right" });
const StyledMessage = styled("div")({ padding: "1.5rem", textAlign: "center" });

export default CrossPokemonRankingView;

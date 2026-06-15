import {
	CircularProgress,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	TextField,
} from "@mui/material";
import { styled } from "@mui/system";
import React from "react";
import { useTranslation } from "react-i18next";
import { type IngredientName, IngredientNames } from "../../data/pokemons";
import {
	calculateIngredientRankingAsync,
	type IngredientRankingEntry,
} from "../../util/IngredientRanking";
import type { StrengthParameter } from "../../util/PokemonStrength";
import IngredientCountIcon from "./IngredientCountIcon";
import IngredientIcon from "./IngredientIcon";
import PokemonIcon from "./PokemonIcon";

const IngredientRankingView = React.memo(
	({ parameter }: { parameter: StrengthParameter }) => {
		const { i18n, t } = useTranslation();
		const [ingredient, setIngredient] = React.useState<IngredientName>("apple");
		const [level, setLevel] = React.useState(60);
		const [ranking, setRanking] = React.useState<IngredientRankingEntry[]>([]);
		const [calculating, setCalculating] = React.useState(true);

		React.useEffect(() => {
			const controller = new AbortController();
			let active = true;
			setCalculating(true);

			calculateIngredientRankingAsync({
				ingredient,
				level,
				parameter,
				limit: 100,
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
		}, [ingredient, level, parameter]);

		const onIngredientChange = React.useCallback(
			(event: { target: { value: unknown } }) => {
				setIngredient(event.target.value as IngredientName);
			},
			[],
		);
		const onLevelChange = React.useCallback(
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const value = Number(event.target.value);
				if (Number.isInteger(value) && value >= 1 && value <= 100) {
					setLevel(value);
				}
			},
			[],
		);
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
					<span>{t(`ingredient names.${name}`)}</span>
				</StyledIngredientOption>
			),
			[t],
		);

		return (
			<StyledRanking>
				<StyledControls>
					<FormControl variant="standard" size="small" required>
						<InputLabel id="ingredient-ranking-target-label">
							{t("target ingredient")}
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
				</StyledControls>

				<StyledResults>
					<StyledHeader>
						<span>{t("rank")}</span>
						<span>{t("pokemon")}</span>
						<span>{t("ingredient configuration")}</span>
						<span>{t("expected ingredient count")}</span>
					</StyledHeader>
					{calculating && (
						<StyledLoading>
							<CircularProgress size={30} />
						</StyledLoading>
					)}
					{!calculating && ranking.length === 0 && (
						<StyledEmpty>{t("no ranking results")}</StyledEmpty>
					)}
					{!calculating &&
						ranking.map((result, index) => (
							<StyledRow
								key={`${result.pokemon.id}-${result.iv.form}-${result.ordinal}-${result.natureOrder}-${result.subSkillOrder}`}
							>
								<strong>{index + 1}</strong>
								<StyledPokemon>
									<PokemonIcon
										idForm={result.iv.idForm}
										shiny={result.iv.shiny}
										size={40}
									/>
									<StyledPokemonSummary>
										<StyledPokemonName>
											{t(`pokemons.${result.pokemon.name}`)}
										</StyledPokemonName>
										<StyledAppliedTraits>
											<span>
												<StyledTraitLabel>{t("sub skills")}:</StyledTraitLabel>
												{result.iv.activeSubSkills.length > 0
													? result.iv.activeSubSkills
															.map((subSkill) => t(`subskill.${subSkill.name}`))
															.join(" / ")
													: "-"}
											</span>
											<span>
												<StyledTraitLabel>{t("nature")}:</StyledTraitLabel>
												{result.iv.nature.upEffect === "No effect" ? (
													t("nature effect.No effect")
												) : (
													<>
														<StyledNatureUp>UP</StyledNatureUp>
														{t(`nature effect.${result.iv.nature.upEffect}`)}{" "}
														<StyledNatureDown>DOWN</StyledNatureDown>
														{t(`nature effect.${result.iv.nature.downEffect}`)}
													</>
												)}
											</span>
										</StyledAppliedTraits>
									</StyledPokemonSummary>
								</StyledPokemon>
								<StyledIngredients>
									{result.ingredientSlots.map((slot) => (
										<IngredientCountIcon
											key={slot.index}
											name={slot.name}
											count={slot.count}
										/>
									))}
								</StyledIngredients>
								<StyledCount>{countFormatter.format(result.count)}</StyledCount>
							</StyledRow>
						))}
				</StyledResults>
			</StyledRanking>
		);
	},
);

const StyledRanking = styled("section")({
	paddingBottom: ".4rem",
});

const StyledControls = styled("div")({
	display: "grid",
	gridTemplateColumns: "minmax(10rem, 1fr) minmax(5rem, .4fr)",
	gap: "1rem",
	alignItems: "end",
	marginBottom: ".8rem",
	"& svg": {
		verticalAlign: "middle",
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

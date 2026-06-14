import {
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
import { calculateIngredientRanking } from "../../util/IngredientRanking";
import type PokemonIv from "../../util/PokemonIv";
import type { StrengthParameter } from "../../util/PokemonStrength";
import IngredientCountIcon from "./IngredientCountIcon";
import IngredientIcon from "./IngredientIcon";
import PokemonIcon from "./PokemonIcon";

const IngredientRankingView = React.memo(
	({
		baseIv,
		parameter,
	}: {
		baseIv: PokemonIv;
		parameter: StrengthParameter;
	}) => {
		const { i18n, t } = useTranslation();
		const [ingredient, setIngredient] = React.useState<IngredientName>("apple");
		const [level, setLevel] = React.useState(60);

		const ranking = React.useMemo(
			() =>
				calculateIngredientRanking({
					ingredient,
					level,
					baseIv,
					parameter,
				}),
			[baseIv, ingredient, level, parameter],
		);

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
					{ranking.length === 0 && (
						<StyledEmpty>{t("no ranking results")}</StyledEmpty>
					)}
					{ranking.map((result, index) => (
						<StyledRow key={`${result.pokemon.name}-${result.ingredientKey}`}>
							<strong>{index + 1}</strong>
							<StyledPokemon>
								<PokemonIcon
									idForm={result.iv.idForm}
									shiny={result.iv.shiny}
									size={40}
								/>
								<span>{t(`pokemons.${result.pokemon.name}`)}</span>
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
	"& > span": {
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	"@media (max-width: 600px)": {
		gridColumn: "2 / 4",
	},
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

export default IngredientRankingView;

import {
	Button,
	Snackbar,
	ToggleButton,
	ToggleButtonGroup,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import BoxDeleteAllDialog from "../ui/IvCalc/Box/BoxDeleteAllDialog";
import BoxExportDialog from "../ui/IvCalc/Box/BoxExportDialog";
import BoxImportDialog from "../ui/IvCalc/Box/BoxImportDialog";
import BoxItemDialog from "../ui/IvCalc/Box/BoxItemDialog";
import BoxTabChild from "../ui/IvCalc/Box/BoxTabChild";
import IvForm from "../ui/IvCalc/IvForm/IvForm";
import { getInitialIvState, ivStateReducer } from "../ui/IvCalc/IvState";
import RateNotFixedPanel from "../ui/IvCalc/RateNotFixedPanel";
import StrengthSettingForm from "../ui/IvCalc/Strength/StrengthParameterForm";
import type { PokemonBoxItem } from "../util/PokemonBox";
import PokemonIv from "../util/PokemonIv";
import CrossPokemonRankingView, {
	type CrossPokemonRankingConfig,
} from "./CrossPokemonRankingView";
import IngredientRankingView from "./IngredientRankingView";
import RankingLowerTabHeader from "./RankingLowerTabHeader";

const initialIvState = getInitialIvState();

const RankingWorkspace = React.memo(() => {
	const [state, dispatch] = React.useReducer(ivStateReducer, initialIvState);
	const [rankingMode, setRankingMode] = React.useState<"traits" | "pokemon">(
		"traits",
	);
	const [crossPokemonRankingConfig, setCrossPokemonRankingConfig] =
		React.useState<CrossPokemonRankingConfig>(() => ({
			fixedIv: new PokemonIv({ pokemonName: "Skeledirge", level: 60 }),
			target: "totalStrength",
			targetIngredient: "apple",
			filterIngredient: "",
			filterType: "",
			filterSpecialty: "",
		}));
	const { t } = useTranslation();
	const selectedItem = state.box.getById(state.selectedItemId);

	const onPokemonIvChange = React.useCallback((value: PokemonIv) => {
		dispatch({ type: "updateIv", payload: { iv: value } });
	}, []);
	const onRestoreClick = React.useCallback(
		() => dispatch({ type: "restoreItem" }),
		[],
	);
	const onSaveClick = React.useCallback(
		() => dispatch({ type: "saveItem" }),
		[],
	);
	const onAlertMessageClose = React.useCallback(
		() => dispatch({ type: "closeAlert" }),
		[],
	);
	const onBoxItemEditDialogClose = React.useCallback(
		() => dispatch({ type: "editDialogClose" }),
		[],
	);
	const onBoxItemDialogChange = React.useCallback((value: PokemonBoxItem) => {
		dispatch({ type: "addOrEditDone", payload: { item: value } });
	}, []);
	const onBoxExportDialogClose = React.useCallback(
		() => dispatch({ type: "exportClose" }),
		[],
	);
	const onBoxImportDialogClose = React.useCallback(
		() => dispatch({ type: "importClose" }),
		[],
	);
	const onBoxDeleteAllDialogClose = React.useCallback(
		() => dispatch({ type: "deleteAllClose" }),
		[],
	);

	const isSelectedItemEdited =
		selectedItem !== null && !selectedItem.iv.isEqual(state.pokemonIv);

	return (
		<>
			<div
				style={{
					padding: "0 .5rem",
					position: "sticky",
					top: 0,
					zIndex: 1,
					background: "#f9f9f9",
				}}
			>
				<ToggleButtonGroup
					exclusive
					fullWidth
					size="small"
					value={rankingMode}
					onChange={(_event, value: "traits" | "pokemon" | null) => {
						if (value !== null) setRankingMode(value);
					}}
					aria-label={t("fork.ingredientRanking.ranking mode")}
					style={{ marginBottom: ".6rem" }}
				>
					<ToggleButton value="traits">
						{t("fork.ingredientRanking.trait ranking")}
					</ToggleButton>
					<ToggleButton value="pokemon">
						{t("fork.ingredientRanking.cross pokemon ranking")}
					</ToggleButton>
				</ToggleButtonGroup>
				{rankingMode === "traits" ? (
					<IngredientRankingView state={state} dispatch={dispatch} />
				) : (
					<CrossPokemonRankingView
						state={state}
						dispatch={dispatch}
						config={crossPokemonRankingConfig}
						onConfigChange={setCrossPokemonRankingConfig}
					/>
				)}
				{rankingMode === "traits" && (
					<>
						<RateNotFixedPanel state={state} dispatch={dispatch} />
						<RankingLowerTabHeader
							state={state}
							dispatch={dispatch}
							isBoxEmpty={state.box.items.length === 0}
						/>
					</>
				)}
			</div>
			{rankingMode === "traits" && state.lowerTabIndex === 0 && (
				<div style={{ margin: "0 0.5rem 10rem 0.5rem" }}>
					<IvForm
						parameter={state.parameter}
						pokemonIv={state.pokemonIv}
						dispatch={dispatch}
						onChange={onPokemonIvChange}
					/>
				</div>
			)}
			{rankingMode === "traits" && state.lowerTabIndex === 1 && (
				<BoxTabChild
					items={state.box.items}
					iv={state.pokemonIv}
					selectedId={state.selectedItemId}
					dispatch={dispatch}
					parameter={state.parameter}
				/>
			)}
			{rankingMode === "traits" && state.lowerTabIndex === 2 && (
				<StrengthSettingForm
					value={state.parameter}
					items={state.box.items}
					hasHelpingBonus={state.pokemonIv.hasHelpingBonusInActiveSubSkills}
					dispatch={dispatch}
				/>
			)}
			<BoxItemDialog
				key={state.boxItemDialogKey}
				open={state.boxItemDialogOpen}
				boxItem={selectedItem}
				isEdit={state.boxItemDialogIsEdit}
				parameter={state.parameter}
				dispatch={dispatch}
				onClose={onBoxItemEditDialogClose}
				onChange={onBoxItemDialogChange}
			/>
			<BoxExportDialog
				box={state.box}
				open={state.boxExportDialogOpen}
				onClose={onBoxExportDialogClose}
			/>
			<BoxImportDialog
				box={state.box}
				open={state.boxImportDialogOpen}
				onClose={onBoxImportDialogClose}
			/>
			<BoxDeleteAllDialog
				box={state.box}
				open={state.boxDeleteAllDialogOpen}
				onClose={onBoxDeleteAllDialogClose}
			/>
			<Snackbar
				open={state.alertMessage !== ""}
				message={t(state.alertMessage)}
				autoHideDuration={2000}
				onClose={onAlertMessageClose}
			/>
			<Snackbar
				open={isSelectedItemEdited}
				message={t("pokemon in the box is edited")}
				action={
					<>
						<Button onClick={onRestoreClick}>{t("reset")}</Button>
						<Button onClick={onSaveClick}>{t("save")}</Button>
					</>
				}
			/>
		</>
	);
});

export default RankingWorkspace;

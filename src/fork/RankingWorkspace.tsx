import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Snackbar,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import BoxDeleteAllDialog from "../ui/IvCalc/Box/BoxDeleteAllDialog";
import BoxExportDialog from "../ui/IvCalc/Box/BoxExportDialog";
import BoxImportDialog from "../ui/IvCalc/Box/BoxImportDialog";
import BoxItemDialog from "../ui/IvCalc/Box/BoxItemDialog";
import IvForm from "../ui/IvCalc/IvForm/IvForm";
import { getInitialIvState } from "../ui/IvCalc/IvState";
import LowerTabHeader from "../ui/IvCalc/LowerTabHeader";
import RateNotFixedPanel from "../ui/IvCalc/RateNotFixedPanel";
import type { PokemonBoxItem } from "../util/PokemonBox";
import type PokemonIv from "../util/PokemonIv";
import { createRankingEnvironment } from "../util/RankingScenario";
import RankingComparisonBoxPanel from "./RankingComparisonBoxPanel";
import { preserveRankingIndividualSettings } from "./RankingEnvironmentForm";
import RankingScenarioView from "./RankingScenarioView";
import { rankingWorkspaceReducer } from "./RankingWorkspaceState";

const initialIvState = getInitialIvState();

const RankingWorkspace = React.memo(() => {
	const [state, dispatch] = React.useReducer(
		rankingWorkspaceReducer,
		initialIvState,
	);
	const [comparisonIv, setComparisonIv] = React.useState<PokemonIv | null>(
		null,
	);
	const [comparisonEditorOpen, setComparisonEditorOpen] = React.useState(false);
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

	const individualDispatch = React.useCallback(
		(action: import("../ui/IvCalc/IvState").IvAction) => {
			dispatch(preserveRankingIndividualSettings(action, state.parameter));
		},
		[state.parameter],
	);

	const isSelectedItemEdited =
		selectedItem !== null && !selectedItem.iv.isEqual(state.pokemonIv);

	return (
		<>
			<RankingScenarioView
				state={state}
				dispatch={dispatch}
				comparisonIv={comparisonIv}
				onAddComparison={() => {
					dispatch({ type: "changeLowerTab", payload: { index: 0 } });
					setComparisonEditorOpen(true);
				}}
				onEditComparison={() => {
					if (comparisonIv)
						dispatch({ type: "updateIv", payload: { iv: comparisonIv } });
					setComparisonEditorOpen(true);
				}}
				onRemoveComparison={() => setComparisonIv(null)}
			/>
			<Dialog
				open={comparisonEditorOpen}
				onClose={() => setComparisonEditorOpen(false)}
				fullWidth
				maxWidth="sm"
				slotProps={{
					paper: {
						sx: (theme) => ({
							height: "min(800px, calc(100% - 64px))",
							overflow: "hidden",
							[theme.breakpoints.down("sm")]: {
								borderRadius: 0,
								height: "100%",
								margin: 0,
								maxHeight: "none",
								maxWidth: "none",
								width: "100%",
							},
						}),
					},
				}}
			>
				<DialogTitle>
					{t(comparisonIv ? "fork.scenario.comparison" : "pokemon")}
				</DialogTitle>
				<DialogContent
					sx={
						state.lowerTabIndex === 1
							? {
									display: "flex",
									flexDirection: "column",
									overflow: "hidden",
									padding: 0,
								}
							: undefined
					}
				>
					<LowerTabHeader
						state={{ ...state, tabIndex: 0 }}
						isBoxEmpty={state.box.items.length === 0}
						dispatch={individualDispatch}
					/>
					{state.lowerTabIndex !== 1 ? (
						<>
							<RateNotFixedPanel state={state} dispatch={dispatch} />
							<IvForm
								parameter={createRankingEnvironment(state.parameter)}
								pokemonIv={state.pokemonIv}
								dispatch={individualDispatch}
								onChange={onPokemonIvChange}
							/>
						</>
					) : (
						<RankingComparisonBoxPanel
							items={state.box.items}
							iv={state.pokemonIv}
							selectedId={state.selectedItemId}
							dispatch={individualDispatch}
							parameter={createRankingEnvironment(state.parameter)}
						/>
					)}
				</DialogContent>
				<DialogActions>
					<Button
						variant="contained"
						onClick={() => {
							setComparisonIv(state.pokemonIv);
							setComparisonEditorOpen(false);
						}}
					>
						{t("fork.scenario.set comparison")}
					</Button>
					<Button onClick={() => setComparisonEditorOpen(false)}>
						{t("close")}
					</Button>
				</DialogActions>
			</Dialog>
			<BoxItemDialog
				key={state.boxItemDialogKey}
				open={state.boxItemDialogOpen}
				boxItem={selectedItem}
				isEdit={state.boxItemDialogIsEdit}
				parameter={createRankingEnvironment(state.parameter)}
				dispatch={individualDispatch}
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

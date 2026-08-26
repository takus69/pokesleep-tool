import {
	Alert,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import type IvState from "../ui/IvCalc/IvState";
import type { IvAction } from "../ui/IvCalc/IvState";
import EnergyDialog from "../ui/IvCalc/Strength/EnergyDialog";
import PokemonStrength from "../util/PokemonStrength";
import { createRankingEnvironment } from "../util/RankingScenario";
import RankingEnvironmentForm, {
	preserveRankingIndividualSettings,
} from "./RankingEnvironmentForm";

/** A single environment editor, including the upstream energy dialog host. */
export default function RankingEnvironmentDialog({
	open,
	onClose,
	state,
	dispatch,
}: {
	open: boolean;
	onClose: () => void;
	state: IvState;
	dispatch: React.Dispatch<IvAction>;
}) {
	const { t } = useTranslation();
	// Upstream EnergyDialog initializes on a false -> true edge, not on mount.
	const [energyVisible, setEnergyVisible] = React.useState(false);
	React.useEffect(() => {
		setEnergyVisible(state.energyDialogOpen);
	}, [state.energyDialogOpen]);
	const energyDispatch = React.useCallback(
		(action: IvAction) => {
			dispatch(preserveRankingIndividualSettings(action, state.parameter));
		},
		[dispatch, state.parameter],
	);
	const parameter = React.useMemo(
		() => createRankingEnvironment(state.parameter),
		[state.parameter],
	);
	const energyResult = React.useMemo(() => {
		if (!state.energyDialogOpen) return null;
		try {
			return new PokemonStrength(state.pokemonIv, parameter).calculate();
		} catch {
			return null;
		}
	}, [state.energyDialogOpen, state.pokemonIv, parameter]);
	const closeEnergy = () => dispatch({ type: "closeEnergyDialog" });
	return (
		<>
			<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
				<DialogTitle>{t("fork.scenario.environment")}</DialogTitle>
				<DialogContent>
					<RankingEnvironmentForm
						value={state.parameter}
						items={state.box.items}
						hasHelpingBonus={false}
						dispatch={dispatch}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose}>{t("close")}</Button>
				</DialogActions>
			</Dialog>
			{energyResult !== null && (
				<EnergyDialog
					open={energyVisible}
					iv={state.pokemonIv}
					result={energyResult}
					parameter={parameter}
					onClose={closeEnergy}
					dispatch={energyDispatch}
				/>
			)}
			{state.energyDialogOpen && energyResult === null && (
				<Dialog open onClose={closeEnergy}>
					<DialogContent>
						<Alert severity="error">
							{t("fork.scenario.energy unavailable")}
						</Alert>
					</DialogContent>
					<DialogActions>
						<Button onClick={closeEnergy}>{t("close")}</Button>
					</DialogActions>
				</Dialog>
			)}
		</>
	);
}

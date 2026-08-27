import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Tab,
	Tabs,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";
import type IvState from "../ui/IvCalc/IvState";
import type { IvAction } from "../ui/IvCalc/IvState";
import RatingView from "../ui/IvCalc/RatingView";
import RpView from "../ui/IvCalc/Rp/RpView";
import StrengthBerryIngSkillView from "../ui/IvCalc/Strength/StrengthBerryIngSkillView";
import PokemonBox from "../util/PokemonBox";
import type PokemonIv from "../util/PokemonIv";
import type { StrengthParameter } from "../util/PokemonStrength";
import { cloneRankingEnvironment } from "./useRankingScenario";

type DetailTab = 0 | 1 | 2;

type RankingPreviewAction =
	| IvAction
	| {
			type: "resetPreview";
			payload: { iv: PokemonIv; environment: StrengthParameter };
	  };

export function createRankingDetailPaperSx(theme: Theme) {
	return {
		[theme.breakpoints.down("sm")]: {
			margin: 0,
			width: "100%",
			maxWidth: "100%",
			height: "100%",
			maxHeight: "none",
			borderRadius: 0,
		},
	};
}

function createPreviewState(
	iv: PokemonIv,
	environment: StrengthParameter,
): IvState {
	return {
		tabIndex: 1,
		lowerTabIndex: 0,
		pokemonIv: iv.clone(),
		parameter: cloneRankingEnvironment(environment),
		box: new PokemonBox(),
		selectedItemId: -1,
		energyDialogOpen: false,
		boxItemDialogOpen: false,
		boxItemDialogKey: "",
		boxItemDialogIsEdit: false,
		boxExportDialogOpen: false,
		boxImportDialogOpen: false,
		boxDeleteAllDialogOpen: false,
		alertMessage: "",
	};
}

/**
 * An isolated preview of the upstream ability views. It intentionally does not
 * call ivStateReducer, which persists IV, box, and environment state.
 */
export function rankingPreviewReducer(
	state: IvState,
	action: RankingPreviewAction,
): IvState {
	switch (action.type) {
		case "resetPreview":
			return createPreviewState(action.payload.iv, action.payload.environment);
		case "openEnergyDialog":
			return { ...state, energyDialogOpen: true };
		case "closeEnergyDialog":
			return { ...state, energyDialogOpen: false };
		case "changeParameter":
			return {
				...state,
				parameter: cloneRankingEnvironment(action.payload.parameter),
			};
		case "updateIv":
			return { ...state, pokemonIv: action.payload.iv.clone() };
		default:
			return state;
	}
}

export default function RankingPokemonDetailDialog({
	open,
	iv,
	environment,
	summary,
	onClose,
}: {
	open: boolean;
	iv: PokemonIv;
	environment: StrengthParameter;
	summary: React.ReactNode;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
	const [tab, setTab] = React.useState<DetailTab>(1);
	const [state, dispatch] = React.useReducer(
		rankingPreviewReducer,
		undefined,
		() => createPreviewState(iv, environment),
	);
	const contentRef = React.useRef<HTMLDivElement>(null);
	const [width, setWidth] = React.useState(0);

	React.useEffect(() => {
		if (!open) return;
		setTab(1);
		dispatch({
			type: "resetPreview",
			payload: { iv, environment },
		});
	}, [open, iv, environment]);

	React.useEffect(() => {
		const element = contentRef.current;
		if (!element) return;
		const update = () => setWidth(element.clientWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			aria-label={t("details")}
			fullScreen={fullScreen}
			fullWidth
			maxWidth="md"
			slotProps={{ paper: { sx: createRankingDetailPaperSx(theme) } }}
		>
			<DialogTitle>{t("details")}</DialogTitle>
			<DialogContent ref={contentRef} dividers sx={{ overflowX: "hidden" }}>
				{summary}
				<Tabs
					value={tab}
					onChange={(_event, value: DetailTab) => setTab(value)}
					variant="fullWidth"
					sx={{ mb: 1 }}
				>
					<Tab label={t("rp")} value={0} />
					<Tab label={t("strength2")} value={1} />
					<Tab label={t("rating")} value={2} />
				</Tabs>
				<Box sx={{ position: "relative", minHeight: tab === 1 ? 190 : 400 }}>
					{tab === 0 && <RpView state={state} width={width} />}
					{tab === 1 && (
						<StrengthBerryIngSkillView
							pokemonIv={state.pokemonIv}
							settings={state.parameter}
							energyDialogOpen={state.energyDialogOpen}
							dispatch={dispatch}
						/>
					)}
					{tab === 2 && (
						<RatingView pokemonIv={state.pokemonIv} width={width} />
					)}
				</Box>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>{t("close")}</Button>
			</DialogActions>
		</Dialog>
	);
}

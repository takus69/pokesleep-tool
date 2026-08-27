import { styled } from "@mui/system";
import BoxTabChild from "../ui/IvCalc/Box/BoxTabChild";
import type { IvAction } from "../ui/IvCalc/IvState";
import type { PokemonBoxItem } from "../util/PokemonBox";
import type PokemonIv from "../util/PokemonIv";
import type { StrengthParameter } from "../util/PokemonStrength";

/**
 * Adapts the upstream full-page box layout to the ranking comparison dialog.
 * BoxView's two direct divs are its item list and fixed viewport footer.
 */
const RankingComparisonBoxViewport = styled("div")({
	display: "flex",
	flex: "1 1 auto",
	flexDirection: "column",
	minHeight: 0,
	overflow: "hidden",
	position: "relative",
	width: "100%",
	"& > div:first-of-type": {
		alignContent: "flex-start",
		flex: "1 1 auto",
		marginBottom: "0 !important",
		minHeight: 0,
		overflowX: "hidden",
		overflowY: "auto",
	},
	"& > div:nth-of-type(2)": {
		bottom: "auto !important",
		flex: "0 0 auto",
		marginTop: "0 !important",
		maxWidth: "100%",
		position: "relative !important",
		width: "100% !important",
		zIndex: 1,
	},
});

export default function RankingComparisonBoxPanel({
	items,
	iv,
	selectedId,
	parameter,
	dispatch,
}: {
	items: PokemonBoxItem[];
	iv: PokemonIv;
	selectedId: number;
	parameter: StrengthParameter;
	dispatch: (action: IvAction) => void;
}) {
	return (
		<RankingComparisonBoxViewport data-testid="ranking-comparison-box">
			<BoxTabChild
				items={items}
				iv={iv}
				selectedId={selectedId}
				parameter={parameter}
				dispatch={dispatch}
			/>
		</RankingComparisonBoxViewport>
	);
}

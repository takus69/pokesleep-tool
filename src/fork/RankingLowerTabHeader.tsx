import React from "react";
import type IvState from "../ui/IvCalc/IvState";
import type { IvAction } from "../ui/IvCalc/IvState";
import LowerTabHeader from "../ui/IvCalc/LowerTabHeader";

const RankingLowerTabHeader = React.memo(
	({
		state,
		isBoxEmpty,
		dispatch,
	}: {
		state: IvState;
		isBoxEmpty: boolean;
		dispatch: React.Dispatch<IvAction>;
	}) => (
		<LowerTabHeader
			state={state.tabIndex === 1 ? state : { ...state, tabIndex: 1 }}
			isBoxEmpty={isBoxEmpty}
			dispatch={dispatch}
		/>
	),
);

export default RankingLowerTabHeader;

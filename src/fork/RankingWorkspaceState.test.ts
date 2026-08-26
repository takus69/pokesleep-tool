import { beforeEach, describe, expect, test } from "vitest";
import { getInitialIvState } from "../ui/IvCalc/IvState";
import PokemonBox from "../util/PokemonBox";
import PokemonIv from "../util/PokemonIv";
import {
	createStrengthParameter,
	loadStrengthParameter,
} from "../util/StrengthParameter";
import { rankingWorkspaceReducer } from "./RankingWorkspaceState";

beforeEach(() => localStorage.clear());

describe("ranking workspace reducer", () => {
	test("comparison IV changes cannot normalize the shared Cresselia team", () => {
		const state = getInitialIvState();
		const parameter = createStrengthParameter({});
		parameter.berryBurstTeam = {
			auto: false,
			species: 5,
			members: [
				{ type: "water", level: 30 },
				{ type: "fire", level: 40 },
				{ type: "bug", level: 50 },
				{ type: "steel", level: 60 },
			],
		};
		const originalTeam = structuredClone(parameter.berryBurstTeam);

		const next = rankingWorkspaceReducer(
			{ ...state, parameter },
			{
				type: "updateIv",
				payload: { iv: new PokemonIv({ pokemonName: "Cresselia" }) },
			},
		);

		expect(next.pokemonIv.pokemonName).toBe("Cresselia");
		expect(next.parameter).toBe(parameter);
		expect(next.parameter.berryBurstTeam).toEqual(originalTeam);
		expect(parameter.berryBurstTeam).toEqual(originalTeam);
	});

	test("selecting Cresselia from the box cannot normalize the shared team", () => {
		const state = getInitialIvState();
		const parameter = createStrengthParameter({});
		parameter.berryBurstTeam.auto = false;
		parameter.berryBurstTeam.species = 5;
		const originalTeam = structuredClone(parameter.berryBurstTeam);
		const box = new PokemonBox(state.box.items);
		const id = box.add(new PokemonIv({ pokemonName: "Cresselia" }));

		const next = rankingWorkspaceReducer(
			{ ...state, parameter, box },
			{ type: "select", payload: { id } },
		);

		expect(next.pokemonIv.pokemonName).toBe("Cresselia");
		expect(next.selectedItemId).toBe(id);
		expect(next.parameter).toBe(parameter);
		expect(next.parameter.berryBurstTeam).toEqual(originalTeam);
	});

	test("explicit shared-environment edits still normalize and persist", () => {
		const state = getInitialIvState();
		const parameter = createStrengthParameter({ fieldBonus: 35 });

		const next = rankingWorkspaceReducer(state, {
			type: "changeParameter",
			payload: { parameter },
		});

		expect(next.parameter).not.toBe(parameter);
		expect(next.parameter.fieldBonus).toBe(35);
		expect(loadStrengthParameter().fieldBonus).toBe(35);
	});
});

import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { IvAction } from "../ui/IvCalc/IvState";
import { getInitialIvState } from "../ui/IvCalc/IvState";
import { createRankingEnvironment } from "../util/RankingScenario";
import { createStrengthParameter } from "../util/StrengthParameter";
import {
	preserveRankingIndividualSettings,
	resetRankingEnvironment,
} from "./RankingEnvironmentForm";

const energyDialogCalls = vi.hoisted(() => vi.fn());
vi.mock("../ui/IvCalc/Strength/EnergyDialog", () => ({
	default: (props: unknown) => {
		energyDialogCalls(props);
		return null;
	},
}));
vi.mock("./RankingEnvironmentForm", async (importOriginal) => ({
	...(await importOriginal<typeof import("./RankingEnvironmentForm")>()),
	default: () => null,
}));

import RankingEnvironmentDialog from "./RankingEnvironmentDialog";

vi.hoisted(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({ matches: false }),
	});
});

afterEach(() => {
	cleanup();
	energyDialogCalls.mockReset();
});

describe("ranking environment dispatch adapter", () => {
	test("mounts the upstream energy dialog closed before opening it", async () => {
		const state = getInitialIvState();
		state.energyDialogOpen = true;
		state.parameter.isGoodCampTicketSet = true;
		state.parameter.helpBonusCount = 2;
		state.parameter.level = 100;
		state.parameter.evolved = true;
		state.parameter.maxSkillLevel = true;
		const dispatch = vi.fn();

		render(
			React.createElement(RankingEnvironmentDialog, {
				open: true,
				onClose: () => {},
				state,
				dispatch,
			}),
		);

		await waitFor(() =>
			expect(
				energyDialogCalls.mock.calls.some(
					([props]) => (props as { open: boolean }).open,
				),
			).toBe(true),
		);
		const opens = energyDialogCalls.mock.calls.map(
			([props]) => (props as { open: boolean }).open,
		);
		expect(opens[0]).toBe(false);
		expect(opens.at(-1)).toBe(true);
		const props = energyDialogCalls.mock.calls.at(-1)?.[0] as {
			parameter: ReturnType<typeof createStrengthParameter>;
		};
		expect(props.parameter).toMatchObject({
			isGoodCampTicketSet: true,
			helpBonusCount: 2,
			level: 0,
			evolved: false,
			maxSkillLevel: false,
		});
	});
	test("preserves legacy individual settings while applying energy-dialog edits", () => {
		const saved = createStrengthParameter({
			level: 100,
			evolved: true,
			maxSkillLevel: true,
		});
		const effective = createRankingEnvironment(saved);
		const action: IvAction = {
			type: "changeParameter",
			payload: {
				parameter: { ...effective, fieldBonus: 25, isGoodCampTicketSet: true },
			},
		};
		const adapted = preserveRankingIndividualSettings(action, saved);
		expect(adapted.type).toBe("changeParameter");
		if (adapted.type !== "changeParameter")
			throw new Error("Unexpected action");
		expect(adapted.payload.parameter).toMatchObject({
			level: 100,
			evolved: true,
			maxSkillLevel: true,
			fieldBonus: 25,
			isGoodCampTicketSet: true,
		});
		expect(action.payload.parameter).toMatchObject({
			level: 0,
			evolved: false,
			maxSkillLevel: false,
		});
		expect(saved.fieldBonus).not.toBe(25);
	});

	test("does not force legacy settings when the stored values are disabled", () => {
		const saved = createStrengthParameter({
			level: 0,
			evolved: false,
			maxSkillLevel: false,
		});
		const action: IvAction = {
			type: "changeParameter",
			payload: {
				parameter: createStrengthParameter({
					level: 60,
					evolved: true,
					maxSkillLevel: true,
				}),
			},
		};
		const adapted = preserveRankingIndividualSettings(action, saved);
		if (adapted.type !== "changeParameter")
			throw new Error("Unexpected action");
		expect(adapted.payload.parameter).toMatchObject({
			level: 0,
			evolved: false,
			maxSkillLevel: false,
		});
	});

	test("forwards non-parameter actions unchanged", () => {
		const action: IvAction = { type: "closeEnergyDialog" };
		expect(
			preserveRankingIndividualSettings(action, createStrengthParameter({})),
		).toBe(action);
	});

	test("environment reset preserves all three legacy individual settings", () => {
		const saved = createStrengthParameter({
			level: 60,
			evolved: true,
			maxSkillLevel: true,
			fieldBonus: 25,
		});
		const reset = resetRankingEnvironment(saved);
		expect(reset).toEqual(
			createStrengthParameter({
				level: 60,
				evolved: true,
				maxSkillLevel: true,
			}),
		);
		expect(saved.fieldBonus).toBe(25);
	});
});

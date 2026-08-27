import { createTheme, ThemeProvider } from "@mui/material";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import PokemonIv from "../util/PokemonIv";
import { createStrengthParameter } from "../util/PokemonStrength";
import type {
	RankingScenarioEntry,
	RankingScenarioGroup,
} from "../util/RankingScenario";
import RankingScenarioResults, {
	locateScenarioComparison,
	partialRankingGroupLimit,
	rankingPageSize,
} from "./RankingScenarioResults";

vi.hoisted(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		}),
	});
});
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
const ingredientIconRender = vi.hoisted(() => vi.fn(() => null));
vi.mock("../ui/IvCalc/IngredientCountIcon", () => ({
	default: ingredientIconRender,
}));
vi.mock("./RankingPokemonDetailDialog", () => ({
	default: ({ open, iv }: { open: boolean; iv: PokemonIv }) =>
		open
			? React.createElement("div", { role: "dialog" }, `ability ${iv.level}`)
			: null,
}));

afterEach(cleanup);

function entry(pattern: "AAA" | "ABB", value: number): RankingScenarioEntry {
	const iv = new PokemonIv({
		pokemonName: "Gengar",
		ingredient: pattern,
		level: 60,
	});
	return {
		id: pattern,
		iv,
		value,
		ingredientKey: pattern,
		ingredientSlots: [iv.ingredient1, iv.ingredient2, iv.ingredient3],
		ordinal: pattern === "AAA" ? 0 : 1,
	};
}

describe("scenario comparison position", () => {
	test("shows public ranking-style traits and food icons without candidate comparison actions", () => {
		const candidate = entry("AAA", 10);
		candidate.neutralSubSkillCount = 2;
		render(
			React.createElement(
				ThemeProvider,
				{ theme: createTheme() },
				React.createElement(RankingScenarioResults, {
					result: {
						entries: [candidate],
						groups: [{ value: 10, entries: [candidate] }],
						exclusions: [],
					},
					comparison: null,
					comparisonIv: null,
					stale: false,
					metricLabel: "metric",
					environment: createStrengthParameter({}),
					onAddComparison: vi.fn(),
					onEditComparison: vi.fn(),
					onRemoveComparison: vi.fn(),
				}),
			),
		);
		expect(screen.getByText(/sub skills:/)).toBeTruthy();
		expect(
			screen.getByText(/fork\.ingredientRanking\.neutral subskill ×2/),
		).toBeTruthy();
		expect(screen.getByText(/nature:/)).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "fork.scenario.compare this" }),
		).toBeNull();
		expect(
			screen.getByRole("button", { name: "fork.scenario.add comparison" }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "pokemons.Gengar details" }),
		).toBeTruthy();
	});

	test("opens ability details only from the Pokemon summary", async () => {
		const candidate = entry("AAA", 10);
		render(
			React.createElement(
				ThemeProvider,
				{ theme: createTheme() },
				React.createElement(RankingScenarioResults, {
					result: {
						entries: [candidate],
						groups: [{ value: 10, entries: [candidate] }],
						exclusions: [],
					},
					comparison: null,
					comparisonIv: null,
					stale: false,
					metricLabel: "metric",
					environment: createStrengthParameter({}),
					onAddComparison: vi.fn(),
					onEditComparison: vi.fn(),
					onRemoveComparison: vi.fn(),
				}),
			),
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "fork.scenario.show conditions",
			}),
		);
		expect(screen.queryByText("ability 60")).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "pokemons.Gengar details" }),
		);
		expect(screen.getByText("ability 60")).toBeTruthy();
		await waitFor(() =>
			expect(screen.queryByText("fork.scenario.conditions")).toBeNull(),
		);
	});

	test("keeps all exact-tied ingredient configurations and the original candidate groups", () => {
		const entries = [entry("AAA", 10), entry("ABB", 10)];
		const groups: RankingScenarioGroup[] = [
			{ value: 10, entries },
			{ value: 5, entries: [] },
		];
		const position = locateScenarioComparison(groups, {
			status: "positive",
			value: 10,
		});
		expect(position).toEqual({ rank: 1, page: 1, groupIndex: 0 });
		expect(groups).toHaveLength(2);
		expect(groups[0].entries).toBe(entries);
		expect(entries.map((item) => item.ingredientKey)).toEqual(["AAA", "ABB"]);
	});

	test("uses unrounded values when finding the equivalent rank", () => {
		const groups = [
			{ value: 10.004, entries: [] },
			{ value: 10.002, entries: [] },
		];
		expect(
			locateScenarioComparison(groups, { status: "positive", value: 10.003 }),
		).toEqual({ rank: 2, page: 1, groupIndex: 1 });
		expect(groups.map((group) => group.value)).toEqual([10.004, 10.002]);
	});

	test("preserves the 100 candidate-group page boundary when comparison is between values", () => {
		const groups = Array.from({ length: 201 }, (_, index) => ({
			value: 300 - index,
			entries: [],
		}));
		const candidatePageTwo = groups.slice(100, 200);
		expect(
			locateScenarioComparison(groups, { status: "positive", value: 200.5 }),
		).toEqual({ rank: 101, page: 2, groupIndex: 100 });
		expect(groups).toHaveLength(201);
		expect(groups.slice(100, 200)).toEqual(candidatePageTwo);
		expect(
			locateScenarioComparison(groups, { status: "positive", value: 201 }),
		).toEqual({ rank: 100, page: 1, groupIndex: 99 });
	});

	test("keeps a below-all comparison on an extra page without shifting the full candidate page", () => {
		const groups = Array.from({ length: 100 }, (_, index) => ({
			value: 100 - index,
			entries: [],
		}));
		expect(
			locateScenarioComparison(groups, { status: "zero", value: 0 }),
		).toEqual({ rank: 101, page: 2, groupIndex: 100 });
		expect(groups).toHaveLength(100);
	});

	test("allows a comparison when no candidate is calculable", () => {
		expect(locateScenarioComparison([], { status: "zero", value: 0 })).toEqual({
			rank: 1,
			page: 1,
			groupIndex: 0,
		});
	});

	test("assigns no rank or page when absent or uncalculable", () => {
		const groups = [{ value: 5, entries: [] }];
		expect(locateScenarioComparison(groups, null)).toEqual({
			rank: null,
			page: null,
			groupIndex: null,
		});
		expect(
			locateScenarioComparison(groups, {
				status: "uncalculable",
				reason: "unknownIngredient",
			}),
		).toEqual({ rank: null, page: null, groupIndex: null });
	});

	test("limits partial rows and restores 100-group paging for the final result", () => {
		const candidate = entry("AAA", 10);
		const groups = Array.from({ length: 125 }, (_, index) => ({
			value: 125 - index,
			entries: [candidate],
		}));
		const result = { entries: [candidate], groups, exclusions: [] };
		const props = {
			result,
			comparison: null,
			comparisonIv: null,
			stale: false,
			metricLabel: "metric",
			environment: createStrengthParameter({}),
			onAddComparison: vi.fn(),
			onEditComparison: vi.fn(),
			onRemoveComparison: vi.fn(),
		};
		const view = (isPartial: boolean) =>
			React.createElement(
				ThemeProvider,
				{ theme: createTheme() },
				React.createElement(RankingScenarioResults, { ...props, isPartial }),
			);
		const { rerender } = render(view(true));
		expect(
			screen.getAllByRole("button", {
				name: "fork.scenario.show conditions",
			}),
		).toHaveLength(partialRankingGroupLimit);
		expect(screen.queryByRole("navigation")).toBeNull();

		rerender(view(false));
		expect(
			screen.getAllByRole("button", {
				name: "fork.scenario.show conditions",
			}),
		).toHaveLength(rankingPageSize);
		expect(screen.getAllByRole("navigation")).toHaveLength(2);
	});

	test("does not rebuild ranking rows for progress-only parent renders", () => {
		const candidate = entry("AAA", 10);
		const props = {
			result: {
				entries: [candidate],
				groups: [{ value: 10, entries: [candidate] }],
				exclusions: [],
			},
			comparison: null,
			comparisonIv: null,
			stale: false,
			metricLabel: "metric",
			environment: createStrengthParameter({}),
			isPartial: true,
			onAddComparison: vi.fn(),
			onEditComparison: vi.fn(),
			onRemoveComparison: vi.fn(),
		};
		function ProgressHarness() {
			const [progress, setProgress] = React.useState(0);
			return React.createElement(
				React.Fragment,
				null,
				React.createElement(
					"button",
					{
						type: "button",
						onClick: () => setProgress((value) => value + 32),
					},
					`progress ${progress}`,
				),
				React.createElement(RankingScenarioResults, props),
			);
		}
		ingredientIconRender.mockClear();
		render(React.createElement(ProgressHarness));
		expect(ingredientIconRender).toHaveBeenCalledTimes(3);
		fireEvent.click(screen.getByRole("button", { name: "progress 0" }));
		expect(screen.getByRole("button", { name: "progress 32" })).toBeTruthy();
		expect(ingredientIconRender).toHaveBeenCalledTimes(3);
	});
});

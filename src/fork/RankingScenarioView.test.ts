import { createTheme, ThemeProvider } from "@mui/material";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getInitialIvState } from "../ui/IvCalc/IvState";
import { calculateRankingScenarioAsync } from "../util/RankingScenario";
import {
	createRankingScenarioSettings,
	saveRankingScenarioSettings,
} from "./RankingScenarioState";
import RankingScenarioView from "./RankingScenarioView";

vi.hoisted(() => {
	class ResizeObserverMock {
		observe() {}
		disconnect() {}
	}
	vi.stubGlobal("ResizeObserver", ResizeObserverMock);
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		}),
	});
});
vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("./RankingEnvironmentDialog", () => ({ default: () => null }));
vi.mock("./RankingPokemonSelect", () => ({
	default: ({
		value,
		onChange,
	}: {
		value?: string;
		onChange: (pokemonName: string) => void;
	}) =>
		React.createElement("input", {
			role: "button",
			"aria-label": "pokemon",
			readOnly: true,
			value: value ? `pokemons.${value}` : "",
			onClick: () => onChange("Gengar"),
		}),
}));
vi.mock("../util/RankingScenario", async (importOriginal) => ({
	...(await importOriginal<typeof import("../util/RankingScenario")>()),
	calculateRankingScenarioAsync: vi.fn(),
}));

beforeEach(() => {
	localStorage.clear();
	vi.mocked(calculateRankingScenarioAsync)
		.mockReset()
		.mockResolvedValue({ entries: [], groups: [], exclusions: [] });
});
afterEach(cleanup);

function view() {
	const onAddComparison = vi.fn();
	const props = {
		state: getInitialIvState(),
		dispatch: vi.fn(),
		comparisonIv: null,
		onAddComparison,
		onEditComparison: vi.fn(),
		onRemoveComparison: vi.fn(),
	};
	return {
		...render(
			React.createElement(
				ThemeProvider,
				{ theme: createTheme() },
				React.createElement(RankingScenarioView, props),
			),
		),
		props,
		onAddComparison,
	};
}

async function choose(label: string, option: string) {
	fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
	fireEvent.click(
		within(screen.getByRole("listbox")).getByRole("option", {
			name: option,
		}),
	);
	await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

function saveReadyScenario() {
	const settings = createRankingScenarioSettings();
	settings.purpose = "ingredients";
	settings.configs.ingredients.pokemonName = "Gengar";
	saveRankingScenarioSettings(settings);
}

describe("unified scenario view", () => {
	test("starts uncalculated with no Pokemon or comparison requirement and collapsed options", () => {
		view();
		expect(screen.getByText("fork.brand.subtitle")).toBeTruthy();
		expect(calculateRankingScenarioAsync).not.toHaveBeenCalled();
		expect(
			(screen.getByRole("button", { name: "pokemon" }) as HTMLInputElement)
				.value,
		).toBe("");
		expect(
			(
				screen.getByRole("button", {
					name: "fork.scenario.calculate",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
		expect(
			screen
				.getByRole("button", { name: /fork.scenario.options/ })
				.getAttribute("aria-expanded"),
		).toBe("false");
		expect(
			screen.queryByRole("button", { name: "fork.scenario.add comparison" }),
		).toBeNull();
		expect(screen.getByText(/Lv 60.*MAX/)).toBeTruthy();
		expect(
			screen.getByText("fork.scenario.metric note specific ingredient count"),
		).toBeTruthy();
	});

	test("shows the Pokemon condition only in purposes 1 and 2", async () => {
		view();
		const pokemon = screen.getByRole("button", { name: "pokemon" });
		fireEvent.click(pokemon);
		expect(
			(screen.getByRole("button", { name: "pokemon" }) as HTMLInputElement)
				.value,
		).toBe("pokemons.Gengar");

		await choose("fork.scenario.purpose", "fork.scenario.purpose ingredients");
		expect(screen.getByRole("button", { name: "pokemon" })).toBeTruthy();
		await choose("fork.scenario.purpose", "fork.scenario.purpose berry");
		expect(screen.queryByRole("button", { name: "pokemon" })).toBeNull();
	});

	test("offers exactly the six purposes in design order and only their allowed metrics", async () => {
		view();
		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "fork.scenario.purpose" }),
		);
		expect(
			within(screen.getByRole("listbox"))
				.getAllByRole("option")
				.map((option) => option.textContent),
		).toEqual(
			["traits", "ingredients", "berry", "ingredient", "skill", "field"].map(
				(purpose) => `fork.scenario.purpose ${purpose}`,
			),
		);
		fireEvent.click(
			screen.getByRole("option", { name: "fork.scenario.purpose traits" }),
		);
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		for (const [purpose, metrics] of [
			[
				"traits",
				[
					"specific ingredient count",
					"ingredient strength",
					"berry strength",
					"skill count",
					"total strength",
				],
			],
			["ingredients", ["ingredient strength"]],
			["berry", ["berry strength", "total strength"]],
			["ingredient", ["specific ingredient count", "ingredient strength"]],
			["skill", ["skill count"]],
			["field", ["berry strength", "total strength"]],
		] as const) {
			await choose("fork.scenario.purpose", `fork.scenario.purpose ${purpose}`);
			fireEvent.mouseDown(
				screen.getByRole("combobox", {
					name: "fork.ingredientRanking.ranking target",
				}),
			);
			const options = within(screen.getByRole("listbox")).getAllByRole(
				"option",
			);
			expect(options.map((option) => option.textContent)).toEqual(
				metrics.map(
					(metric) => `fork.ingredientRanking.ranking target ${metric}`,
				),
			);
			fireEvent.click(options[0]);
			await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		}
		expect(calculateRankingScenarioAsync).not.toHaveBeenCalled();
	}, 15000);

	test("selecting real primary conditions enables explicit calculation but does not start it", async () => {
		view();
		await choose("fork.scenario.purpose", "fork.scenario.purpose berry");
		await choose("fork.scenario.berry", "types.fire");
		const calculate = screen.getByRole("button", {
			name: "fork.scenario.calculate",
		}) as HTMLButtonElement;
		expect(calculate.disabled).toBe(false);
		expect(calculateRankingScenarioAsync).not.toHaveBeenCalled();
		await act(async () => {
			fireEvent.click(calculate);
		});
		expect(calculateRankingScenarioAsync).toHaveBeenCalledTimes(1);
		expect(
			vi.mocked(calculateRankingScenarioAsync).mock.calls[0][0],
		).toMatchObject({
			purpose: "berry",
			berry: "fire",
			target: "berryStrength",
		});
	});

	test("offers only real maps and writes the quick selection to shared environment", async () => {
		const { props } = view();
		await choose("fork.scenario.purpose", "fork.scenario.purpose field");
		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "fork.scenario.map" }),
		);
		const listbox = within(screen.getByRole("listbox"));
		expect(listbox.queryByText("none")).toBeNull();
		expect(listbox.queryByText("all")).toBeNull();
		fireEvent.click(listbox.getByRole("option", { name: /area\.1/ }));
		expect(props.dispatch).toHaveBeenCalledWith({
			type: "changeParameter",
			payload: {
				parameter: expect.objectContaining({ fieldIndex: 1 }),
			},
		});
		expect(
			screen.getByRole("button", { name: "fork.scenario.map details" }),
		).toBeTruthy();
	});

	test("keeps result labels and conditions from the completed snapshot after inputs change", async () => {
		saveReadyScenario();
		view();
		await act(async () => {
			fireEvent.click(
				screen.getByRole("button", { name: "fork.scenario.calculate" }),
			);
		});
		await choose("fork.scenario.purpose", "fork.scenario.purpose skill");
		expect(screen.getByText("fork.scenario.stale")).toBeTruthy();
		expect(
			screen.getByText(
				"fork.scenario.result conditions: fork.scenario.purpose ingredients",
			),
		).toBeTruthy();
		expect(
			screen.getByRole("heading", {
				name: "fork.ingredientRanking.ranking target ingredient strength",
			}),
		).toBeTruthy();
		expect(calculateRankingScenarioAsync).toHaveBeenCalledTimes(1);
	});

	test("makes comparison an optional action only after results exist", async () => {
		saveReadyScenario();
		const { onAddComparison } = view();
		expect(
			screen.queryByRole("button", { name: "fork.scenario.add comparison" }),
		).toBeNull();
		await act(async () => {
			fireEvent.click(
				screen.getByRole("button", { name: "fork.scenario.calculate" }),
			);
		});
		fireEvent.click(
			screen.getByRole("button", { name: "fork.scenario.add comparison" }),
		);
		expect(onAddComparison).toHaveBeenCalledTimes(1);
		expect(onAddComparison).toHaveBeenCalledWith();
		expect(calculateRankingScenarioAsync).toHaveBeenCalledTimes(1);
	});

	test("labels partial rankings while calculation is still running", async () => {
		saveReadyScenario();
		vi.mocked(calculateRankingScenarioAsync).mockImplementation(
			async (_config, _environment, options) => {
				options?.onPartialResult?.({
					completed: 20,
					result: { entries: [], groups: [], exclusions: [] },
				});
				return await new Promise(() => {});
			},
		);
		view();
		await act(async () => {
			fireEvent.click(
				screen.getByRole("button", { name: "fork.scenario.calculate" }),
			);
		});
		expect(
			await screen.findByText("fork.scenario.partial result"),
		).toBeTruthy();
		expect(screen.getByText("fork.scenario.calculating")).toBeTruthy();
	});
});

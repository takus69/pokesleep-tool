import { createTheme, ThemeProvider } from "@mui/material";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import PokemonIv from "../util/PokemonIv";
import { createStrengthParameter } from "../util/PokemonStrength";
import RankingComparisonBoxPanel from "./RankingComparisonBoxPanel";

vi.mock("../ui/IvCalc/Box/BoxTabChild", () => ({
	default: () =>
		React.createElement(
			React.Fragment,
			{},
			React.createElement("div", {
				"data-testid": "box-list",
				style: { marginBottom: 300 },
			}),
			React.createElement("div", {
				"data-testid": "box-footer",
				style: { position: "fixed", bottom: 0, width: "100%" },
			}),
		),
}));

afterEach(cleanup);

describe("ranking comparison box layout adapter", () => {
	test("keeps the upstream list and viewport footer inside the dialog panel", () => {
		render(
			React.createElement(
				ThemeProvider,
				{ theme: createTheme() },
				React.createElement(RankingComparisonBoxPanel, {
					items: [],
					iv: new PokemonIv({ pokemonName: "Bulbasaur" }),
					selectedId: -1,
					parameter: createStrengthParameter({}),
					dispatch: vi.fn(),
				}),
			),
		);

		const panel = screen.getByTestId("ranking-comparison-box");
		const list = screen.getByTestId("box-list");
		const footer = screen.getByTestId("box-footer");
		expect(getComputedStyle(panel).overflow).toBe("hidden");
		expect(getComputedStyle(list).overflowY).toBe("auto");
		// jsdom does not apply stylesheet !important over React inline styles,
		// so verify the generated adapter rules that win in browsers.
		const styles = document.head.textContent ?? "";
		expect(styles).toContain("margin-bottom:0!important");
		expect(styles).toContain("position:relative!important");
		expect(styles).toContain("width:100%!important");
		expect(panel.children).toHaveLength(2);
		expect(list.nextElementSibling).toBe(footer);
	});
});

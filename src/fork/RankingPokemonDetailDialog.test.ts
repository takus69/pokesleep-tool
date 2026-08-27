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
import RankingPokemonDetailDialog, {
	createRankingDetailPaperSx,
} from "./RankingPokemonDetailDialog";

let mobile = false;

vi.hoisted(() => {
	class ResizeObserverMock {
		observe() {}
		disconnect() {}
	}
	vi.stubGlobal("ResizeObserver", ResizeObserverMock);
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({
			get matches() {
				return mobile;
			},
			addEventListener: () => {},
			removeEventListener: () => {},
		}),
	});
});

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../ui/IvCalc/Rp/RpView", () => ({
	default: ({
		state,
	}: {
		state: {
			parameter: { fieldBonus: number };
			box: { items: unknown[] };
		};
	}) =>
		React.createElement(
			"div",
			{},
			`rp ${state.parameter.fieldBonus} box ${state.box.items.length}`,
		),
}));
vi.mock("../ui/IvCalc/RatingView", () => ({
	default: ({ pokemonIv }: { pokemonIv: PokemonIv }) =>
		React.createElement("div", {}, `rating ${pokemonIv.level}`),
}));
vi.mock("../ui/IvCalc/Strength/StrengthBerryIngSkillView", () => ({
	default: ({
		pokemonIv,
		settings,
		dispatch,
	}: {
		pokemonIv: PokemonIv;
		settings: ReturnType<typeof createStrengthParameter>;
		dispatch: React.Dispatch<import("../ui/IvCalc/IvState").IvAction>;
	}) =>
		React.createElement(
			React.Fragment,
			{},
			React.createElement(
				"div",
				{},
				`energy ${settings.fieldBonus} level ${pokemonIv.level}`,
			),
			React.createElement(
				"button",
				{
					type: "button",
					onClick: () =>
						dispatch({
							type: "changeParameter",
							payload: {
								parameter: { ...settings, fieldBonus: 99 },
							},
						}),
				},
				"change preview",
			),
			React.createElement(
				"button",
				{
					type: "button",
					onClick: () =>
						dispatch({
							type: "addThis",
							payload: { iv: pokemonIv, nickname: "preview" },
						}),
				},
				"change box",
			),
		),
}));

afterEach(() => {
	cleanup();
	localStorage.clear();
	mobile = false;
});

function Harness({ onClose = vi.fn() }: { onClose?: () => void }) {
	const [open, setOpen] = React.useState(true);
	const environment = React.useMemo(
		() => createStrengthParameter({ fieldBonus: 10 }),
		[],
	);
	const iv = React.useMemo(
		() => new PokemonIv({ pokemonName: "Gengar", level: 60 }),
		[],
	);
	return React.createElement(
		ThemeProvider,
		{ theme: createTheme() },
		React.createElement(
			"button",
			{ type: "button", onClick: () => setOpen(true) },
			"open",
		),
		React.createElement(RankingPokemonDetailDialog, {
			open,
			iv,
			environment,
			summary: React.createElement("div", {}, "summary"),
			onClose: () => {
				onClose();
				setOpen(false);
			},
		}),
	);
}

describe("ranking Pokemon ability detail", () => {
	test("opens on energy and reuses all three upstream ability tabs", () => {
		render(React.createElement(Harness, {}));
		expect(screen.getByRole("dialog", { name: "details" })).toBeTruthy();
		expect(document.querySelector(".MuiDialog-paperWidthMd")).toBeTruthy();
		expect(screen.getByText("energy 10 level 60")).toBeTruthy();
		fireEvent.click(screen.getByRole("tab", { name: "rp" }));
		expect(screen.getByText("rp 10 box 0")).toBeTruthy();
		fireEvent.click(screen.getByRole("tab", { name: "rating" }));
		expect(screen.getByText("rating 60")).toBeTruthy();
	});

	test("isolates preview changes and resets them from the snapshot on reopen", async () => {
		localStorage.setItem("PstStrengthParameter", "shared");
		localStorage.setItem("PstIvState", "shared iv");
		localStorage.setItem("PstPokeBox", "shared box");
		const onClose = vi.fn();
		render(React.createElement(Harness, { onClose }));
		fireEvent.click(screen.getByRole("button", { name: "change preview" }));
		expect(screen.getByText("energy 99 level 60")).toBeTruthy();
		expect(localStorage.getItem("PstStrengthParameter")).toBe("shared");
		fireEvent.click(screen.getByRole("button", { name: "change box" }));
		fireEvent.click(screen.getByRole("tab", { name: "rp" }));
		expect(screen.getByText("rp 99 box 0")).toBeTruthy();
		expect(localStorage.getItem("PstIvState")).toBe("shared iv");
		expect(localStorage.getItem("PstPokeBox")).toBe("shared box");
		fireEvent.click(screen.getByRole("button", { name: "close" }));
		expect(onClose).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		fireEvent.click(screen.getByRole("button", { name: "open" }));
		await waitFor(() =>
			expect(screen.getByText("energy 10 level 60")).toBeTruthy(),
		);
		expect(localStorage.getItem("PstStrengthParameter")).toBe("shared");
		expect(localStorage.getItem("PstIvState")).toBe("shared iv");
		expect(localStorage.getItem("PstPokeBox")).toBe("shared box");
	});

	test("uses a full-screen dialog on mobile", () => {
		mobile = true;
		const theme = createTheme();
		render(React.createElement(Harness, {}));
		expect(document.querySelector(".MuiDialog-paperFullScreen")).toBeTruthy();
		expect(createRankingDetailPaperSx(theme)).toEqual({
			[theme.breakpoints.down("sm")]: {
				margin: 0,
				width: "100%",
				maxWidth: "100%",
				height: "100%",
				maxHeight: "none",
				borderRadius: 0,
			},
		});
	});
});

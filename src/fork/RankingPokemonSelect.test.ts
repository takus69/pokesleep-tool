import { createTheme, ThemeProvider } from "@mui/material";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import pokemons from "../data/pokemons";
import type { PokemonOption } from "../ui/IvCalc/IvForm/PokemonTextField";
import RankingPokemonSelect from "./RankingPokemonSelect";

interface DialogProps {
	open: boolean;
	pokemonOptions: PokemonOption[];
	selectedValue: PokemonOption;
	onClose: () => void;
	onChange: (pokemon: PokemonOption) => void;
}

let dialogProps: DialogProps | undefined;

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../ui/IvCalc/IvForm/PokemonSelectDialog", () => ({
	default: (props: DialogProps) => {
		dialogProps = props;
		return React.createElement(
			"div",
			{ "data-testid": "upstream-pokemon-dialog", "data-open": props.open },
			React.createElement(
				"button",
				{
					type: "button",
					onClick: () => {
						const gengar = props.pokemonOptions.find(
							(pokemon) => pokemon.name === "Gengar",
						);
						if (gengar) {
							props.onChange(gengar);
							props.onClose();
						}
					},
				},
				"choose Gengar",
			),
		);
	},
}));

beforeEach(() => {
	dialogProps = undefined;
});
afterEach(cleanup);

function view(value?: string) {
	const onChange = vi.fn();
	render(
		React.createElement(
			ThemeProvider,
			{ theme: createTheme() },
			React.createElement(RankingPokemonSelect, { value, onChange }),
		),
	);
	return { onChange };
}

describe("ranking Pokemon selector adapter", () => {
	test("opens the upstream picker empty with every Pokemon available", async () => {
		const { onChange } = view();
		expect(dialogProps?.open).toBe(false);
		fireEvent.click(screen.getByRole("button", { name: "pokemon" }));
		await waitFor(() => expect(dialogProps?.open).toBe(true));

		expect(dialogProps?.selectedValue.name).toBe("");
		expect(dialogProps?.selectedValue.localName).toBe("");
		const selectableNames = dialogProps?.pokemonOptions
			.filter((pokemon) => pokemon.id >= 0)
			.map((pokemon) => pokemon.name);
		expect(selectableNames).toEqual(pokemons.map((pokemon) => pokemon.name));

		fireEvent.click(screen.getByRole("button", { name: "choose Gengar" }));
		expect(onChange).toHaveBeenCalledWith("Gengar");
		await waitFor(() => expect(dialogProps?.open).toBe(false));
	});

	test("passes the current Pokemon to the upstream picker", () => {
		view("Gengar");
		expect(dialogProps?.selectedValue.name).toBe("Gengar");
		expect(dialogProps?.pokemonOptions.some((pokemon) => pokemon.id < 0)).toBe(
			false,
		);
	});
});

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import RankingWorkspace from "./RankingWorkspace";

vi.hoisted(() => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: () => ({
			matches: false,
			addEventListener: () => {},
			removeEventListener: () => {},
		}),
	});
	Object.defineProperty(HTMLElement.prototype, "animate", {
		configurable: true,
		value: () => ({
			set onfinish(callback: () => void) {
				callback();
			},
		}),
	});
});

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./RankingScenarioView", () => ({
	default: ({ onAddComparison }: { onAddComparison: () => void }) => (
		<button type="button" onClick={onAddComparison}>
			open comparison
		</button>
	),
}));
vi.mock("../ui/IvCalc/RateNotFixedPanel", () => ({ default: () => null }));
vi.mock("../ui/IvCalc/IvForm/IvForm", () => ({
	default: () => <div>manual editor</div>,
}));
vi.mock("../ui/IvCalc/Box/BoxTabChild", () => ({
	default: () => <div>box contents</div>,
}));
vi.mock("../ui/IvCalc/Box/BoxItemDialog", () => ({ default: () => null }));
vi.mock("../ui/IvCalc/Box/BoxExportDialog", () => ({
	default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
		open ? (
			<button type="button" onClick={onClose}>
				export dialog
			</button>
		) : null,
}));
vi.mock("../ui/IvCalc/Box/BoxImportDialog", () => ({
	default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
		open ? (
			<button type="button" onClick={onClose}>
				import dialog
			</button>
		) : null,
}));
vi.mock("../ui/IvCalc/Box/BoxDeleteAllDialog", () => ({
	default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
		open ? (
			<button type="button" onClick={onClose}>
				delete all dialog
			</button>
		) : null,
}));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function openActions() {
	fireEvent.click(screen.getByRole("button", { name: "actions" }));
	return screen;
}

describe("ranking comparison box management", () => {
	test("allows importing into an empty box", () => {
		render(<RankingWorkspace />);
		fireEvent.click(screen.getByRole("button", { name: "open comparison" }));
		fireEvent.click(screen.getByRole("tab", { name: "box" }));

		const actions = openActions();
		expect(
			actions
				.getByRole("menuitem", { name: "export" })
				.getAttribute("aria-disabled"),
		).toBe("true");
		expect(
			actions
				.getByRole("menuitem", { name: "delete all" })
				.getAttribute("aria-disabled"),
		).toBe("true");
		fireEvent.click(actions.getByRole("menuitem", { name: "import" }));
		expect(screen.getByText("import dialog")).toBeTruthy();
	});

	test("reuses the upstream add, export, and delete-all entry points", async () => {
		render(<RankingWorkspace />);
		fireEvent.click(screen.getByRole("button", { name: "open comparison" }));

		fireEvent.click(
			openActions().getByRole("menuitem", { name: "add to box" }),
		);
		expect(screen.getByRole("dialog", { name: "add to box" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "add" }));
		expect(localStorage.getItem("PstPokeBox")).not.toBeNull();

		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "add to box" })).toBeNull(),
		);
		fireEvent.click(screen.getByRole("tab", { name: "box" }));
		expect(screen.getByText("box contents")).toBeTruthy();

		fireEvent.click(openActions().getByRole("menuitem", { name: "export" }));
		expect(screen.getByText("export dialog")).toBeTruthy();
		fireEvent.click(screen.getByText("export dialog"));
		await waitFor(() =>
			expect(screen.queryByRole("menuitem", { name: "export" })).toBeNull(),
		);

		fireEvent.click(
			openActions().getByRole("menuitem", { name: "delete all" }),
		);
		expect(screen.getByText("delete all dialog")).toBeTruthy();
	});
});

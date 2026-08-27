import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import en from "./i18n/en.json";
import ja from "./i18n/ja.json";
import ko from "./i18n/ko.json";
import zhCN from "./i18n/zh-CN.json";
import zhTW from "./i18n/zh-TW.json";
import RankingToolBar from "./RankingToolBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../ui/Dialog/HowToDialog", () => ({ default: () => null }));
vi.mock("../ui/Dialog/NewsListDialog", () => ({ default: () => null }));
vi.mock("../ui/Dialog/SettingsDialog", () => ({ default: () => null }));
vi.mock("./RankingAboutDialog", () => ({ default: () => null }));

afterEach(cleanup);

describe("ranking branding translations", () => {
	test("defines the same branding keys in all five languages", () => {
		const resources = [en, ja, ko, zhCN, zhTW];
		const expectedKeys = ["browser title", "screen title", "subtitle"];

		for (const resource of resources) {
			expect(Object.keys(resource.fork.brand).sort()).toEqual(expectedKeys);
			for (const value of Object.values(resource.fork.brand)) {
				expect(value.trim()).not.toBe("");
			}
		}
	});

	test("uses the agreed Japanese product name and attribution", () => {
		expect(ja.fork.brand).toEqual({
			"screen title": "ポケモン性能ランキング",
			subtitle: "個体値計算機をベースにした、育成候補と手持ち個体の比較ツール",
			"browser title":
				"ポケモン性能ランキング｜個体値計算機 for ポケモンスリープ",
		});
	});

	test("shows the ranking product name in the application toolbar", () => {
		render(
			React.createElement(RankingToolBar, {
				app: "IvCalc",
				onAppConfigChange: vi.fn(),
			}),
		);

		expect(screen.getByText("fork.brand.screen title")).toBeTruthy();
	});
});

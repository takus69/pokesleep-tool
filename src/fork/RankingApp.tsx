import "../ui/App.css";
import { createTheme, ThemeProvider } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type AppConfig from "../ui/AppConfig";
import { AppConfigContext, saveConfig } from "../ui/AppConfig";
import NewsInfo from "../ui/NewsInfo";
import PwaNotify from "../ui/PwaBanner";
import { registerForkTranslations } from "./i18n";
import RankingToolBar from "./RankingToolBar";
import RankingWorkspace from "./RankingWorkspace";

const app = "IvCalc" as const;

const defaultTheme = createTheme({
	typography: { allVariants: { fontFamily: `"M PLUS 1p"` } },
});
const tcTheme = createTheme({
	typography: { allVariants: { fontFamily: `"Noto Sans TC"` } },
});
const scTheme = createTheme({
	typography: { allVariants: { fontFamily: `"Noto Sans SC"` } },
});

export default function RankingApp({ config }: { config: AppConfig }) {
	const language = useMultilingual(config);
	useAppMetadata(language);
	const [appConfig, setAppConfig] = useState(config);
	const onAppConfigChange = useCallback((value: AppConfig) => {
		saveConfig(value);
		setAppConfig(value);
	}, []);

	const onPwaBannerClose = useCallback(() => {
		appConfig.pwacnt = 0;
		saveConfig(appConfig);
		setAppConfig(appConfig);
	}, [appConfig]);

	let theme = defaultTheme;
	if (language === "zh-TW") {
		theme = tcTheme;
	} else if (language === "zh-CN") {
		theme = scTheme;
	}

	return (
		<ThemeProvider theme={theme}>
			<AppConfigContext.Provider value={appConfig}>
				<RankingToolBar app={app} onAppConfigChange={onAppConfigChange} />
				<NewsInfo appType={app} onAppConfigChange={onAppConfigChange} />
				<RankingWorkspace />
				<PwaNotify
					app={app}
					pwaCount={config.pwacnt}
					onClose={onPwaBannerClose}
				/>
			</AppConfigContext.Provider>
		</ThemeProvider>
	);
}

function useMultilingual(config: AppConfig) {
	const { i18n } = useTranslation();
	const [language, setLanguage] = useState(config.language);

	const onLanguageChanged = useCallback(
		(value: string) => {
			registerForkTranslations(value);
			setLanguage(value);
			saveConfig({ ...config, language: value });
		},
		[config],
	);

	useEffect(() => {
		i18n.on("languageChanged", onLanguageChanged);
		return () => i18n.off("languageChanged", onLanguageChanged);
	}, [i18n, onLanguageChanged]);

	return language;
}

function useAppMetadata(language: string) {
	const { t } = useTranslation();
	useEffect(() => {
		document.title = t(`${app}.title`);
		const manifest = document.querySelector<HTMLLinkElement>(
			"link[rel='manifest']",
		);
		if (manifest !== null) {
			manifest.href = manifest.href.replace(
				/manifest.*/,
				`manifest.${language}.json`,
			);
		}
		const description = document.querySelector<HTMLMetaElement>(
			"meta[name='description']",
		);
		if (description !== null) {
			description.content = t(`${app}.description`);
		}
		const html = document.querySelector<HTMLHtmlElement>("html");
		if (html !== null) {
			html.lang = language.toLowerCase();
		}
		const webFont = document.querySelector<HTMLLinkElement>(
			"link[rel='stylesheet'][href*='https']",
		);
		if (webFont !== null) {
			if (language === "zh-TW") {
				webFont.href =
					"https://fonts.googleapis.com/css2?family=Noto+Sans+TC&display=swap";
			} else if (language === "zh-CN") {
				webFont.href =
					"https://fonts.googleapis.com/css2?family=Noto+Sans+SC&display=swap";
			} else {
				webFont.href =
					"https://fonts.googleapis.com/css2?family=M+PLUS+1p&display=swap";
			}
		}

		const isIvRoute = window.location.pathname.startsWith(
			"/pokesleep-tool/iv/",
		);
		let url = `${document.location.origin}/pokesleep-tool/${isIvRoute ? "iv/" : ""}`;
		if (language !== "en") {
			url += `index.${language.toLowerCase()}.html`;
		}
		window.history.replaceState(
			null,
			"",
			url + document.location.search + document.location.hash,
		);
	}, [language, t]);
}

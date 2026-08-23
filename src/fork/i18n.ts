import i18n from "../i18n";
import en from "./i18n/en.json";
import ja from "./i18n/ja.json";
import ko from "./i18n/ko.json";
import zhCN from "./i18n/zh-CN.json";
import zhTW from "./i18n/zh-TW.json";

const resources: Record<string, Record<string, unknown>> = {
	en,
	ja,
	ko,
	"zh-CN": zhCN,
	"zh-TW": zhTW,
};

export function registerForkTranslations(language: string): void {
	const resource = resources[language];
	if (resource !== undefined) {
		i18n.addResourceBundle(language, "translation", resource, true, true);
	}
}

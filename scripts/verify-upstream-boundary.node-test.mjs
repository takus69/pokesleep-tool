import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const verifierPath = resolve(scriptDirectory, "verify-upstream-boundary.mjs");

const expectedOwnedFiles = [
	".github/workflows/deploy.yml",
	"src/i18n/en/IvCalc.json",
	"src/i18n/en/common.json",
	"src/i18n/ja/IvCalc.json",
	"src/i18n/ja/common.json",
	"src/i18n/ko/IvCalc.json",
	"src/i18n/ko/common.json",
	"src/i18n/zh-CN/IvCalc.json",
	"src/i18n/zh-CN/common.json",
	"src/i18n/zh-TW/IvCalc.json",
	"src/i18n/zh-TW/common.json",
	"src/ui/App.tsx",
	"src/ui/Dialog/AboutDialog.tsx",
	"src/ui/IvCalc/IvCalcApp.tsx",
	"src/ui/IvCalc/IvState.ts",
	"src/ui/IvCalc/LowerTabHeader.tsx",
	"src/ui/IvCalc/Strength/StrengthParameterForm.tsx",
	"src/ui/ToolBar.tsx",
].sort();

const expectedSemanticFiles = [
	"src/i18n.ts",
	"src/index.tsx",
	"src/ui/App.tsx",
	"src/ui/AppConfig.ts",
	"src/ui/Dialog/AboutDialog.tsx",
	"src/ui/Dialog/SettingsDialog.tsx",
	"src/ui/IvCalc/IvCalcApp.tsx",
	"src/ui/IvCalc/IvState.ts",
	"src/ui/IvCalc/LowerTabHeader.tsx",
	"src/ui/IvCalc/Strength/StrengthParameterForm.tsx",
	"src/ui/ToolBar.tsx",
].sort();

function runGit(cwd, args) {
	const result = spawnSync("git", args, {
		cwd,
		encoding: "utf8",
		windowsHide: true,
	});
	assert.equal(result.status, 0, result.stderr || result.stdout);
	return result.stdout.trim();
}

test("boundary configuration covers 18 upstream-owned files", () => {
	const config = JSON.parse(
		readFileSync(resolve(scriptDirectory, "upstream-boundary.json"), "utf8"),
	);
	assert.deepEqual([...config.upstreamOwnedFiles].sort(), expectedOwnedFiles);
	assert.deepEqual(
		[...config.semanticReviewFiles].sort(),
		expectedSemanticFiles,
	);
	assert.equal(new Set(config.upstreamOwnedFiles).size, 18);
	assert.equal(new Set(config.semanticReviewFiles).size, 11);
	assert.match(config.reviewedUpstreamSha, /^[0-9a-f]{40}$/u);
});

test("boundary verifier succeeds for the reviewed repository state", () => {
	const result = spawnSync(process.execPath, [verifierPath], {
		cwd: repositoryRoot,
		encoding: "utf8",
		windowsHide: true,
	});
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /Upstream boundary verified/u);
});

test("boundary verifier rejects unreviewed semantic drift", () => {
	const temporaryDirectory = mkdtempSync(
		join(tmpdir(), "pokesleep-upstream-boundary-"),
	);
	try {
		runGit(temporaryDirectory, ["init"]);
		runGit(temporaryDirectory, ["config", "user.name", "Boundary Test"]);
		runGit(temporaryDirectory, [
			"config",
			"user.email",
			"boundary@example.invalid",
		]);
		const appPath = join(temporaryDirectory, "src", "ui", "App.tsx");
		mkdirSync(dirname(appPath), { recursive: true });
		writeFileSync(appPath, "export const version = 1;\n", "utf8");
		runGit(temporaryDirectory, ["add", "src/ui/App.tsx"]);
		runGit(temporaryDirectory, ["commit", "-m", "baseline"]);
		const reviewedSha = runGit(temporaryDirectory, ["rev-parse", "HEAD"]);
		writeFileSync(appPath, "export const version = 2;\n", "utf8");
		runGit(temporaryDirectory, ["commit", "-am", "upstream change"]);
		runGit(temporaryDirectory, ["remote", "add", "upstream", "."]);
		runGit(temporaryDirectory, [
			"update-ref",
			"refs/remotes/upstream/main",
			"HEAD",
		]);
		const temporaryConfig = join(temporaryDirectory, "boundary.json");
		writeFileSync(
			temporaryConfig,
			JSON.stringify({
				reviewedUpstreamSha: reviewedSha,
				upstreamOwnedFiles: ["src/ui/App.tsx"],
				semanticReviewFiles: ["src/ui/App.tsx"],
			}),
			"utf8",
		);
		const result = spawnSync(process.execPath, [verifierPath], {
			cwd: repositoryRoot,
			encoding: "utf8",
			windowsHide: true,
			env: {
				...process.env,
				POKESLEEP_UPSTREAM_BOUNDARY_CONFIG: temporaryConfig,
				POKESLEEP_UPSTREAM_BOUNDARY_REPOSITORY: temporaryDirectory,
			},
		});
		assert.equal(result.status, 1, result.stderr || result.stdout);
		assert.match(result.stderr, /Upstream integration files changed/u);
		assert.match(result.stderr, /update reviewedUpstreamSha/u);
	} finally {
		rmSync(temporaryDirectory, { recursive: true });
	}
});

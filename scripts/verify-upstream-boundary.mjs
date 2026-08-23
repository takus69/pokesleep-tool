import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = process.env.POKESLEEP_UPSTREAM_BOUNDARY_REPOSITORY
	? resolve(process.env.POKESLEEP_UPSTREAM_BOUNDARY_REPOSITORY)
	: resolve(scriptDirectory, "..");
const configPath = process.env.POKESLEEP_UPSTREAM_BOUNDARY_CONFIG
	? resolve(repositoryRoot, process.env.POKESLEEP_UPSTREAM_BOUNDARY_CONFIG)
	: resolve(scriptDirectory, "upstream-boundary.json");

function runGit(args) {
	return spawnSync("git", args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		windowsHide: true,
	});
}

function requireCommit(commitish, missingMessage) {
	const result = runGit([
		"rev-parse",
		"--verify",
		"--quiet",
		`${commitish}^{commit}`,
	]);
	if (result.status !== 0) {
		console.error(missingMessage);
		process.exitCode = 1;
		return null;
	}
	return result.stdout.trim();
}

function changedFiles(from, to, files) {
	const result = runGit([
		"diff",
		"--name-only",
		`${from}..${to}`,
		"--",
		...files,
	]);
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || "git diff failed");
	}
	return result.stdout.trim().split(/\r?\n/u).filter(Boolean);
}

function filesDifferentFromUpstream(upstreamRef, files) {
	const result = runGit(["diff", "--name-only", upstreamRef, "--", ...files]);
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || "git diff failed");
	}
	return result.stdout.trim().split(/\r?\n/u).filter(Boolean);
}

function main() {
	const config = JSON.parse(readFileSync(configPath, "utf8"));
	const upstreamRef = "upstream/main";
	const upstreamRemote = runGit(["remote", "get-url", "upstream"]);
	if (upstreamRemote.status !== 0) {
		console.error(
			"Missing upstream remote. Add it with: git remote add upstream https://github.com/nitoyon/pokesleep-tool.git",
		);
		process.exitCode = 1;
		return;
	}
	const upstreamSha = requireCommit(
		upstreamRef,
		"Missing upstream/main. Fetch it with: git fetch upstream main",
	);
	const reviewedSha = requireCommit(
		config.reviewedUpstreamSha,
		`Missing reviewed upstream commit (${config.reviewedUpstreamSha}). The history may be shallow; run git fetch --deepen=100 upstream main or git fetch --unshallow upstream, then retry.`,
	);
	if (upstreamSha === null || reviewedSha === null) {
		return;
	}

	let failed = false;
	const boundaryChanges = filesDifferentFromUpstream(
		upstreamRef,
		config.upstreamOwnedFiles,
	);
	if (boundaryChanges.length > 0) {
		failed = true;
		console.error("Upstream-owned files differ from upstream/main:");
		for (const file of boundaryChanges) console.error(`  - ${file}`);
		console.error("Move fork-specific behavior behind src/fork/ adapters.");
	}

	if (reviewedSha !== upstreamSha) {
		const ancestor = runGit([
			"merge-base",
			"--is-ancestor",
			reviewedSha,
			upstreamSha,
		]);
		if (ancestor.status !== 0) {
			failed = true;
			console.error(
				"The reviewed upstream SHA is not an ancestor of upstream/main. Review the ref history manually.",
			);
		} else {
			const semanticChanges = changedFiles(
				reviewedSha,
				upstreamSha,
				config.semanticReviewFiles,
			);
			if (semanticChanges.length > 0) {
				failed = true;
				console.error(
					`Upstream integration files changed since ${reviewedSha}:`,
				);
				for (const file of semanticChanges) console.error(`  - ${file}`);
				console.error(
					`Review with: git diff ${reviewedSha}..upstream/main -- ${semanticChanges.join(" ")}`,
				);
				console.error(
					"After reviewing and adapting src/fork/, update reviewedUpstreamSha in scripts/upstream-boundary.json, then rerun this command and npm run verify.",
				);
			}
		}
	}

	if (failed) {
		process.exitCode = 1;
		return;
	}
	console.log(
		`Upstream boundary verified at ${upstreamSha} (${config.upstreamOwnedFiles.length} owned files).`,
	);
}

main();

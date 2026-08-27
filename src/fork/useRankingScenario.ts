import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PokemonIv from "../util/PokemonIv";
import {
	calculateRankingScenarioAsync,
	createRankingEnvironment,
	evaluateRankingComparison,
	type RankingScenarioConfig,
	type RankingScenarioPurpose,
	type RankingScenarioResult,
} from "../util/RankingScenario";
import {
	type StrengthParameter,
	serializeStrengthParameter,
} from "../util/StrengthParameter";
import {
	loadRankingScenarioSettings,
	normalizeRankingScenarioConfig,
	resetRankingScenarioSettings,
	saveRankingScenarioSettings,
	serializeRankingScenarioConfig,
} from "./RankingScenarioState";

export interface RankingScenarioSnapshot {
	config: RankingScenarioConfig;
	environment: StrengthParameter;
	key: string;
}

export type RankingScenarioStatus =
	| "idle"
	| "running"
	| "complete"
	| "cancelled"
	| "error";

/** Copy nested environment data without normalizing away user-selected values. */
export function cloneRankingEnvironment(
	environment: StrengthParameter,
): StrengthParameter {
	const plain: unknown = JSON.parse(serializeStrengthParameter(environment));
	return {
		...(plain as StrengthParameter),
		teamMember: new PokemonIv(environment.teamMember.toProps()),
	};
}

/** One explicit run at a time; comparisons never share candidate fixed conditions. */
export default function useRankingScenario(
	environment: StrengthParameter,
	comparisonIv: PokemonIv | null,
) {
	const [settings, setSettings] = useState(loadRankingScenarioSettings);
	const [result, setResult] = useState<RankingScenarioResult | null>(null);
	const [snapshot, setSnapshot] = useState<RankingScenarioSnapshot | null>(
		null,
	);
	const [status, setStatus] = useState<RankingScenarioStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const currentConfig = settings.configs[settings.purpose];
	const configKey = serializeRankingScenarioConfig(currentConfig);
	const environmentKey = JSON.stringify({
		...createRankingEnvironment(environment),
		teamMember: environment.teamMember.toProps(),
	});
	const key = `${configKey}\n${environmentKey}`;
	const currentKey = useRef(key);
	currentKey.current = key;
	const activeRun = useRef<{
		id: number;
		controller: AbortController;
		key: string;
	} | null>(null);
	const runId = useRef(0);

	useEffect(() => {
		saveRankingScenarioSettings(settings);
	}, [settings]);
	const cancel = useCallback(() => {
		if (activeRun.current === null) return;
		activeRun.current.controller.abort();
		activeRun.current = null;
		runId.current += 1;
		setStatus("cancelled");
	}, []);
	useEffect(() => {
		// Changing conditions invalidates a pending run but retains its previous result.
		if (activeRun.current !== null && activeRun.current.key !== key) cancel();
	}, [key, cancel]);
	useEffect(
		() => () => {
			activeRun.current?.controller.abort();
			activeRun.current = null;
			runId.current += 1;
		},
		[],
	);

	const setPurpose = useCallback((purpose: RankingScenarioPurpose) => {
		setSettings((previous) => ({ ...previous, purpose }));
	}, []);
	const setConfig = useCallback((config: RankingScenarioConfig) => {
		setSettings((previous) => ({
			...previous,
			configs: {
				...previous.configs,
				[config.purpose]: normalizeRankingScenarioConfig(
					config.purpose,
					config,
				),
			},
		}));
	}, []);
	const resetCurrent = useCallback(
		() => setSettings(resetRankingScenarioSettings),
		[],
	);
	const calculate = useCallback(async () => {
		activeRun.current?.controller.abort();
		const id = ++runId.current;
		const controller = new AbortController();
		activeRun.current = { id, controller, key };
		const calculationSnapshot: RankingScenarioSnapshot = {
			config: normalizeRankingScenarioConfig(
				currentConfig.purpose,
				JSON.parse(configKey) as unknown,
			),
			environment: cloneRankingEnvironment(
				createRankingEnvironment(environment),
			),
			key,
		};
		setStatus("running");
		setError(null);
		setProgress(0);
		setResult(null);
		setSnapshot(calculationSnapshot);
		const isCurrent = () =>
			id === runId.current &&
			!controller.signal.aborted &&
			currentKey.current === key;
		try {
			const value = await calculateRankingScenarioAsync(
				calculationSnapshot.config,
				calculationSnapshot.environment,
				{
					signal: controller.signal,
					onProgress: (completed) => {
						if (isCurrent()) setProgress(completed);
					},
					onPartialResult: (partial) => {
						if (!isCurrent()) return;
						setProgress(partial.completed);
						setResult(partial.result);
					},
				},
			);
			if (!isCurrent()) return;
			setResult(value);
			setSnapshot(calculationSnapshot);
			setStatus("complete");
		} catch (cause: unknown) {
			if (!isCurrent()) return;
			setError(cause instanceof Error ? cause.message : "calculationFailed");
			setStatus("error");
		} finally {
			if (activeRun.current?.id === id) activeRun.current = null;
		}
	}, [currentConfig.purpose, configKey, environment, key]);

	const stale = snapshot !== null && snapshot.key !== key;
	const comparison = useMemo(() => {
		if (comparisonIv === null || snapshot === null || stale) return null;
		return evaluateRankingComparison(
			comparisonIv,
			snapshot.config,
			snapshot.environment,
		);
	}, [comparisonIv, snapshot, stale]);

	return {
		settings,
		currentConfig,
		setPurpose,
		setConfig,
		resetCurrent,
		result,
		snapshot,
		status,
		stale,
		error,
		progress,
		calculate,
		cancel,
		comparison,
	};
}

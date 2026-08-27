import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import PokemonIv from "../util/PokemonIv";
import {
	calculateRankingScenarioAsync,
	evaluateRankingComparison,
	type RankingScenarioResult,
} from "../util/RankingScenario";
import { createStrengthParameter } from "../util/StrengthParameter";
import useRankingScenario, {
	cloneRankingEnvironment,
} from "./useRankingScenario";

vi.mock("../util/RankingScenario", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("../util/RankingScenario")>();
	return {
		...original,
		calculateRankingScenarioAsync: vi.fn(),
		evaluateRankingComparison: vi.fn(),
	};
});

const emptyResult = (): RankingScenarioResult => ({
	entries: [],
	groups: [],
	exclusions: [],
});
function deferred() {
	let resolve!: (result: RankingScenarioResult) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<RankingScenarioResult>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

beforeEach(() => {
	localStorage.clear();
	vi.mocked(calculateRankingScenarioAsync)
		.mockReset()
		.mockResolvedValue(emptyResult());
	vi.mocked(evaluateRankingComparison)
		.mockReset()
		.mockReturnValue({ status: "positive", value: 10 });
});

describe("explicit ranking calculation lifecycle", () => {
	test("publishes a snapshot and partial result while a run is active", async () => {
		const pending = deferred();
		vi.mocked(calculateRankingScenarioAsync).mockReturnValue(pending.promise);
		const { result } = renderHook(() =>
			useRankingScenario(createStrengthParameter({}), null),
		);
		let run!: Promise<void>;
		act(() => {
			run = result.current.calculate();
		});
		expect(result.current.status).toBe("running");
		expect(result.current.snapshot).not.toBeNull();
		expect(result.current.result).toBeNull();

		const partial = emptyResult();
		act(() => {
			vi.mocked(
				calculateRankingScenarioAsync,
			).mock.calls[0][2]?.onPartialResult?.({
				result: partial,
				completed: 128,
			});
		});
		expect(result.current.status).toBe("running");
		expect(result.current.progress).toBe(128);
		expect(result.current.result).toBe(partial);

		const complete = emptyResult();
		await act(async () => {
			pending.resolve(complete);
			await run;
		});
		expect(result.current.status).toBe("complete");
		expect(result.current.result).toBe(complete);
	});

	test("does not run on load or edits, keeps stale snapshot until explicit recalculation", async () => {
		const environment = createStrengthParameter({});
		const { result } = renderHook(() => useRankingScenario(environment, null));
		expect(calculateRankingScenarioAsync).not.toHaveBeenCalled();
		await act(() => result.current.calculate());
		const snapshot = result.current.snapshot;
		act(() =>
			result.current.setConfig({ ...result.current.currentConfig, level: 30 }),
		);
		expect(calculateRankingScenarioAsync).toHaveBeenCalledTimes(1);
		expect(result.current.stale).toBe(true);
		expect(result.current.snapshot).toBe(snapshot);
		expect(result.current.snapshot?.config.level).toBe(60);
		await act(() => result.current.calculate());
		expect(result.current.stale).toBe(false);
		expect(result.current.snapshot?.config.level).toBe(30);
	});

	test("retains each purpose's config on switching and restores after remount", () => {
		const environment = createStrengthParameter({});
		const first = renderHook(() => useRankingScenario(environment, null));
		act(() =>
			first.result.current.setConfig({
				...first.result.current.currentConfig,
				pokemonName: "Dragonite",
			}),
		);
		act(() => first.result.current.setPurpose("ingredient"));
		act(() =>
			first.result.current.setConfig({
				...first.result.current.currentConfig,
				ingredient: "herb",
			}),
		);
		act(() => first.result.current.setPurpose("traits"));
		expect(first.result.current.currentConfig.pokemonName).toBe("Dragonite");
		first.unmount();
		const second = renderHook(() => useRankingScenario(environment, null));
		expect(second.result.current.currentConfig.pokemonName).toBe("Dragonite");
		act(() => second.result.current.setPurpose("ingredient"));
		expect(second.result.current.currentConfig.ingredient).toBe("herb");
	});

	test("cancel and rerun prevent late completion or progress from replacing the newer run", async () => {
		const oldRun = deferred();
		const newRun = deferred();
		vi.mocked(calculateRankingScenarioAsync)
			.mockReturnValueOnce(oldRun.promise)
			.mockReturnValueOnce(newRun.promise);
		const { result } = renderHook(() =>
			useRankingScenario(createStrengthParameter({}), null),
		);
		let oldPromise!: Promise<void>;
		act(() => {
			oldPromise = result.current.calculate();
		});
		const oldOptions = vi.mocked(calculateRankingScenarioAsync).mock
			.calls[0][2];
		act(() => result.current.cancel());
		expect(oldOptions?.signal?.aborted).toBe(true);
		expect(result.current.status).toBe("cancelled");
		let newPromise!: Promise<void>;
		act(() => {
			newPromise = result.current.calculate();
		});
		const latest = emptyResult();
		await act(async () => {
			newRun.resolve(latest);
			await newPromise;
		});
		await act(async () => {
			oldOptions?.onProgress?.(999);
			oldOptions?.onPartialResult?.({
				result: {
					...emptyResult(),
					exclusions: [{ reason: "invalidValue", count: 1 }],
				},
				completed: 999,
			});
			oldRun.resolve(emptyResult());
			await oldPromise;
		});
		expect(result.current.result).toBe(latest);
		expect(result.current.status).toBe("complete");
		expect(result.current.progress).toBe(0);
	});

	test("condition edits abort pending runs and reject their late results", async () => {
		const pending = deferred();
		vi.mocked(calculateRankingScenarioAsync).mockReturnValue(pending.promise);
		const { result } = renderHook(() =>
			useRankingScenario(createStrengthParameter({}), null),
		);
		let run!: Promise<void>;
		act(() => {
			run = result.current.calculate();
		});
		act(() => result.current.setPurpose("berry"));
		expect(
			vi.mocked(calculateRankingScenarioAsync).mock.calls[0][2]?.signal
				?.aborted,
		).toBe(true);
		await act(async () => {
			pending.resolve(emptyResult());
			await run;
		});
		expect(result.current.result).toBeNull();
		expect(result.current.status).toBe("cancelled");
	});

	test("reports failure and permits retry", async () => {
		vi.mocked(calculateRankingScenarioAsync).mockRejectedValueOnce(
			new Error("missingPokemon"),
		);
		const { result } = renderHook(() =>
			useRankingScenario(createStrengthParameter({}), null),
		);
		await act(() => result.current.calculate());
		expect(result.current.status).toBe("error");
		expect(result.current.error).toBe("missingPokemon");
		await act(() => result.current.calculate());
		expect(result.current.status).toBe("complete");
		expect(result.current.error).toBeNull();
	});

	test("evaluates only a comparison when current and waits for candidate recalculation after environment edits", async () => {
		const environment = createStrengthParameter({});
		const comparison = new PokemonIv({
			pokemonName: "Gengar",
			level: 30,
			ingredient: "ABB",
			skillLevel: 2,
			ribbon: 1,
		});
		const { result, rerender } = renderHook(
			({ environment, iv }) => useRankingScenario(environment, iv),
			{ initialProps: { environment, iv: null as PokemonIv | null } },
		);
		await act(() => result.current.calculate());
		rerender({ environment, iv: comparison });
		expect(evaluateRankingComparison).toHaveBeenCalledTimes(1);
		expect(vi.mocked(evaluateRankingComparison).mock.calls[0][0]).toBe(
			comparison,
		);
		expect(calculateRankingScenarioAsync).toHaveBeenCalledTimes(1);
		const changed = { ...environment, fieldBonus: 25 };
		rerender({ environment: changed, iv: comparison });
		expect(result.current.stale).toBe(true);
		expect(result.current.comparison).toBeNull();
		expect(evaluateRankingComparison).toHaveBeenCalledTimes(1);
		await act(() => result.current.calculate());
		expect(evaluateRankingComparison).toHaveBeenCalledTimes(2);
		expect(
			vi.mocked(evaluateRankingComparison).mock.calls[1][2].fieldBonus,
		).toBe(25);
		expect(result.current.comparison).toEqual({
			status: "positive",
			value: 10,
		});
	});

	test("retains an uncalculable comparison evaluation", async () => {
		vi.mocked(evaluateRankingComparison).mockReturnValue({
			status: "uncalculable",
			reason: "unknownIngredient",
		});
		const { result } = renderHook(() =>
			useRankingScenario(
				createStrengthParameter({}),
				new PokemonIv({ pokemonName: "Gengar" }),
			),
		);
		await act(() => result.current.calculate());
		expect(result.current.comparison).toEqual({
			status: "uncalculable",
			reason: "unknownIngredient",
		});
	});

	test("reading lazy team-member caches does not mark unchanged conditions stale", async () => {
		const environment = createStrengthParameter({});
		const { result, rerender } = renderHook(() =>
			useRankingScenario(environment, null),
		);
		await act(() => result.current.calculate());
		void environment.teamMember.activeSubSkills;
		rerender();
		expect(result.current.stale).toBe(false);
		expect(calculateRankingScenarioAsync).toHaveBeenCalledTimes(1);
	});

	test("changing team-member rate overrides invalidates the saved calculation", async () => {
		const environment = createStrengthParameter({});
		const { result, rerender } = renderHook(() =>
			useRankingScenario(environment, null),
		);
		await act(() => result.current.calculate());
		environment.teamMember = new PokemonIv({
			...environment.teamMember.toProps(),
			baseIngRate: 0.42,
			baseSkillRate: 0.11,
		});
		rerender();
		expect(result.current.stale).toBe(true);
		expect(calculateRankingScenarioAsync).toHaveBeenCalledTimes(1);
	});

	test("isolates snapshots from nested source mutations without losing team overrides", async () => {
		const environment = createStrengthParameter({});
		environment.level = 100;
		environment.evolved = true;
		environment.maxSkillLevel = true;
		environment.teamMember = new PokemonIv({
			pokemonName: "Gengar",
			baseIngRate: 0.42,
			baseSkillRate: 0.11,
		});
		const { result, rerender } = renderHook(() =>
			useRankingScenario(environment, null),
		);
		await act(() => result.current.calculate());
		const snapshot = result.current.snapshot;
		expect(snapshot?.environment).toMatchObject({
			level: 0,
			evolved: false,
			maxSkillLevel: false,
		});
		expect(snapshot?.environment.teamMember.baseIngRate).toBe(0.42);
		expect(snapshot?.environment.teamMember.baseSkillRate).toBe(0.11);
		const previousFlags = [...environment.totalFlags];
		const previousMembers = [...environment.berryBurstTeam.members];
		environment.totalFlags[0] = !environment.totalFlags[0];
		environment.berryBurstTeam.members.push({ type: "fire", level: 60 });
		rerender();
		expect(snapshot?.environment.totalFlags).toEqual(previousFlags);
		expect(snapshot?.environment.berryBurstTeam.members).toEqual(
			previousMembers,
		);
		expect(result.current.stale).toBe(true);
		expect(environment.level).toBe(100);
		expect(
			cloneRankingEnvironment(environment).teamMember.isEqual(
				environment.teamMember,
			),
		).toBe(true);
	});
});

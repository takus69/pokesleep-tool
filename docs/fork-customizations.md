# Fork customizations

This fork publishes a ranking-focused application while continuing
to use upstream Pokémon Sleep calculations, data, state, and shared UI.

## Boundary

Fork-specific presentation code lives in `src/fork/`:

- `RankingApp.tsx` fixes the public application to the IV/ranking experience.
- `RankingWorkspace.tsx` composes the ranking view with the upstream Pokémon
  editor and box inside the optional comparison dialog. Shared environment
  controls are opened from the ranking flow, not a second permanent lower panel.
- `RankingToolBar.tsx` removes the upstream application switcher.
- `RankingAboutDialog.tsx` keeps fork attribution, license, and support links
  out of the upstream About dialog.
- `RankingScenarioView.tsx`, `RankingScenarioOptions.tsx`, and
  `RankingScenarioResults.tsx` compose the unified six-purpose ranking flow.
- `RankingScenarioState.ts` and `useRankingScenario.ts` own purpose-specific
  settings, explicit calculation, cancellation, and result freshness.
- `RankingEnvironmentForm.tsx` and `RankingEnvironmentDialog.tsx` adapt the
  existing strength-parameter controls without individual overrides.
- `i18n/` contains namespaced `fork.scenario.*`, `fork.ingredientRanking.*`, and `fork.about.*`
  translations, registered by `src/fork/i18n.ts`.

Fork-specific calculation logic lives in `src/util/RankingScenario.ts` with
its co-located test. It reuses the existing ranking utilities for ingredient
patterns, trait enumeration, numeric sorting, and effect signatures. The legacy
`IngredientRanking.ts` and `PokemonRanking.ts` APIs remain covered by their
existing tests for compatibility; their old best-pattern selection and broad
filters are not the behavior contract for the new unified UI. The application entry point, `src/index.tsx`, is the only
upstream startup file that selects the fork application and registers its
translations.

Do not put ranking-only UI or translations back into `src/ui/` or
`src/i18n/<language>/IvCalc.json`. Keeping those files identical to upstream
reduces recurring merge conflicts.

The upstream `.github/workflows/deploy.yml` is also kept unchanged. Fork
publishing is defined separately in `.github/workflows/fork-deploy.yml` and
runs only in `takus69/pokesleep-tool` on main pushes or manual dispatches.

`biome.json` has one intentional fork-only difference: local `.codex/` and
`artifacts/` directories are excluded from repository verification. These are
workspace-owned directories and must not be edited or formatted.

`RankingWorkspace.tsx` is a derived composition of upstream
`src/ui/IvCalc/IvCalcApp.tsx`, not an independent implementation. It directly
reuses the upstream IV reducer/state and Pokémon, box, parameter, rate, and
dialog components. Therefore an upstream `IvCalcApp.tsx` change always requires
a semantic review even when Git reports no merge conflict. Pay particular
attention to reducer/state initialization, actions, save/restore behavior,
dialogs, callbacks, and component props.

Likewise, compare `RankingApp.tsx` with upstream `src/ui/App.tsx` whenever the
upstream application shell changes. Review theme selection, language loading
and change events, metadata/routes, configuration persistence, PWA/news
behavior, and the contracts of components or reducers reused directly by the
fork adapters. The semantic-drift check also watches `src/index.tsx`,
`src/i18n.ts`, `src/ui/AppConfig.ts`, and
`src/ui/Dialog/SettingsDialog.tsx`; changes there can affect fork startup,
translation registration and switching, persisted configuration, or settings
callbacks without touching the upstream-owned presentation files.

`RankingEnvironmentForm.tsx` is a derived composition of upstream
`src/ui/IvCalc/Strength/StrengthParameterForm.tsx`. Review it when that upstream
form or its child controls change, even without a textual conflict. It reuses
the upstream environment components but does not expose the old `level`,
`evolved`, or `maxSkillLevel` individual overrides. The ranking calculation
adapter neutralizes these three fields without overwriting their persisted
upstream values. Candidate normal skill levels already include Skill Level Up;
event and Expert bonuses and skill caps remain upstream calculations.
`preserveRankingIndividualSettings` also adapts `changeParameter` callbacks
from reused individual/box controls: sanitized parameters passed to their views
must not accidentally replace the persisted legacy override fields. Review both
the parameters passed into upstream components and the actions returned by them.

Purpose-specific settings use the separate localStorage key
`PstForkRankingScenarios.v1`. It stores the active purpose and one configuration
per purpose; first-use main conditions are unselected. The island/favorite
berries and other environment settings remain exclusively in the existing IV
state storage. A ranking reset only resets the current purpose. Existing box,
individual, environment, and legacy ranking storage is not deleted or rewritten
as a migration. Comparison individuals remain independent of candidate settings.

## Updating from upstream

1. Fetch and merge the current upstream branch:

   ```shell
   git fetch upstream
   git merge upstream/main
   ```

2. Run the boundary and semantic-drift check:

   ```shell
   npm run verify:upstream-boundary
   ```

   The command verifies that all 18 upstream-owned files still match
   `upstream/main`. It also compares integration-sensitive upstream files with
   the reviewed SHA recorded in `scripts/upstream-boundary.json`.

3. If semantic drift is reported, inspect the listed diff. Review
   `IvCalcApp.tsx` and `App.tsx` using the rules above even if the merge was
   conflict-free. Also review `IvState`, `LowerTabHeader`,
   `StrengthParameterForm`, `ToolBar`, `AboutDialog`, `index.tsx`, `i18n.ts`,
   `AppConfig.ts`, and `SettingsDialog.tsx` contracts.

4. Apply required compatibility changes in `src/fork/` and, when calculation
   behavior changed, in the fork ranking utilities and their tests. Keep the
   18 upstream-owned files identical to `upstream/main`.

5. Update `reviewedUpstreamSha` in `scripts/upstream-boundary.json` to the full
   SHA printed by `git rev-parse upstream/main` only after all reported changes
   have been read, their behavioral impact has been assessed, required fork
   adapters/tests have been updated, and the upstream-owned-file comparison is
   clean. Do not update the SHA merely to make the check pass.

6. Rerun the checks:

   ```shell
   npm run verify:upstream-boundary
   npm run verify
   ```

7. Manually confirm the public ranking route and six-purpose flow, the optional
   comparison dialog's Pokémon/box tabs, the shared environment dialog, settings
   language switch, and About/license links. Check that closing/reopening either
   dialog preserves its data and does not create a second environment editor.

## Expected integration points

Upstream changes may legitimately require edits in the fork boundary when they
change `AppConfig`, IV state/actions, the lower tab contract, strength parameter
props, translation loading, or application metadata/routes. Make those adapter
changes in `src/fork/` whenever possible and keep the upstream-owned files
unchanged.

## Ranking redesign specification

The ranking redesign is documented in
[Ranking scenarios and handoff design](ranking-scenarios.md) (Japanese).
It records confirmed requirements and implementation proposals for a unified
six-purpose ranking flow; all major user decisions have been resolved. The
implementation now maps those requirements to the scenario UI, purpose-specific
state, and shared evaluation pipeline described above. Integration verification
and browser acceptance checks must still be completed before declaring the
redesign finished; focused calculation tests alone do not prove UI completion.

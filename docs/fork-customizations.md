# Fork customizations

This fork publishes an ingredient-ranking-focused application while continuing
to use upstream Pokémon Sleep calculations, data, state, and shared UI.

## Boundary

Fork-specific presentation code lives in `src/fork/`:

- `RankingApp.tsx` fixes the public application to the IV/ranking experience.
- `RankingWorkspace.tsx` composes the ranking view with the upstream Pokémon,
  box, and parameter panels.
- `RankingToolBar.tsx` removes the upstream application switcher.
- `RankingAboutDialog.tsx` keeps fork attribution, license, and support links
  out of the upstream About dialog.
- `RankingLowerTabHeader.tsx` adapts the upstream lower tabs so the parameter
  tab remains available in the ranking-only workspace.
- `IngredientRankingView.tsx` contains the ranking UI.
- `i18n/` contains namespaced `fork.ingredientRanking.*` and `fork.about.*`
  translations, registered by `src/fork/i18n.ts`.

Fork-specific calculation logic remains in `src/util/IngredientRanking.ts` with
its co-located test. The application entry point, `src/index.tsx`, is the only
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
   behavior changed, in `src/util/IngredientRanking.ts` and its tests. Keep the
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

7. Manually confirm the public ranking route, lower
   Pokémon/box/parameter tabs, settings language switch, and About/license
   links.

## Expected integration points

Upstream changes may legitimately require edits in the fork boundary when they
change `AppConfig`, IV state/actions, the lower tab contract, strength parameter
props, translation loading, or application metadata/routes. Make those adapter
changes in `src/fork/` whenever possible and keep the upstream-owned files
unchanged.

## Ranking redesign specification

The planned ranking redesign is documented in
[Ranking scenarios and handoff design](ranking-scenarios.md) (Japanese).
It records confirmed requirements and implementation proposals for a unified
six-purpose ranking flow; all major user decisions have been resolved. The
redesign is not yet implemented. This specification is not a description of
current application behavior or an instruction to remove existing
implementations immediately.

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

## Updating from upstream

1. Fetch `upstream` and merge `upstream/main` into this fork's main branch.
2. Resolve changes in upstream-owned files without copying fork-only behavior
   into them.
3. Review upstream API changes used by `src/fork/` and
   `src/util/IngredientRanking.ts`.
4. Confirm the upstream-owned files below still match `upstream/main`:

   ```shell
   git diff --exit-code upstream/main -- \
     src/ui/App.tsx src/ui/ToolBar.tsx \
     src/ui/IvCalc/IvCalcApp.tsx src/ui/IvCalc/IvState.ts \
     src/ui/IvCalc/LowerTabHeader.tsx \
     src/ui/IvCalc/Strength/StrengthParameterForm.tsx \
     src/i18n/en/IvCalc.json src/i18n/ja/IvCalc.json \
     src/i18n/ko/IvCalc.json src/i18n/zh-CN/IvCalc.json \
     src/i18n/zh-TW/IvCalc.json
   ```

   Also compare `src/ui/Dialog/AboutDialog.tsx`, all five
   `src/i18n/<language>/common.json` files, and
   `.github/workflows/deploy.yml`; fork equivalents belong under `src/fork/`
   or in `fork-deploy.yml`.

5. Run `npm run verify` and manually confirm the public ranking route, lower
   Pokémon/box/parameter tabs, settings language switch, and About/license
   links.

## Expected integration points

Upstream changes may legitimately require edits in the fork boundary when they
change `AppConfig`, IV state/actions, the lower tab contract, strength parameter
props, translation loading, or application metadata/routes. Make those adapter
changes in `src/fork/` whenever possible and keep the upstream-owned files
unchanged.

# Analytics Stage 9 — pure calculations and accessible monthly chart

## Scope

This stage deliberately preserves the current Statistics screen layout and user-facing period/mode behavior. It is a reliability and accessibility refactor, not a reports redesign.

## Changes

- Extract period selection, totals, daily series, category grouping, and calendar helpers from `StatisticsScreen.tsx` into `src/utils/financialAnalytics.ts`.
- Keep internal transfers excluded from income/expense totals at the selection and aggregation boundaries.
- Add focused unit tests for month/day selection, transfer exclusion, daily zero-fill, leap years, canonical category labels, legacy category fallback, category percentages, and ordering.
- Make the monthly chart keyboard navigable with Left/Right, Home, and End.
- Expose the selected day and exact values through slider accessibility properties and a visible keyboard-focus outline.
- Align each line and its filled area with the corresponding legend colour (income=mint, expenses=indigo).

## Design basis

- Apple Human Interface Guidelines — Charts: charts should include context, summaries, understandable labels, keyboard interaction, and should not rely on colour alone to communicate data.
  https://developer.apple.com/design/human-interface-guidelines/charts
- W3C WCAG 2.2 — Keyboard Accessible: available functionality must be operable from a keyboard.
  https://www.w3.org/WAI/WCAG22/Understanding/keyboard-accessible.html
- W3C WCAG 2.2 — Non-text Content: graphical information needs a text alternative that serves an equivalent purpose.
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html

## Validation status

- Dependencies and database schema unchanged.
- Syntax transpilation checked for all TS/TSX source files in this working copy.
- Full ESLint, TypeScript typecheck, Vitest, and Vite build must still be run in the user's environment before this stage is accepted.

# Analytics comparison — Stage 13

## Goal

Add a small, factual comparison to the Statistics screen without changing the existing chart, category drill-down, storage schema, or dependencies.

## Comparison rules

- **Day mode:** selected local calendar date versus the preceding local calendar date.
- **Current month:** month-to-date versus the same day number in the previous month. When the previous month is shorter, its range ends at that month's final day; labels show the exact dates being compared.
- **Historical month:** the complete selected month versus the complete preceding month.
- Internal transfers are excluded from both sides.
- If the previous income or expense baseline is zero, no percentage is calculated. The UI states that there were no operations in the previous period instead of showing an infinite or misleading percentage.
- In the combined view, the comparison uses net income minus expenses and reports the absolute change, not a percentage based on a value that may be zero or negative.
- Future-dated transactions are excluded from current-month totals so the headline totals, month-to-date comparison, and graph through today use the same window. Historical months remain complete.

## Files

- `src/utils/financialAnalytics.ts`
- `src/utils/financialAnalytics.test.ts`
- `src/components/StatisticsScreen.tsx`
- `src/components/__tests__/StatisticsScreen.test.tsx`

## Design and data decisions

Use local calendar construction and ISO date keys for day boundaries; do not parse date-only values as UTC timestamps. This reduces off-by-one-day risks from timezone interpretation. Keep the comparison secondary to the main KPI and avoid using color alone to imply whether a change is desirable.

The comparison is descriptive, not predictive. It does not adjust for seasonality, different weekdays, inflation, or one-off events. Transfer operations remain excluded and currencies are not converted or mixed; the Statistics screen continues to consume the app's RUB-filtered transaction set.

## References

- Apple Human Interface Guidelines — Charts: https://developer.apple.com/design/human-interface-guidelines/charts
- MDN — Date: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
- MDN — Date.parse(): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse

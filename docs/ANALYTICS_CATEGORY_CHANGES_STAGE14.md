# Analytics category changes — Stage 14

## Goal

Show a compact explanation of which categories contributed to changes between the selected month and the comparable previous period. This builds on Stage 13 period comparisons without adding a chart library or changing storage.

## Rules

- Monthly view only; day view remains focused on individual-day totals and comparison.
- The combined view compares expenses by category, matching the existing expense breakdown. The Income view compares income categories; the Expenses view compares expense categories.
- Internal transfers and non-finite amounts are excluded.
- Stable category IDs are preferred. Legacy records without IDs are grouped by trimmed, lowercased category name. The current category label is preferred where available.
- Only categories with a non-zero difference are shown, ordered by absolute amount of change. The interface shows at most three items to preserve a restrained visual hierarchy.
- Values are displayed as previous-period amount → current-period amount and an absolute difference. A percentage is deliberately omitted to avoid misleading percentages when the previous amount is zero or very small.
- No categories are converted between currencies; the screen continues to use its existing RUB-only analytics set.

## Tests

- Expense changes sort by absolute amount and internal transfers are ignored.
- Income mode only compares income categories.
- Unchanged category amounts are omitted.
- Statistics UI shows previous/current amounts, difference, and exact compared ranges.

## References

- Apple Human Interface Guidelines — Charts: https://developer.apple.com/design/human-interface-guidelines/charts (keep charts and summaries focused, clear, and contextual).
- Consumer Financial Protection Bureau — Assess your spending: https://www.consumerfinance.gov/owning-a-home/prepare/assess-your-spending/ (review category spending over time and compare it with take-home pay).
- Quicken Spending Dashboard: https://info.quicken.com/sim/your-spending-dashboard (period comparisons, category breakdown, and identifying what contributes to spending changes).

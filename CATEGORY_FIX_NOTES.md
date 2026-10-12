# Category and transaction relationship fix

## What changed

- Transactions now store `categoryId` as their category reference. Category names and icons are resolved from the single shared category state in `App.tsx`.
- Category state is owned once at the app level instead of being independently initialized inside the transaction sheet and every transaction row.
- Renaming a category or changing its icon immediately updates all transactions linked to that category ID.
- Deleting a category that is referenced by transaction history archives it: it disappears from new transaction choices but remains available to historical records. Unused categories can still be removed completely.
- Creating a second active category with the same name and income/expense type is blocked. Existing duplicate categories remain distinct by ID and can still have their icons edited when keeping their existing names.

## Existing localStorage data

The first load normalizes older transaction records. A legacy record is linked automatically only when its category name and transaction type match exactly one active category. If duplicate categories make the match ambiguous, the record is deliberately kept unlinked (`categoryId: null`) rather than being attached to the wrong category. Its saved name remains visible and a fallback icon is shown. Open that transaction, choose the right category, and save it to link it explicitly.

No localStorage keys were intentionally changed.

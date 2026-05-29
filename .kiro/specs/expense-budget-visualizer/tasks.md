# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side single-page expense tracker using plain HTML, CSS, and vanilla JavaScript. The app persists data in `localStorage`, renders a pie chart via Chart.js CDN, and follows a simple MVC pattern inside a single `js/app.js` file.

## Tasks

- [x] 1. Set up project file structure and HTML skeleton
  - [x] 1.1 Create project files and HTML structure
    - Create `index.html` at the project root with the full HTML structure: header with balance display, transaction form section, budget limits section, sort control, transaction list section, chart section, monthly summary section, view toggle button, and global error banner
    - Add Chart.js CDN `<script>` tag to `index.html`; no other external libraries
    - Create `css/style.css` as an empty file (styles added in task 8)
    - Create `js/app.js` as an empty module with section comment stubs: Constants, State, Storage, Validation, Calculations, Sorter, Renderer, Controller, Init
    - _Requirements: 1.1, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 2. Implement Constants, State, and Storage module
  - [x] 2.1 Define constants and initial state
    - Define `CATEGORIES`, `STORAGE_KEYS` (`evb_transactions`, `evb_budgets`, `evb_sort_pref`), and validation limit constants in the Constants section
    - Define the `state` object with `transactions`, `budgets`, `sortPref`, `summaryVisible`, `storageAvailable`, and `_lastDeletedMonthEntry` fields
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 2.2 Implement Storage module functions
    - Implement `loadState()`: reads each `localStorage` key independently; handles `JSON.parse` errors per key (delete corrupted key, show warning banner, start with empty state for that key); sets `state.storageAvailable = false` and shows persistent banner if `localStorage` is unavailable
    - Implement `saveTransactions()`, `saveBudgets()`, `saveSortPref()`: each wraps `localStorage.setItem` in try/catch and handles `QuotaExceededError` with appropriate inline error messages per the error handling spec
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 2.3 Write property test for persistence round-trip
    - **Property 9: Persistence round-trip**
    - Generate arbitrary state objects (transactions, budgets, sortPref), serialize via Storage module, deserialize, and assert deep equality with no data loss or type coercion
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 3. Implement Validation module
  - [x] 3.1 Implement `validateTransaction(name, amountStr, category)`
    - Validate `name`: non-empty after trim, max 100 chars
    - Validate `amount`: parses as finite number, > 0, ≤ 999,999,999.99, ≤ 2 decimal places (regex `/^\d+(\.\d{1,2})?$/`)
    - Validate `category`: must be one of `['Food', 'Transport', 'Fun']`
    - Return `{ valid: boolean, errors: string[] }`
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Implement `validateBudgetLimit(valueStr)`
    - Empty string → `{ valid: true, error: null, value: null }` (treated as no limit)
    - Must parse as finite number, > 0, ≤ 9,999,999.99; reject negative or non-numeric
    - Return `{ valid: boolean, error: string|null, value: number|null }`
    - _Requirements: 5.1, 5.5, 5.6_

  - [ ]* 3.3 Write property test for invalid amount rejection
    - **Property 3: Invalid amount is always rejected**
    - Generate zero, negative, non-numeric, > 999,999,999.99, and > 2 decimal place values; assert `validateTransaction` rejects all and transaction count in localStorage remains unchanged
    - **Validates: Requirements 1.4**

  - [ ]* 3.4 Write property test for empty/whitespace field rejection
    - **Property 4: Whitespace-only or empty fields are always rejected**
    - Generate combinations with at least one empty/whitespace field; assert `validateTransaction` rejects all and transaction count in localStorage remains unchanged
    - **Validates: Requirements 1.3**

  - [ ]* 3.5 Write property test for invalid budget limit rejection
    - **Property 10: Invalid budget limit is always rejected**
    - Generate negative, non-numeric, and > 9,999,999.99 values; assert `validateBudgetLimit` rejects all and the previous valid budget limit value remains unchanged
    - **Validates: Requirements 5.6**

- [ ] 4. Implement Calculations and Sorter modules
  - [x] 4.1 Implement `calcBalance(transactions)`
    - Return `transactions.reduce((sum, t) => sum + t.amount, 0)`, formatted to 2 decimal places for display
    - Return `0.00` when transactions array is empty
    - _Requirements: 3.1, 3.4_

  - [x] 4.2 Implement `calcCategoryTotals(transactions)`
    - Sum amounts per category; missing categories default to 0
    - Return `{ Food: number, Transport: number, Fun: number }`
    - _Requirements: 4.1, 5.2_

  - [x] 4.3 Implement `calcMonthlySummary(transactions)`
    - Group by `dateAdded.slice(0, 7)` (YYYY-MM); sum totals and per-category amounts per month
    - Return `Array<MonthlySummaryEntry>` sorted descending by month string
    - Omit months with no transactions
    - _Requirements: 7.1, 7.2, 7.5, 7.7, 7.8_

  - [ ] 4.4 Implement `sortTransactions(transactions, sortPref)`
    - Support `amount-asc` (primary: amount ascending, secondary: dateAdded descending), `amount-desc` (primary: amount descending, secondary: dateAdded descending), `category-az` (primary: category A–Z, secondary: dateAdded descending)
    - Return a new sorted array (do not mutate input)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 4.5 Implement `isCategoryOverBudget(category, totals, budgets)` and `buildChartData(transactions)`
    - `isCategoryOverBudget`: return `false` if `budgets[category]` is `null` or `0`; otherwise return `totals[category] >= budgets[category]`
    - `buildChartData`: filter to categories with total > 0; return `{ labels, data, colors }` or `null` when no transactions exist
    - _Requirements: 4.1, 4.4, 5.2, 5.3, 5.5_

  - [ ]* 4.6 Write property test for balance sum
    - **Property 1: Balance equals sum of all transaction amounts**
    - Generate random transaction arrays; assert `calcBalance()` equals `array.reduce((s, t) => s + t.amount, 0)` formatted to 2 decimal places
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 4.7 Write property test for chart non-zero categories only
    - **Property 5: Chart data contains only non-zero categories**
    - Generate transaction arrays; assert `buildChartData()` excludes categories with zero total and returns `null` when no transactions exist
    - **Validates: Requirements 4.1, 4.4**

  - [ ]* 4.8 Write property test for budget warning state
    - **Property 6: Budget warning state matches spending vs. limit**
    - Generate spending totals and budget limits > 0; assert `isCategoryOverBudget()` is true iff spending >= limit; assert false when limit is 0 or null
    - **Validates: Requirements 5.2, 5.3, 5.5**

  - [ ]* 4.9 Write property test for sort order invariant
    - **Property 7: Sort order invariant**
    - Generate transaction arrays (minLength: 2) and all three sort prefs; assert every adjacent pair satisfies the sort criterion; assert equal-primary-key pairs are ordered by `dateAdded` descending
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**

  - [ ]* 4.10 Write property test for monthly summary grouping
    - **Property 8: Monthly summary grouping correctness**
    - Generate transactions with varied dates; assert `calcMonthlySummary()` groups by YYYY-MM, month totals match sum of transaction amounts, per-category totals match, months are in descending order
    - **Validates: Requirements 7.1, 7.2, 7.7, 7.8**

- [ ] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Renderer module
  - [ ] 6.1 Implement `renderBalance()`
    - Update `#balance-display` text with formatted balance from `calcBalance(state.transactions)`
    - Display `0.00` when no transactions are stored
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 6.2 Implement `renderTransactionList()`
    - Sort transactions via `sortTransactions(state.transactions, state.sortPref)` before rendering
    - Render each transaction as a `<li>` in `#transaction-list` showing item name, amount (2 decimal places), category, and date added
    - Attach a delete button to each list item
    - Apply budget warning CSS class to items whose category is over budget (using `isCategoryOverBudget`)
    - Show `#empty-state` paragraph when list is empty or all items are filtered out; hide it otherwise
    - _Requirements: 2.1, 2.2, 2.4, 5.2, 5.3_

  - [x] 6.3 Implement `renderChart()`
    - Use `buildChartData()` to get chart data; if `null`, hide `<canvas>` and show `#chart-empty-state` with "No data to display"
    - Otherwise show `<canvas>`, destroy previous Chart.js instance if one exists, create new `Chart` with type `'pie'`, labels, data, and colors; each segment labeled with category name and percentage
    - Wrap Chart constructor in try/catch; on failure hide canvas and show "Chart unavailable — please check your internet connection."
    - Apply budget warning styling to chart segments for over-budget categories
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3_

  - [x] 6.4 Implement `renderBudgetWarnings()`
    - Compute category totals via `calcCategoryTotals(state.transactions)` and compare to `state.budgets`
    - Update warning indicator visibility in `#budget-limits` section for each category
    - _Requirements: 5.2, 5.3, 5.5, 5.7_

  - [x] 6.5 Implement `renderMonthlySummary()`
    - If `state.summaryVisible` is false, keep `#monthly-summary` hidden and return early
    - Otherwise compute `calcMonthlySummary(state.transactions)`, merge with `state._lastDeletedMonthEntry` if set (to retain month with zero totals per requirement 7.6), render into `#monthly-summary-content`, show section
    - Display per-category breakdown (Food, Transport, Fun totals) for each month
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 6.6 Implement `renderAll()`
    - Call `renderBalance()`, `renderTransactionList()`, `renderChart()`, `renderBudgetWarnings()`, `renderMonthlySummary()` in sequence
    - _Requirements: 3.1, 4.1, 5.2, 7.1_

- [ ] 7. Implement Controller and Init
  - [x] 7.1 Implement transaction form submit handler
    - On `#transaction-form` submit: call `validateTransaction()`; on failure render errors into `#form-errors`; on success create transaction object with `crypto.randomUUID()` (or `Date.now().toString()`) and ISO `dateAdded`, prepend to `state.transactions`, call `saveTransactions()` (on failure: show inline error, do not update state or list), clear Item Name and Amount fields and reset Category to "Food", call `renderAll()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 7.2 Implement delete transaction handler (event delegation on `#transaction-list`)
    - On delete button click: remove transaction from `state.transactions` by id, update `state._lastDeletedMonthEntry` if summary is visible (to retain month with zero totals), call `saveTransactions()` (on failure: show inline error, do not remove from state or list), call `renderAll()`
    - _Requirements: 2.3, 2.5, 7.6_

  - [x] 7.3 Implement budget limit change handlers
    - On `input` event for each `.budget-row input`: call `validateBudgetLimit()`; on failure show error in `.budget-error` span and leave previous valid limit unchanged; on success update `state.budgets[category]`, call `saveBudgets()`, call `renderAll()`
    - _Requirements: 5.1, 5.4, 5.6, 5.7_

  - [x] 7.4 Implement sort preference change handler
    - On `#sort-select` change: update `state.sortPref`, call `saveSortPref()` (on failure: show dismissible toast, continue using selected sort for current session), call `renderAll()`
    - _Requirements: 6.1, 6.2, 6.6, 6.7_

  - [x] 7.5 Implement monthly summary toggle handler
    - On `#toggle-summary` click: toggle `state.summaryVisible`, update button text ("View Monthly Summary" / "Hide Monthly Summary"), call `renderMonthlySummary()`
    - _Requirements: 7.3, 7.4_

  - [ ] 7.6 Implement `init()` and wire up on `DOMContentLoaded`
    - Call `loadState()` to populate `state` from `localStorage` (handles unavailability and corrupted JSON per error handling spec)
    - Restore sort select value from `state.sortPref`
    - Restore budget input values from `state.budgets`
    - Attach all event listeners: form submit, delete delegation on `#transaction-list`, budget inputs, sort select change, toggle button click
    - Call `renderAll()` to draw initial UI from restored state
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ]* 7.7 Write property test for valid transaction add round-trip
    - **Property 2: Valid transaction addition round-trip**
    - Generate valid transactions (non-empty name ≤ 100 chars, valid amount, valid category), add via controller logic, assert transaction is retrievable from `localStorage` with all fields intact and appears as the first item in the transaction list
    - **Validates: Requirements 1.2, 8.1**

- [ ] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Apply CSS styling
  - [x] 9.1 Style layout, header, and balance display
    - Style the page layout, header, and `#balance-display` to show balance prominently at the top
    - _Requirements: 3.1, 10.5_

  - [x] 9.2 Style form, budget rows, sort control, and error states
    - Style the transaction form, budget limit rows (including warning indicator — visually distinct highlighted background or warning icon for over-budget categories), sort control, inline error messages, and global error banner
    - Ensure no inline `style=""` attributes are used in `index.html` (except those injected by Chart.js)
    - _Requirements: 1.1, 5.2, 5.3, 10.5_

  - [x] 9.3 Style transaction list, chart section, and monthly summary
    - Style `#transaction-list` to be scrollable when items overflow the visible area
    - Style transaction list items including the budget warning state (visually distinct from default)
    - Style the chart section, empty states (`#empty-state`, `#chart-empty-state`), and monthly summary view
    - _Requirements: 2.2, 4.5, 5.2, 7.1, 10.5_

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) loaded via CDN or npm in the test environment only
- Unit tests cover specific scenarios: empty state display, form reset after add, localStorage unavailability, corrupted JSON handling, delete failure, Chart.js CDN failure, budget limit empty/zero = no warning, monthly summary last-item retention
- The app must run by opening `index.html` directly — no build step or server required

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "3.2"] },
    { "id": 3, "tasks": ["2.3", "3.3", "3.4", "3.5", "4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 4, "tasks": ["4.6", "4.7", "4.8", "4.9", "4.10", "6.1", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 5, "tasks": ["6.6", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 6, "tasks": ["7.6"] },
    { "id": 7, "tasks": ["7.7", "9.1", "9.2", "9.3"] }
  ]
}
```

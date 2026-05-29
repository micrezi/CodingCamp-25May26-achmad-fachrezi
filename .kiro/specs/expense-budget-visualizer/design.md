# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page web application. It runs directly from the filesystem — no server, no build step, no package manager. All application state is persisted in the browser's `localStorage`. The UI is built with plain HTML, CSS, and vanilla JavaScript; Chart.js is loaded via CDN for the pie chart.

The application lets users:
- Record expense transactions (name, amount, category)
- View a running total balance
- Visualize spending by category in a pie chart
- Set per-category budget limits with visual overspending warnings
- Sort the transaction list by amount or category
- Review a monthly summary of spending

### Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Markup | HTML5 | Single file at root, no templating needed |
| Styling | CSS3 (one file in `css/`) | Constraint from requirements |
| Logic | Vanilla JS ES6+ (one file in `js/`) | Constraint from requirements |
| Charts | Chart.js via CDN | Lightweight, well-documented, constraint from requirements |
| Persistence | `localStorage` | Client-side only, no backend |

---

## Architecture

The application follows a simple **Model → View → Controller** pattern implemented without any framework. All code lives in a single JS file (`js/app.js`), organized into clearly separated logical sections.

```
index.html          ← single HTML entry point, loads CSS and JS
css/
  style.css         ← all styles
js/
  app.js            ← all application logic
```

### Data Flow

```
User Interaction
      │
      ▼
  Controller (event handlers in app.js)
      │
      ├──► Storage Module  ──► localStorage
      │
      ├──► State Module    ──► in-memory state (transactions[], budgets{}, sortPref)
      │
      └──► Render Module   ──► DOM updates + Chart.js instance
```

On page load, the Storage Module reads from `localStorage` into the State Module, then the Render Module draws the initial UI. Every user action goes through a Controller function that updates State, persists to Storage, and triggers a Render.

### Module Boundaries (within `app.js`)

The JS file is organized into clearly commented sections:

1. **Constants** — category list, localStorage keys, validation limits
2. **State** — the single in-memory state object
3. **Storage** — `loadState()`, `saveTransactions()`, `saveBudgets()`, `saveSortPref()`
4. **Validation** — `validateTransaction()`, `validateBudgetLimit()`
5. **Calculations** — `calcBalance()`, `calcCategoryTotals()`, `calcMonthlySummary()`
6. **Sorter** — `sortTransactions()`
7. **Renderer** — `renderAll()`, `renderTransactionList()`, `renderBalance()`, `renderChart()`, `renderBudgetWarnings()`, `renderMonthlySummary()`
8. **Controller** — event handlers wired up in `init()`
9. **Init** — `init()` called on `DOMContentLoaded`

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display">Total: $0.00</div>
  </header>

  <main>
    <!-- Add Transaction Form -->
    <section id="add-transaction">
      <form id="transaction-form">
        <input id="item-name" type="text" maxlength="100" />
        <input id="amount" type="number" step="0.01" />
        <select id="category">
          <option value="Food">Food</option>
          <option value="Transport">Transport</option>
          <option value="Fun">Fun</option>
        </select>
        <button type="submit">Add</button>
      </form>
      <div id="form-errors" aria-live="polite"></div>
    </section>

    <!-- Budget Limits -->
    <section id="budget-limits">
      <div class="budget-row" data-category="Food">
        <label>Food limit: <input type="number" step="0.01" /></label>
        <span class="budget-error" aria-live="polite"></span>
      </div>
      <!-- Transport, Fun rows same pattern -->
    </section>

    <!-- Sort Control -->
    <section id="sort-control">
      <label for="sort-select">Sort by:</label>
      <select id="sort-select">
        <option value="amount-asc">Amount (Low → High)</option>
        <option value="amount-desc">Amount (High → Low)</option>
        <option value="category-az">Category (A–Z)</option>
      </select>
    </section>

    <!-- Transaction List -->
    <section id="transaction-list-section">
      <ul id="transaction-list"></ul>
      <p id="empty-state" hidden>No expenses currently shown.</p>
    </section>

    <!-- Chart -->
    <section id="chart-section">
      <canvas id="spending-chart"></canvas>
      <p id="chart-empty-state" hidden>No data to display.</p>
    </section>

    <!-- Monthly Summary (toggled view) -->
    <section id="monthly-summary" hidden>
      <div id="monthly-summary-content"></div>
    </section>

    <!-- View Toggle -->
    <button id="toggle-summary">View Monthly Summary</button>
  </main>

  <div id="global-error" aria-live="assertive" hidden></div>
</body>
```

### State Object

```javascript
const state = {
  transactions: [],   // Array<Transaction>
  budgets: {},        // { Food: number|null, Transport: number|null, Fun: number|null }
  sortPref: 'amount-asc',  // string
  summaryVisible: false,   // boolean
  // transient: last deleted month entry (for req 7.6)
  _lastDeletedMonthEntry: null
};
```

### Transaction Object

```javascript
{
  id: string,          // crypto.randomUUID() or Date.now().toString()
  name: string,        // item name, max 100 chars
  amount: number,      // positive float, max 2 decimal places
  category: string,    // 'Food' | 'Transport' | 'Fun'
  dateAdded: string    // ISO 8601 string, e.g. "2025-05-26T10:30:00.000Z"
}
```

### localStorage Keys

```javascript
const STORAGE_KEYS = {
  TRANSACTIONS: 'evb_transactions',
  BUDGETS:      'evb_budgets',
  SORT_PREF:    'evb_sort_pref'
};
```

---

## Data Models

### Validation Rules

**Transaction validation** (`validateTransaction(name, amountStr, category)`):
- `name`: non-empty after trim, max 100 characters
- `amount`: must parse as a finite number; must be > 0; must be ≤ 999,999,999.99; must have at most 2 decimal places (checked via regex `/^\d+(\.\d{1,2})?$/` after trimming)
- `category`: must be one of `['Food', 'Transport', 'Fun']`
- Returns `{ valid: boolean, errors: string[] }`

**Budget limit validation** (`validateBudgetLimit(valueStr)`):
- Empty string → valid, treated as "no limit" (null)
- Must parse as a finite number
- Must be > 0
- Must be ≤ 9,999,999.99
- Must not be negative or non-numeric
- Returns `{ valid: boolean, error: string|null, value: number|null }`

### Calculation Functions

**`calcBalance(transactions)`** → `number`
- Returns `transactions.reduce((sum, t) => sum + t.amount, 0)`
- Formatted to 2 decimal places for display

**`calcCategoryTotals(transactions)`** → `{ Food: number, Transport: number, Fun: number }`
- Sums amounts per category; missing categories default to 0

**`calcMonthlySummary(transactions)`** → `Array<MonthlySummaryEntry>`
```javascript
// MonthlySummaryEntry
{
  month: string,       // 'YYYY-MM'
  total: number,
  categories: { Food: number, Transport: number, Fun: number }
}
```
- Groups by `dateAdded.slice(0, 7)` (YYYY-MM)
- Sorted descending by month string

### Sort Logic

**`sortTransactions(transactions, sortPref)`** → `Transaction[]`

| `sortPref` | Primary key | Secondary key |
|---|---|---|
| `'amount-asc'` | `amount` ascending | `dateAdded` descending |
| `'amount-desc'` | `amount` descending | `dateAdded` descending |
| `'category-az'` | `category` A–Z | `dateAdded` descending |

Returns a new sorted array (does not mutate input).

### Budget Warning Logic

**`isCategoryOverBudget(category, totals, budgets)`** → `boolean`
- Returns `false` if `budgets[category]` is `null` or `0`
- Returns `totals[category] >= budgets[category]` otherwise

### Chart Data Preparation

**`buildChartData(transactions)`** → `{ labels: string[], data: number[], colors: string[] }`
- Filters to only categories with total > 0
- Returns parallel arrays for Chart.js `data.labels`, `data.datasets[0].data`, and `data.datasets[0].backgroundColor`
- Returns `null` when no transactions exist (triggers empty-state display)

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

#### Reflection: Eliminating Redundancy

Before listing properties, redundancies were eliminated:
- Requirements 3.2 and 3.3 (balance updates on add/delete) are subsumed by Property 1 (balance always equals sum of all transactions).
- Requirements 4.2 and 4.3 (chart updates on add/delete) are subsumed by Property 4 (chart data only includes non-zero categories).
- Requirements 5.2 and 5.3 (warning on/off) are combined into Property 5 (warning state ↔ spending >= limit).
- Requirements 7.3, 7.4, 7.8 are subsumed by Property 7 (monthly summary grouping correctness).
- Requirements 8.1–8.3 are subsumed by Property 8 (persistence round-trip).

---

### Property 1: Balance equals sum of all transaction amounts

*For any* list of transactions, the displayed balance SHALL equal the arithmetic sum of all transaction amounts, formatted to exactly two decimal places.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### Property 2: Valid transaction addition round-trip

*For any* valid transaction (non-empty name ≤ 100 chars, amount in (0, 999999999.99) with ≤ 2 decimal places, valid category), after adding it the transaction SHALL be retrievable from `localStorage` with all fields intact, and it SHALL appear as the first item in the transaction list when sorted by newest-first.

**Validates: Requirements 1.2, 8.1**

---

### Property 3: Invalid amount is always rejected

*For any* amount value that is zero, negative, non-numeric, greater than 999,999,999.99, or has more than 2 decimal places, the validator SHALL reject it and the transaction count in `localStorage` SHALL remain unchanged.

**Validates: Requirements 1.4**

---

### Property 4: Whitespace-only or empty fields are always rejected

*For any* combination of form field values where at least one field (name, amount, or category) is empty or whitespace-only, the validator SHALL reject the submission and the transaction count in `localStorage` SHALL remain unchanged.

**Validates: Requirements 1.3**

---

### Property 5: Chart data contains only non-zero categories

*For any* set of transactions, the chart data preparation function SHALL return labels and data values only for categories whose total spending is strictly greater than zero; categories with zero spending SHALL be excluded entirely.

**Validates: Requirements 4.1, 4.4**

---

### Property 6: Budget warning state matches spending vs. limit

*For any* category, spending total, and budget limit value greater than zero, the warning indicator SHALL be active if and only if the category's total spending is greater than or equal to the budget limit; when the budget limit is zero or null, no warning SHALL be shown regardless of spending.

**Validates: Requirements 5.2, 5.3, 5.5**

---

### Property 7: Sort order invariant

*For any* list of transactions and any valid sort preference (`amount-asc`, `amount-desc`, `category-az`), the sorted result SHALL satisfy the sort criterion for every adjacent pair of transactions; when two transactions have equal primary sort values, the one with the more recent `dateAdded` SHALL appear first.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

---

### Property 8: Monthly summary grouping correctness

*For any* set of transactions, the monthly summary SHALL group transactions by their `dateAdded` calendar month (YYYY-MM), the total for each month SHALL equal the sum of all transaction amounts in that month, the per-category totals SHALL equal the sum of amounts for that category in that month, and months SHALL be ordered in descending chronological order.

**Validates: Requirements 7.1, 7.2, 7.7, 7.8**

---

### Property 9: Persistence round-trip

*For any* application state (transactions, budget limits, sort preference), writing the state to `localStorage` and then reading it back SHALL produce an equivalent state with no data loss or type coercion.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

---

### Property 10: Invalid budget limit is always rejected

*For any* budget limit input value that is negative, non-numeric, or greater than 9,999,999.99, the validator SHALL reject it, the previous valid budget limit value SHALL remain unchanged, and no warning state recalculation SHALL occur.

**Validates: Requirements 5.6**

---

## Error Handling

### localStorage Unavailability

On `init()`, the app wraps the initial `localStorage` read in a try/catch. If `localStorage` throws (e.g., in a sandboxed iframe or private browsing with storage disabled), the app:
1. Sets a flag `state.storageAvailable = false`
2. Displays a persistent banner: "Data persistence is not available. Your data will be lost when you close this tab."
3. Continues operating entirely in-memory

All subsequent Storage module calls check `state.storageAvailable` before attempting `localStorage` access.

### Corrupted JSON in localStorage

If `JSON.parse()` throws when reading any storage key:
1. The corrupted key is deleted from `localStorage`
2. A warning banner is shown: "Saved data could not be loaded and has been cleared."
3. The app starts with an empty state for that data type

Each key (`transactions`, `budgets`, `sortPref`) is parsed independently so corruption in one does not affect the others.

### localStorage Write Failures

`localStorage.setItem()` can throw a `QuotaExceededError`. All write calls are wrapped in try/catch:
- On transaction add failure: show inline error "Transaction could not be saved. Storage may be full.", do not update the transaction list or state.
- On transaction delete failure: show inline error "Transaction could not be deleted.", do not remove from list or state.
- On sort preference save failure: show a dismissible toast "Sort preference could not be saved.", continue using the selected sort for the current session.

### Form Validation Errors

Inline errors are rendered into `#form-errors` (for transaction form) and `.budget-error` spans (for budget inputs). Errors are cleared on the next valid submission or when the user modifies the relevant field. The `aria-live="polite"` attribute ensures screen readers announce errors.

### Chart Rendering Errors

If Chart.js fails to initialize (e.g., CDN unavailable), the `<canvas>` is hidden and a fallback message "Chart unavailable — please check your internet connection." is shown in `#chart-section`.

---

## Testing Strategy

### Dual Testing Approach

The testing strategy combines **unit/example-based tests** for specific scenarios and **property-based tests** for universal correctness guarantees.

### Property-Based Testing

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (JavaScript PBT library, loaded via CDN or npm for test environment only)

Each correctness property from the design document is implemented as a property-based test with a minimum of **100 iterations**.

Tag format for each test: `// Feature: expense-budget-visualizer, Property N: <property text>`

| Property | Test Description | Arbitraries Used |
|---|---|---|
| P1: Balance sum | Generate random transaction arrays, verify `calcBalance()` equals `array.reduce(sum)` | `fc.array(fc.record({ amount: fc.float({ min: 0.01, max: 999999999.99 }) }))` |
| P2: Add round-trip | Generate valid transactions, add to state, verify in localStorage and at top of list | `fc.record({ name: fc.string({ minLength: 1, maxLength: 100 }), amount: validAmountArb, category: categoryArb })` |
| P3: Invalid amount rejection | Generate invalid amounts, verify validator rejects all | `fc.oneof(fc.constant(0), fc.float({ max: 0 }), fc.string(), fc.float({ min: 1000000000 }))` |
| P4: Empty field rejection | Generate combinations with at least one empty field, verify rejection | `fc.tuple(fc.option(fc.string()), fc.option(validAmountArb), fc.option(categoryArb))` filtered to have at least one null |
| P5: Chart non-zero only | Generate transaction arrays, verify `buildChartData()` excludes zero-total categories | `fc.array(transactionArb)` |
| P6: Budget warning state | Generate spending totals and budget limits, verify `isCategoryOverBudget()` matches `spending >= limit` | `fc.tuple(fc.float({ min: 0 }), fc.float({ min: 0.01 }))` |
| P7: Sort invariant | Generate transaction arrays, verify `sortTransactions()` produces correctly ordered output for all three sort prefs | `fc.array(transactionArb, { minLength: 2 })` × `fc.constantFrom('amount-asc', 'amount-desc', 'category-az')` |
| P8: Monthly summary | Generate transactions with varied dates, verify `calcMonthlySummary()` grouping and totals | `fc.array(transactionWithDateArb)` |
| P9: Persistence round-trip | Generate state objects, serialize/deserialize via Storage module, verify equality | `fc.record({ transactions: fc.array(transactionArb), budgets: budgetArb, sortPref: sortPrefArb })` |
| P10: Invalid budget rejection | Generate invalid budget values, verify `validateBudgetLimit()` rejects all | `fc.oneof(fc.float({ max: 0 }), fc.string().filter(s => isNaN(Number(s))), fc.float({ min: 10000000 }))` |

### Unit / Example-Based Tests

These cover specific scenarios not well-suited to property generation:

- **Empty state display**: verify `#empty-state` and `#chart-empty-state` are shown when transaction list is empty
- **Form reset after add**: verify name, amount fields are cleared and category resets to "Food" after successful add
- **localStorage unavailability**: mock `localStorage` to throw, verify warning banner appears and app works in-memory
- **Corrupted JSON handling**: put `"not-json"` in each localStorage key, verify warning shown and empty state loaded
- **Delete failure handling**: mock `localStorage.removeItem` to throw, verify error shown and item remains in list
- **Monthly summary last-item retention**: delete last transaction in a month while summary is visible, verify month still shows with zero totals
- **Chart.js CDN failure**: mock Chart constructor to throw, verify fallback message shown
- **Budget limit empty/zero = no warning**: set budget to empty or 0, add spending, verify no warning shown

### Integration / Smoke Tests

- **File structure check**: verify `index.html` at root, `css/style.css`, `js/app.js` exist and no other HTML/CSS/JS files are present
- **No inline styles**: verify no `style=""` attributes in `index.html` (except those injected by Chart.js canvas)
- **CDN script tag**: verify `index.html` contains a `<script src="...chart.js...">` tag pointing to a CDN
- **No framework imports**: verify `js/app.js` contains no `import` statements referencing npm packages
- **Open-file launch**: open `index.html` directly in a browser (no server), verify app loads and renders without console errors

### Performance Targets (manual verification)

- Initial render with 500 stored transactions: < 1 second
- Add/delete operation (list + balance + chart update): < 200ms
- Sort operation on 500 transactions: < 100ms

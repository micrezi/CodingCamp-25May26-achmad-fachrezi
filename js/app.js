// ============================================================
// Constants
// ============================================================

const CATEGORIES = ['Food', 'Transport', 'Fun'];

const STORAGE_KEYS = {
  TRANSACTIONS: 'evb_transactions',
  BUDGETS:      'evb_budgets',
  SORT_PREF:    'evb_sort_pref'
};

const MAX_AMOUNT       = 999_999_999.99;
const MAX_BUDGET_LIMIT = 9_999_999.99;
const MAX_NAME_LENGTH  = 100;

// ============================================================
// State
// ============================================================

const state = {
  transactions:          [],
  budgets:               { Food: null, Transport: null, Fun: null },
  sortPref:              'amount-asc',
  summaryVisible:        false,
  storageAvailable:      true,
  _lastDeletedMonthEntry: null
};

// ============================================================
// Storage
// ============================================================

/**
 * Shows a persistent banner in #global-error.
 * @param {string} message
 */
function showPersistentBanner(message) {
  const el = document.getElementById('global-error');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

/**
 * Shows a dismissible toast notification.
 * Creates a temporary element appended to <body> that auto-removes after 5 s.
 * @param {string} message
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const text = document.createElement('span');
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.addEventListener('click', () => toast.remove());

  toast.appendChild(text);
  toast.appendChild(closeBtn);
  document.body.appendChild(toast);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 5000);
}

/**
 * Loads application state from localStorage into the `state` object.
 * Each key is read independently so corruption in one does not affect others.
 * If localStorage is entirely unavailable, sets state.storageAvailable = false
 * and shows a persistent warning banner.
 *
 * Satisfies: Requirements 8.4, 8.5, 8.6
 */
function loadState() {
  // Check if localStorage is available at all
  try {
    localStorage.setItem('__evb_test__', '1');
    localStorage.removeItem('__evb_test__');
  } catch (_e) {
    state.storageAvailable = false;
    showPersistentBanner(
      'Data persistence is not available. Your data will be lost when you close this tab.'
    );
    return;
  }

  // Read transactions independently
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (raw !== null) {
      state.transactions = JSON.parse(raw);
    }
  } catch (_e) {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    showPersistentBanner('Saved data could not be loaded and has been cleared.');
    state.transactions = [];
  }

  // Read budgets independently
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    if (raw !== null) {
      state.budgets = JSON.parse(raw);
    }
  } catch (_e) {
    localStorage.removeItem(STORAGE_KEYS.BUDGETS);
    showPersistentBanner('Saved data could not be loaded and has been cleared.');
    state.budgets = { Food: null, Transport: null, Fun: null };
  }

  // Read sort preference independently
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SORT_PREF);
    if (raw !== null) {
      state.sortPref = JSON.parse(raw);
    }
  } catch (_e) {
    localStorage.removeItem(STORAGE_KEYS.SORT_PREF);
    showPersistentBanner('Saved data could not be loaded and has been cleared.');
    state.sortPref = 'amount-asc';
  }
}

/**
 * Persists the current transactions array to localStorage.
 * On QuotaExceededError, shows an inline error in #form-errors.
 * The caller is responsible for NOT updating state/UI when this returns false.
 *
 * @returns {boolean} true if save succeeded, false otherwise
 * Satisfies: Requirements 8.1, 1.6
 */
function saveTransactions() {
  if (!state.storageAvailable) return false;
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
    return true;
  } catch (e) {
    const msg = (e.name === 'QuotaExceededError' || e.code === 22)
      ? 'Transaction could not be saved. Storage may be full.'
      : 'Transaction could not be saved.';
    const errEl = document.getElementById('form-errors');
    if (errEl) errEl.textContent = msg;
    return false;
  }
}

/**
 * Persists the current budgets object to localStorage.
 * On QuotaExceededError, shows an inline error in #form-errors.
 *
 * @returns {boolean} true if save succeeded, false otherwise
 * Satisfies: Requirements 8.2
 */
function saveBudgets() {
  if (!state.storageAvailable) return false;
  try {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(state.budgets));
    return true;
  } catch (e) {
    const msg = (e.name === 'QuotaExceededError' || e.code === 22)
      ? 'Budget limit could not be saved. Storage may be full.'
      : 'Budget limit could not be saved.';
    const errEl = document.getElementById('form-errors');
    if (errEl) errEl.textContent = msg;
    return false;
  }
}

/**
 * Persists the current sort preference to localStorage.
 * On failure, shows a dismissible toast and continues using the preference in-memory.
 *
 * @returns {boolean} true if save succeeded, false otherwise
 * Satisfies: Requirements 8.3, 6.7
 */
function saveSortPref() {
  if (!state.storageAvailable) return false;
  try {
    localStorage.setItem(STORAGE_KEYS.SORT_PREF, JSON.stringify(state.sortPref));
    return true;
  } catch (_e) {
    showToast('Sort preference could not be saved.');
    return false;
  }
}

// ============================================================
// Validation
// ============================================================

/**
 * Validates the fields for a new transaction.
 *
 * Rules:
 *  - name: non-empty after trim, max MAX_NAME_LENGTH (100) characters
 *  - amountStr: trimmed string must match /^\d+(\.\d{1,2})?$/, parsed value
 *               must be > 0 and ≤ MAX_AMOUNT (999,999,999.99)
 *  - category: must be one of CATEGORIES (['Food', 'Transport', 'Fun'])
 *
 * All errors are collected before returning so the caller receives the full
 * list of problems in a single call.
 *
 * @param {string} name       - Item name from the form field
 * @param {string} amountStr  - Raw amount string from the form field
 * @param {string} category   - Selected category value
 * @returns {{ valid: boolean, errors: string[] }}
 *
 * Satisfies: Requirements 1.3, 1.4
 */
function validateTransaction(name, amountStr, category) {
  const errors = [];

  // --- Name validation ---
  const trimmedName = (name ?? '').trim();
  if (trimmedName.length === 0) {
    errors.push('Item name is required.');
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.push(`Item name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  // --- Amount validation ---
  const trimmedAmount = (amountStr ?? '').trim();
  const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
  if (trimmedAmount.length === 0) {
    errors.push('Amount is required.');
  } else if (!AMOUNT_REGEX.test(trimmedAmount)) {
    errors.push('Amount must be a positive number with up to 2 decimal places.');
  } else {
    const parsed = parseFloat(trimmedAmount);
    if (!isFinite(parsed) || parsed <= 0) {
      errors.push('Amount must be greater than 0.');
    } else if (parsed > MAX_AMOUNT) {
      errors.push(`Amount must be ${MAX_AMOUNT.toLocaleString()} or less.`);
    }
  }

  // --- Category validation ---
  if (!CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a budget limit input value.
 *
 * Rules:
 *  - Empty string (after trim) → valid, treated as "no limit" (value: null)
 *  - Must parse as a finite number
 *  - Must be > 0 (zero and negative values are rejected)
 *  - Must be ≤ MAX_BUDGET_LIMIT (9,999,999.99)
 *
 * @param {string} valueStr - Raw budget limit string from the input field
 * @returns {{ valid: boolean, error: string|null, value: number|null }}
 *
 * Satisfies: Requirements 5.1, 5.5, 5.6
 */
function validateBudgetLimit(valueStr) {
  const trimmed = (valueStr ?? '').trim();

  // Empty string → no limit (treated as valid)
  if (trimmed === '') {
    return { valid: true, error: null, value: null };
  }

  const parsed = Number(trimmed);

  // Non-numeric or not finite
  if (isNaN(parsed) || !isFinite(parsed)) {
    return { valid: false, error: 'Budget limit must be a positive number.', value: null };
  }

  // Zero or negative
  if (parsed <= 0) {
    return { valid: false, error: 'Budget limit must be greater than 0.', value: null };
  }

  // Exceeds maximum allowed value
  if (parsed > MAX_BUDGET_LIMIT) {
    return { valid: false, error: 'Budget limit must be 9,999,999.99 or less.', value: null };
  }

  return { valid: true, error: null, value: parsed };
}

// ============================================================
// Calculations
// ============================================================

/**
 * Calculates the total balance from all transactions.
 *
 * Sums the `amount` field of every transaction using reduce.
 * Returns 0 when the transactions array is empty (reduce returns the
 * initial accumulator value of 0 with no iterations).
 *
 * The raw numeric result is returned so callers can use it for further
 * arithmetic. For display purposes, format the result with toFixed(2).
 *
 * @param {Array<{amount: number}>} transactions - Array of transaction objects
 * @returns {number} The sum of all transaction amounts, rounded to 2 decimal places
 *
 * Satisfies: Requirements 3.1, 3.4
 */
function calcBalance(transactions) {
  const raw = transactions.reduce((sum, t) => sum + t.amount, 0);
  // Round to 2 decimal places to avoid floating-point drift, then return as number
  return parseFloat(raw.toFixed(2));
}

/**
 * Calculates the total spending per category from all transactions.
 *
 * Initializes all three categories (Food, Transport, Fun) to 0, then
 * iterates over every transaction and accumulates its amount into the
 * matching category bucket. Categories with no transactions remain at 0.
 *
 * @param {Array<{amount: number, category: string}>} transactions - Array of transaction objects
 * @returns {{ Food: number, Transport: number, Fun: number }}
 *
 * Satisfies: Requirements 4.1, 5.2
 */
function calcCategoryTotals(transactions) {
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  for (const t of transactions) {
    if (Object.prototype.hasOwnProperty.call(totals, t.category)) {
      totals[t.category] += t.amount;
    }
  }
  return totals;
}

/**
 * Calculates a monthly summary of transactions grouped by calendar month.
 *
 * Groups transactions by the first 7 characters of `dateAdded` (YYYY-MM),
 * sums the total amount and per-category amounts for each month, and returns
 * the results sorted in descending chronological order (most recent month first).
 * Months with no transactions are omitted entirely.
 *
 * @param {Array<{amount: number, category: string, dateAdded: string}>} transactions
 * @returns {Array<{ month: string, total: number, categories: { Food: number, Transport: number, Fun: number } }>}
 *
 * Satisfies: Requirements 7.1, 7.2, 7.5, 7.7, 7.8
 */
function calcMonthlySummary(transactions) {
  // Build a map keyed by YYYY-MM
  const map = {};

  for (const t of transactions) {
    const month = t.dateAdded.slice(0, 7); // 'YYYY-MM'

    if (!map[month]) {
      map[month] = {
        month,
        total: 0,
        categories: { Food: 0, Transport: 0, Fun: 0 }
      };
    }

    map[month].total += t.amount;

    if (Object.prototype.hasOwnProperty.call(map[month].categories, t.category)) {
      map[month].categories[t.category] += t.amount;
    }
  }

  // Convert to array and sort descending by month string (most recent first)
  return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
}

/**
 * Determines whether a category has exceeded its budget limit.
 *
 * Returns false when:
 *  - budgets[category] is null (no limit set)
 *  - budgets[category] is 0 (treated as no limit)
 * Returns true when totals[category] >= budgets[category] (limit is set and spending meets or exceeds it).
 *
 * @param {string} category - The category name ('Food' | 'Transport' | 'Fun')
 * @param {{ Food: number, Transport: number, Fun: number }} totals - Category spending totals
 * @param {{ Food: number|null, Transport: number|null, Fun: number|null }} budgets - Budget limits per category
 * @returns {boolean}
 *
 * Satisfies: Requirements 5.2, 5.3
 */
function isCategoryOverBudget(category, totals, budgets) {
  const limit = budgets[category];
  if (limit === null || limit === 0) return false;
  return totals[category] >= limit;
}

/**
 * Prepares chart data from the current transactions for Chart.js.
 *
 * Steps:
 *  1. Returns null immediately when transactions array is empty.
 *  2. Computes per-category totals via calcCategoryTotals().
 *  3. Filters CATEGORIES to those with total > 0.
 *  4. Returns null when no category has a positive total.
 *  5. Builds parallel arrays: labels (with percentage), data (totals), colors.
 *
 * @param {Array<{amount: number, category: string}>} transactions
 * @returns {{ labels: string[], data: number[], colors: string[] } | null}
 *
 * Satisfies: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
function buildChartData(transactions) {
  if (transactions.length === 0) return null;

  const totals = calcCategoryTotals(transactions);

  /** @type {{ [key: string]: string }} */
  const CATEGORY_COLORS = {
    Food:      '#FF6384',
    Transport: '#36A2EB',
    Fun:       '#FFCE56'
  };

  // Filter to categories with spending > 0
  const activeCategories = CATEGORIES.filter(cat => totals[cat] > 0);

  if (activeCategories.length === 0) return null;

  const totalSum = activeCategories.reduce((sum, cat) => sum + totals[cat], 0);

  const labels = activeCategories.map(cat => {
    const pct = Math.round((totals[cat] / totalSum) * 100);
    return `${cat} (${pct}%)`;
  });

  const data   = activeCategories.map(cat => totals[cat]);
  const colors = activeCategories.map(cat => CATEGORY_COLORS[cat]);

  return { labels, data, colors };
}

// ============================================================
// Sorter
// ============================================================

/**
 * Sorts a copy of the transactions array according to the given sort preference.
 *
 * Supported sort preferences:
 *  - 'amount-asc'   : amount ascending, then dateAdded descending
 *  - 'amount-desc'  : amount descending, then dateAdded descending
 *  - 'category-az'  : category A–Z, then dateAdded descending
 *
 * Does NOT mutate the input array.
 *
 * @param {Array<{amount: number, category: string, dateAdded: string}>} transactions
 * @param {string} sortPref
 * @returns {Array} New sorted array
 *
 * Satisfies: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
function sortTransactions(transactions, sortPref) {
  return [...transactions].sort((a, b) => {
    let primary = 0;

    if (sortPref === 'amount-asc') {
      primary = a.amount - b.amount;
    } else if (sortPref === 'amount-desc') {
      primary = b.amount - a.amount;
    } else if (sortPref === 'category-az') {
      primary = a.category.localeCompare(b.category);
    }

    if (primary !== 0) return primary;

    // Secondary: dateAdded descending (most recent first)
    return b.dateAdded.localeCompare(a.dateAdded);
  });
}

// ============================================================
// Renderer
// ============================================================

/** Holds the active Chart.js instance so it can be destroyed before re-creating. */
let chartInstance = null;

/**
 * Updates #balance-display with the current balance.
 * @stub — full implementation in task 6.1
 */
function renderBalance() {
  // Stub — will be replaced in task 6.1
  console.log('[stub] renderBalance called');
}

/**
 * Renders the transaction list into #transaction-list.
 *
 * Steps:
 *  1. Sorts transactions via sortTransactions(state.transactions, state.sortPref).
 *  2. Computes category totals via calcCategoryTotals(state.transactions).
 *  3. Clears #transaction-list and rebuilds it with <li> elements.
 *     Each <li> shows: item name, amount (2 decimal places), category, and date added.
 *     Each <li> has a delete button with data-id set to the transaction's id.
 *     <li> items whose category is over budget receive the 'over-budget' CSS class.
 *  4. Shows #empty-state when the list is empty; hides it otherwise.
 *
 * Satisfies: Requirements 2.1, 2.2, 2.4, 5.2, 5.3
 */
function renderTransactionList() {
  const listEl = document.getElementById('transaction-list');
  const emptyStateEl = document.getElementById('empty-state');

  if (!listEl) return;

  // 1. Sort transactions
  const sorted = (typeof sortTransactions === 'function')
    ? sortTransactions(state.transactions, state.sortPref)
    : [...state.transactions];

  // 2. Compute category totals
  const totals = calcCategoryTotals(state.transactions);

  // 3. Clear and rebuild the list
  listEl.innerHTML = '';

  for (const transaction of sorted) {
    const li = document.createElement('li');

    // Apply over-budget CSS class if applicable
    const overBudget = (typeof isCategoryOverBudget === 'function')
      ? isCategoryOverBudget(transaction.category, totals, state.budgets)
      : false;

    if (overBudget) {
      li.classList.add('over-budget');
    }

    // Format date readably (e.g. "May 26, 2025, 10:30 AM")
    const dateFormatted = new Date(transaction.dateAdded).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build the text content
    const infoSpan = document.createElement('span');
    infoSpan.className = 'transaction-info';
    infoSpan.textContent =
      `${transaction.name} — $${transaction.amount.toFixed(2)} [${transaction.category}] — ${dateFormatted}`;

    // Build the delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-id', transaction.id);
    deleteBtn.setAttribute('aria-label', `Delete ${transaction.name}`);

    li.appendChild(infoSpan);
    li.appendChild(deleteBtn);
    listEl.appendChild(li);
  }

  // 4. Show/hide empty state
  if (emptyStateEl) {
    if (sorted.length === 0) {
      emptyStateEl.removeAttribute('hidden');
    } else {
      emptyStateEl.setAttribute('hidden', '');
    }
  }
}

/**
 * Renders the spending pie chart into #spending-chart using Chart.js.
 *
 * Steps:
 *  1. Calls buildChartData(state.transactions).
 *  2. If null: hides <canvas>, shows #chart-empty-state with "No data to display.", returns.
 *  3. Otherwise: shows <canvas>, hides #chart-empty-state.
 *  4. Destroys any existing Chart.js instance stored in chartInstance.
 *  5. Computes per-segment border colors — red (#e53e3e) for over-budget categories,
 *     transparent for normal ones.
 *  6. Creates a new Chart (type 'pie') wrapped in try/catch.
 *     On failure: hides canvas, shows "Chart unavailable — please check your internet connection."
 *
 * Satisfies: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.2, 5.3
 */
function renderChart() {
  const canvas     = document.getElementById('spending-chart');
  const emptyState = document.getElementById('chart-empty-state');

  if (!canvas || !emptyState) return;

  const chartData = buildChartData(state.transactions);

  if (chartData === null) {
    // No data — show empty state
    canvas.hidden     = true;
    emptyState.hidden = false;
    emptyState.textContent = 'No data to display.';
    return;
  }

  // Data available — show canvas, hide empty state
  canvas.hidden     = false;
  emptyState.hidden = true;

  // Destroy previous instance to avoid canvas reuse errors
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Determine border colors: red for over-budget segments, transparent otherwise
  const totals = calcCategoryTotals(state.transactions);

  // activeCategories mirrors the order used in buildChartData
  const activeCategories = CATEGORIES.filter(cat => totals[cat] > 0);
  const borderColors = activeCategories.map(cat =>
    isCategoryOverBudget(cat, totals, state.budgets) ? '#e53e3e' : 'transparent'
  );

  try {
    chartInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: chartData.labels,
        datasets: [{
          data:            chartData.data,
          backgroundColor: chartData.colors,
          borderColor:     borderColors,
          borderWidth:     3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: $${ctx.parsed.toFixed(2)}`
            }
          }
        }
      }
    });
  } catch (_err) {
    canvas.hidden          = true;
    emptyState.hidden      = false;
    emptyState.textContent = 'Chart unavailable — please check your internet connection.';
  }
}

/**
 * Renders budget warning indicators in #budget-limits.
 *
 * Steps:
 *  1. Computes category totals via calcCategoryTotals(state.transactions).
 *  2. Iterates over every .budget-row element in #budget-limits.
 *  3. For each row, reads the data-category attribute and calls
 *     isCategoryOverBudget(category, totals, state.budgets).
 *  4. Adds the 'over-budget' CSS class to the row when over budget;
 *     removes it when not.
 *
 * When a budget limit is null or 0 (no limit set), isCategoryOverBudget()
 * returns false so no warning is shown (Requirement 5.5).
 *
 * Satisfies: Requirements 5.2, 5.3, 5.5, 5.7
 */
function renderBudgetWarnings() {
  const totals = calcCategoryTotals(state.transactions);

  const budgetRows = document.querySelectorAll('#budget-limits .budget-row');
  for (const row of budgetRows) {
    const category = row.getAttribute('data-category');
    if (!category) continue;

    if (isCategoryOverBudget(category, totals, state.budgets)) {
      row.classList.add('over-budget');
    } else {
      row.classList.remove('over-budget');
    }
  }
}

/**
 * Renders the monthly summary section if state.summaryVisible is true.
 *
 * Steps:
 *  1. If state.summaryVisible is false, hide #monthly-summary and return early.
 *  2. Compute calcMonthlySummary(state.transactions) to get the monthly data.
 *  3. If state._lastDeletedMonthEntry is set, merge it into the summary array:
 *     - If that month already exists in the computed summary, leave it as-is.
 *     - If not, insert the entry (with zero totals) so the month remains visible
 *       after the last transaction in that month is deleted.
 *  4. Render each month entry into #monthly-summary-content showing:
 *     - Month label (YYYY-MM)
 *     - Total amount (2 decimal places)
 *     - Per-category breakdown (Food, Transport, Fun totals)
 *  5. Show the #monthly-summary section.
 *
 * Satisfies: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */
function renderMonthlySummary() {
  const section    = document.getElementById('monthly-summary');
  const contentEl  = document.getElementById('monthly-summary-content');

  if (!section || !contentEl) return;

  // 1. Hide and bail out when summary is not visible
  if (!state.summaryVisible) {
    section.hidden = true;
    return;
  }

  // 2. Compute monthly summary from current transactions
  const summary = calcMonthlySummary(state.transactions);

  // 3. Merge _lastDeletedMonthEntry if set and not already present
  if (state._lastDeletedMonthEntry !== null) {
    const entry = state._lastDeletedMonthEntry;
    const alreadyPresent = summary.some(e => e.month === entry.month);
    if (!alreadyPresent) {
      // Insert in the correct descending-chronological position
      const insertIndex = summary.findIndex(e => e.month < entry.month);
      if (insertIndex === -1) {
        summary.push(entry);
      } else {
        summary.splice(insertIndex, 0, entry);
      }
    }
  }

  // 4. Render each month entry
  contentEl.innerHTML = '';

  for (const entry of summary) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'monthly-summary-entry';

    // Month heading with total
    const heading = document.createElement('h3');
    heading.className = 'monthly-summary-heading';
    heading.textContent = `${entry.month} — Total: $${entry.total.toFixed(2)}`;

    // Per-category breakdown list
    const catList = document.createElement('ul');
    catList.className = 'monthly-summary-categories';

    for (const cat of CATEGORIES) {
      const li = document.createElement('li');
      li.textContent = `${cat}: $${entry.categories[cat].toFixed(2)}`;
      catList.appendChild(li);
    }

    monthDiv.appendChild(heading);
    monthDiv.appendChild(catList);
    contentEl.appendChild(monthDiv);
  }

  // 5. Show the section
  section.hidden = false;
}

/**
 * Calls all render functions to fully redraw the UI from current state.
 *
 * Invokes each renderer in sequence so every part of the UI reflects the
 * latest in-memory state after any add, delete, sort, or budget change.
 *
 * Satisfies: Requirements 3.1, 4.1, 5.2, 7.1
 */
function renderAll() {
  renderBalance();
  renderTransactionList();
  renderChart();
  renderBudgetWarnings();
  renderMonthlySummary();
}

// ============================================================
// Controller
// ============================================================

/**
 * Handles #transaction-form submit event.
 *
 * Steps:
 *  1. Prevents default form submission.
 *  2. Reads name, amountStr, and category from the form fields.
 *  3. Calls validateTransaction(); on failure renders errors into #form-errors and returns.
 *  4. On success:
 *     a. Creates a transaction object with a unique id and ISO dateAdded.
 *     b. Prepends it to state.transactions via unshift().
 *     c. Calls saveTransactions(); on failure shows inline error, removes the
 *        prepended item from state, and returns without calling renderAll().
 *     d. On save success: clears #item-name and #amount, resets #category to "Food",
 *        clears #form-errors, and calls renderAll().
 *
 * @param {SubmitEvent} e
 * Satisfies: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
function handleTransactionSubmit(e) {
  e.preventDefault();

  // 1. Read form field values
  const nameInput     = document.getElementById('item-name');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category');
  const formErrors    = document.getElementById('form-errors');

  const name      = nameInput     ? nameInput.value     : '';
  const amountStr = amountInput   ? amountInput.value   : '';
  const category  = categoryInput ? categoryInput.value : '';

  // 2. Validate
  const { valid, errors } = validateTransaction(name, amountStr, category);

  if (!valid) {
    // Render validation errors into #form-errors
    if (formErrors) {
      formErrors.innerHTML = '';
      const ul = document.createElement('ul');
      ul.className = 'error-list';
      for (const msg of errors) {
        const li = document.createElement('li');
        li.textContent = msg;
        ul.appendChild(li);
      }
      formErrors.appendChild(ul);
    }
    return;
  }

  // 3. Build the transaction object
  const transaction = {
    id:        (typeof crypto !== 'undefined' && crypto.randomUUID)
                 ? crypto.randomUUID()
                 : Date.now().toString(),
    name:      name.trim(),
    amount:    parseFloat(amountStr),
    category,
    dateAdded: new Date().toISOString()
  };

  // 4a. Prepend to state
  state.transactions.unshift(transaction);

  // 4b. Persist — roll back on failure
  const saved = saveTransactions();
  if (!saved) {
    // saveTransactions() already wrote the error message to #form-errors.
    // Roll back the prepended item so state stays consistent.
    state.transactions.shift();
    return;
  }

  // 4c. Save succeeded — reset form fields and re-render
  if (nameInput)     nameInput.value     = '';
  if (amountInput)   amountInput.value   = '';
  if (categoryInput) categoryInput.value = 'Food';
  if (formErrors)    formErrors.innerHTML = '';

  renderAll();
}

// Alias used by init() — the stub was named handleFormSubmit; keep both names
// pointing to the same implementation so the addEventListener in init() works.
const handleFormSubmit = handleTransactionSubmit;

/**
 * Handles click events on #transaction-list (event delegation for delete buttons).
 * @param {MouseEvent} e
 * @stub — full implementation in task 7.2
 */
function handleDeleteClick(e) {
  // Stub — will be replaced in task 7.2
  console.log('[stub] handleDeleteClick called');
}

/**
 * Handles input events on .budget-row inputs.
 *
 * Steps:
 *  1. Finds the parent .budget-row element and reads its data-category attribute.
 *  2. Calls validateBudgetLimit() on the current input value.
 *  3. On failure: shows the error message in the .budget-error span within that
 *     row; leaves state.budgets[category] unchanged.
 *  4. On success: clears any error in .budget-error, updates state.budgets[category]
 *     with the validated value (or null if empty), calls saveBudgets(), calls renderAll().
 *
 * @param {Event} e
 * Satisfies: Requirements 5.1, 5.4, 5.6, 5.7
 */
function handleBudgetInput(e) {
  const input = e.target;

  // 1. Find the parent .budget-row and its category
  const row = input.closest('.budget-row');
  if (!row) return;

  const category = row.getAttribute('data-category');
  if (!category) return;

  const errorSpan = row.querySelector('.budget-error');

  // 2. Validate the current input value
  const result = validateBudgetLimit(input.value);

  if (!result.valid) {
    // 3. Show error, leave state.budgets[category] unchanged
    if (errorSpan) {
      errorSpan.textContent = result.error;
    }
    return;
  }

  // 4. Valid — clear error, update state, persist, re-render
  if (errorSpan) {
    errorSpan.textContent = '';
  }

  state.budgets[category] = result.value; // null when empty, number otherwise

  saveBudgets();
  renderAll();
}

/**
 * Handles #sort-select change event.
 *
 * Updates state.sortPref with the newly selected value, persists it via
 * saveSortPref() (showing a dismissible toast on failure but continuing to
 * use the selected sort for the current session), then re-renders the UI.
 *
 * @param {Event} e
 * Satisfies: Requirements 6.1, 6.2, 6.6, 6.7
 */
function handleSortChange(e) {
  state.sortPref = e.target.value;

  const saved = saveSortPref();
  if (!saved) {
    // saveSortPref() already shows the dismissible toast on failure.
    // Continue using the selected sort for the current session (state already updated).
  }

  renderAll();
}

/**
 * Handles #toggle-summary click event.
 *
 * Toggles state.summaryVisible, updates the button label to reflect the new
 * state, then calls renderMonthlySummary() to show or hide the section.
 *
 * Satisfies: Requirements 7.3, 7.4
 */
function handleToggleSummary() {
  state.summaryVisible = !state.summaryVisible;

  const btn = document.getElementById('toggle-summary');
  if (btn) {
    btn.textContent = state.summaryVisible
      ? 'Hide Monthly Summary'
      : 'View Monthly Summary';
  }

  renderMonthlySummary();
}

// ============================================================
// Init
// ============================================================

/**
 * Initialises the application:
 *  1. Loads persisted state from localStorage (handles unavailability and
 *     corrupted JSON per the error handling spec).
 *  2. Restores the sort select value from state.sortPref.
 *  3. Restores each budget input value from state.budgets.
 *  4. Attaches all event listeners.
 *  5. Calls renderAll() to draw the initial UI.
 *
 * Satisfies: Requirements 8.4, 8.5, 8.6
 */
function init() {
  // 1. Populate state from localStorage
  loadState();

  // 2. Restore sort select value
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.value = state.sortPref;
  }

  // 3. Restore budget input values from state.budgets
  //    Each .budget-row has a data-category attribute and contains one <input>
  document.querySelectorAll('.budget-row').forEach((row) => {
    const category = row.dataset.category;
    const input = row.querySelector('input');
    if (input && category && state.budgets[category] !== null) {
      input.value = state.budgets[category];
    }
  });

  // 4. Attach event listeners
  const form = document.getElementById('transaction-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  const transactionList = document.getElementById('transaction-list');
  if (transactionList) {
    transactionList.addEventListener('click', handleDeleteClick);
  }

  document.querySelectorAll('.budget-row input').forEach((input) => {
    input.addEventListener('input', handleBudgetInput);
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', handleSortChange);
  }

  const toggleBtn = document.getElementById('toggle-summary');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleToggleSummary);
  }

  // 5. Draw initial UI from restored state
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

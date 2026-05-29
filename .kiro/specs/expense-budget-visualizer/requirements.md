# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, visualize spending distribution by category, monitor budget limits, and review monthly summaries — all without a backend server. Data is persisted entirely in the browser's Local Storage. The application is built with plain HTML, CSS, and vanilla JavaScript, and can run as a standalone web page or browser extension.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense record consisting of an item name, amount, and category.
- **Category**: A classification label for a transaction. Supported values: Food, Transport, Fun.
- **Balance**: The running total of all transaction amounts currently stored.
- **Budget_Limit**: A user-defined spending threshold per category, above which the App highlights overspending.
- **Chart**: The pie chart that visualizes spending distribution across categories.
- **Transaction_List**: The scrollable UI component that displays all stored transactions.
- **Monthly_Summary**: An aggregated view of transactions grouped by calendar month.
- **Local_Storage**: The browser's Web Storage API used to persist all application data client-side.
- **Validator**: The input validation logic that checks form fields before a transaction is saved.
- **Sorter**: The logic responsible for ordering transactions in the Transaction_List.

---

## Requirements

### Requirement 1: Add a Transaction

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense.

#### Acceptance Criteria

1. THE App SHALL render an input form containing fields for Item Name (text, maximum 100 characters), Amount (numeric), and Category (select: Food, Transport, Fun).
2. WHEN the user submits the form with all fields filled and a valid Amount (a positive number between 0.01 and 999,999,999.99 with up to 2 decimal places), THE App SHALL add the transaction to Local_Storage and prepend it at the top of the Transaction_List; both the storage write and the UI update must succeed for the transaction to be considered successfully added.
3. WHEN the user submits the form with one or more empty fields, THE Validator SHALL display an inline error message identifying the missing field(s) and SHALL NOT save the transaction.
4. WHEN the user submits the form with an Amount that is zero, negative, non-numeric, out of range (above 999,999,999.99), or has more than 2 decimal places, THE Validator SHALL display an inline error message and SHALL NOT save the transaction.
5. WHEN a transaction is successfully added, THE App SHALL clear the Item Name and Amount fields to empty and reset the Category field to its first option (Food).
6. IF saving the transaction to Local_Storage fails, THEN THE App SHALL display an error message informing the user that the transaction could not be saved and SHALL NOT update the Transaction_List.

---

### Requirement 2: Display and Delete Transactions

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list and be able to remove any of them so that I can manage my expense history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored transactions, each showing the item name, amount formatted to two decimal places, category, and the date the transaction was added; transactions SHALL be displayed in newest-first order by default.
2. THE Transaction_List SHALL be scrollable when the number of transactions exceeds the visible area.
3. WHEN the user clicks the delete button on a transaction, THE App SHALL remove that transaction from Local_Storage and remove it from the Transaction_List without requiring a page reload.
4. WHEN no transactions are visible in the Transaction_List (whether because none are stored or because all have been filtered out), THE Transaction_List SHALL display an empty-state message indicating that no expenses are currently shown.
5. IF deleting a transaction from Local_Storage fails, THEN THE App SHALL display an error message and SHALL NOT remove the transaction from the Transaction_List.

---

### Requirement 3: Display Total Balance

**User Story:** As a user, I want to see the total of all my expenses at the top of the page so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE App SHALL display the Balance prominently at the top of the page, formatted to two decimal places.
2. WHEN a transaction is added, THE App SHALL recalculate and update the Balance immediately without a page reload.
3. WHEN a transaction is deleted, THE App SHALL recalculate and update the Balance immediately without a page reload.
4. WHEN no transactions are stored, THE App SHALL display a Balance of 0.00.

---

### Requirement 4: Visualize Spending with a Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart that shows the proportional spending for each category (Food, Transport, Fun) based on the current transactions in Local_Storage; each segment SHALL be labeled with the category name and its percentage of total spending.
2. WHEN a transaction is added, THE Chart SHALL update automatically to reflect the new spending distribution without a page reload.
3. WHEN a transaction is deleted, THE Chart SHALL update automatically to reflect the revised spending distribution without a page reload.
4. WHEN the Chart is rendered and only one or two categories have transactions, THE Chart SHALL render only the segments for categories that have a non-zero total.
5. WHEN no transactions are stored, THE Chart SHALL display a text message (e.g., "No data to display") instead of an empty chart.
6. WHEN all transactions are deleted, THE Chart SHALL transition to the empty-state text message without requiring a page reload.

---

### Requirement 5: Highlight Spending Over Budget Limit

**User Story:** As a user, I want to set a spending limit per category so that I am visually alerted when I exceed my budget.

#### Acceptance Criteria

1. THE App SHALL provide a Budget_Limit input field for each category (Food, Transport, Fun) where the user can enter a numeric value between 0.01 and 9,999,999.99.
2. WHEN the total spending for a category meets or exceeds its Budget_Limit, THE App SHALL apply a warning indicator — visually distinct from the default state (such as a highlighted background or warning icon) — to that category's entry in the Transaction_List and in the Chart.
3. WHEN the total spending for a category falls below its Budget_Limit, THE App SHALL remove the warning indicator for that category in the Transaction_List and in the Chart.
4. THE App SHALL persist Budget_Limit values in Local_Storage so that limits are retained across page reloads.
5. WHEN a Budget_Limit field is left empty or set to zero, THE App SHALL treat that category as having no limit and SHALL NOT apply any warning indicator for that category.
6. IF a Budget_Limit input value is negative or non-numeric, THEN THE App SHALL reject the input and display an error message indicating the value must be a positive number, leaving the previous valid Budget_Limit value unchanged.
7. WHEN the user changes a Budget_Limit value for a category, THE App SHALL immediately recalculate and update the warning indicator state for that category in the Transaction_List and in the Chart without requiring a page reload.

---

### Requirement 6: Sort Transactions

**User Story:** As a user, I want to sort my transaction list by amount or by category so that I can quickly find and review specific expenses.

#### Acceptance Criteria

1. THE App SHALL provide a sort control that allows the user to select a sort order: by Amount (ascending, the default), by Amount (descending), or by Category (alphabetical A–Z).
2. WHEN the user selects a sort option, THE Sorter SHALL reorder the Transaction_List according to the selected criterion within 100ms without a page reload.
3. WHEN a new transaction is added while a sort option is active, THE Sorter SHALL insert the new transaction in the correct position according to the active sort order.
4. WHEN the user switches sort options, THE Sorter SHALL re-sort all current transactions according to the newly selected criterion.
5. WHEN two transactions have equal sort values, THE Sorter SHALL use the transaction's date added as a secondary sort key, with the most recently added transaction appearing first.
6. THE App SHALL persist the active sort preference in Local_Storage so that the selected sort order is restored on page reload.
7. IF saving the sort preference to Local_Storage fails, THEN THE App SHALL display an error message and continue using the selected sort order for the current session.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to view a summary of my expenses grouped by month so that I can track my spending trends over time.

#### Acceptance Criteria

1. THE App SHALL provide a Monthly_Summary view that groups transactions by calendar month (format: YYYY-MM) and displays the sum of transaction amounts per month; months SHALL be displayed in descending chronological order (most recent first).
2. THE Monthly_Summary SHALL display the per-category breakdown (Food, Transport, Fun totals as the sum of transaction amounts for each category) for each month.
3. WHEN the user navigates to the Monthly_Summary view, THE App SHALL render the summary based on all transactions currently in Local_Storage.
4. WHEN a transaction is added or deleted while the Monthly_Summary view is active, THE App SHALL update the Monthly_Summary within 500ms without a page reload; no update to the Monthly_Summary is required while the user is viewing other parts of the App.
5. WHEN no transactions exist for a given month, THE App SHALL omit that month from the Monthly_Summary.
6. WHEN the last transaction in a month is deleted while the Monthly_Summary view is active, THE App SHALL keep that month visible in the Monthly_Summary with zero totals until the user navigates away from and back to the Monthly_Summary view.
7. THE App SHALL record the date of each transaction at the time it is added.
8. THE App SHALL use the recorded date of each transaction to assign it to the correct calendar month in the Monthly_Summary.

---

### Requirement 8: Data Persistence Across Sessions

**User Story:** As a user, I want my transactions, budget limits, and preferences to be saved automatically so that my data is available the next time I open the app.

#### Acceptance Criteria

1. THE App SHALL save all transactions to Local_Storage before the next user interaction is processed when a transaction is added or deleted.
2. THE App SHALL save Budget_Limit values to Local_Storage before the next user interaction is processed when a limit is set or updated.
3. THE App SHALL save the active sort preference to Local_Storage before the next user interaction is processed when the user changes the sort order.
4. WHEN the App is loaded or reloaded, THE App SHALL read all transactions, Budget_Limit values, and sort preferences from Local_Storage and restore the Transaction_List, Balance, Chart, and sort control to the previous state.
5. IF Local_Storage is unavailable or a read operation fails, THEN THE App SHALL display a warning message informing the user that data persistence is not available and SHALL continue to function in-memory for the current session.
6. IF Local_Storage contains data that cannot be parsed (e.g., corrupted JSON), THEN THE App SHALL discard the corrupted data, display a warning message informing the user that saved data could not be loaded, and start with an empty state.

---

### Requirement 9: Performance and Responsiveness

**User Story:** As a user, I want the app to respond instantly to my interactions so that I can record and review expenses without frustration.

#### Acceptance Criteria

1. WHEN the App is opened in a modern browser (Chrome, Firefox, Edge, Safari) on a device with a network connection of at least 10 Mbps, THE App SHALL complete initial render and display all stored data within 1 second.
2. WHEN the user adds or deletes a transaction, THE App SHALL update the Transaction_List, Balance, and Chart within 200ms; this 200ms limit applies only to user-initiated add and delete operations.
3. IF the Monthly_Summary view is active WHEN the user adds or deletes a transaction, THEN THE App SHALL also update the Monthly_Summary within the same 200ms window.
4. WHILE the Transaction_List contains up to 500 transactions, THE App SHALL maintain responsive UI interactions with no more than 100ms latency during sort, add, or delete operations; no responsiveness guarantee is made for transaction counts exceeding 500.

---

### Requirement 10: File and Code Structure

**User Story:** As a developer, I want the project to follow a clean, minimal file structure so that the codebase is easy to read and maintain.

#### Acceptance Criteria

1. THE App SHALL be structured with exactly one HTML file at the project root, exactly one CSS file inside a `css/` directory, and exactly one JavaScript file inside a `js/` directory.
2. THE App SHALL load Chart.js (or an equivalent lightweight chart library) via a CDN `<script>` tag and SHALL NOT bundle or vendor the library locally.
3. THE App SHALL require no build tools, package managers, or server-side runtime to run; opening the HTML file directly in a browser SHALL be sufficient to launch the App.
4. THE App SHALL NOT use any JavaScript frameworks or libraries other than the chart library loaded via CDN; all application logic SHALL be written in vanilla JavaScript.
5. THE CSS file SHALL contain all styles for the App; no inline styles or additional stylesheets SHALL be used except for styles injected by the chart library.

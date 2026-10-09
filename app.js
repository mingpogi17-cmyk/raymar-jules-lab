/**
 * Ray Mar Apps — Business Expense Tracker (MVP)
 * Core Application Logic & Validation
 */

const STORAGE_KEY = 'raymar_expenses_v1';

// Format currency in Philippine Peso (₱)
function formatPHP(amount) {
  const num = parseFloat(amount) || 0;
  return '₱' + num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Load expenses from localStorage
function getExpenses() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to parse expenses from localStorage:', e);
    return [];
  }
}

// Save expenses to localStorage
function saveExpenses(expenses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  } catch (e) {
    console.error('Failed to save expenses to localStorage:', e);
  }
}

// Validation logic
function validateExpenseInput({ date, amount, category, merchant }) {
  const errors = {};

  if (!date || date.trim() === '') {
    errors.date = 'Petsa ay kinakailangan (Date is required).';
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    errors.amount = 'Ang halaga ay dapat mas mataas sa ₱0.00 (Amount must be > 0).';
  }

  if (!category || category.trim() === '') {
    errors.category = 'Pumili ng kategorya (Select a category).';
  }

  if (!merchant || merchant.trim().length < 2) {
    errors.merchant = 'Ilagay ang merchant/payee (At least 2 characters).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Calculate totals
function calculateTotals(expenses) {
  let total = 0;
  const categories = {
    Utilities: 0,
    Supplies: 0,
    Rent: 0,
    Payroll: 0,
    Marketing: 0,
    Others: 0
  };

  expenses.forEach(item => {
    const amt = parseFloat(item.amount) || 0;
    total += amt;
    if (categories.hasOwnProperty(item.category)) {
      categories[item.category] += amt;
    } else {
      categories.Others = (categories.Others || 0) + amt;
    }
  });

  return { total, categories };
}

// Filter expenses logic
function filterExpensesList(expenses, searchKeyword, categoryFilter) {
  return expenses.filter(item => {
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const query = searchKeyword.toLowerCase().trim();
    const matchesSearch = query === '' ||
      item.merchant.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });
}

// UI Controller (Only runs in browser DOM environment)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expenseForm');
    const expenseDate = document.getElementById('expenseDate');
    const expenseAmount = document.getElementById('expenseAmount');
    const expenseCategory = document.getElementById('expenseCategory');
    const expenseMerchant = document.getElementById('expenseMerchant');
    const expenseDescription = document.getElementById('expenseDescription');

    const dateError = document.getElementById('dateError');
    const amountError = document.getElementById('amountError');
    const categoryError = document.getElementById('categoryError');
    const merchantError = document.getElementById('merchantError');

    const totalExpensesEl = document.getElementById('totalExpenses');
    const categoryTotalsEl = document.getElementById('categoryTotals');
    const expenseListEl = document.getElementById('expenseList');
    const emptyStateEl = document.getElementById('emptyState');
    const expenseCountEl = document.getElementById('expenseCount');

    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    expenseDate.value = today;

    function clearErrors() {
      dateError.textContent = '';
      amountError.textContent = '';
      categoryError.textContent = '';
      merchantError.textContent = '';
    }

    function renderUI() {
      const expenses = getExpenses();
      const filtered = filterExpensesList(expenses, searchInput.value, filterCategory.value);
      const { total, categories } = calculateTotals(expenses);

      // Render Dashboard Total
      totalExpensesEl.textContent = formatPHP(total);

      // Render Category Totals Grid
      categoryTotalsEl.innerHTML = '';
      Object.keys(categories).forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = 'cat-item';
        catDiv.innerHTML = `<span>${cat}</span> <strong>${formatPHP(categories[cat])}</strong>`;
        categoryTotalsEl.appendChild(catDiv);
      });

      // Render Count
      expenseCountEl.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;

      // Render List
      expenseListEl.innerHTML = '';
      if (filtered.length === 0) {
        emptyStateEl.style.display = 'block';
      } else {
        emptyStateEl.style.display = 'none';
        filtered.forEach(item => {
          const li = document.createElement('li');
          li.className = 'expense-item';
          li.innerHTML = `
            <div class="expense-details">
              <span class="expense-title">${escapeHTML(item.merchant)}</span>
              <span class="expense-meta">${item.date} • <strong class="text-primary">${escapeHTML(item.category)}</strong>${item.description ? ' • ' + escapeHTML(item.description) : ''}</span>
            </div>
            <div class="expense-right">
              <span class="expense-amount-tag">${formatPHP(item.amount)}</span>
              <button class="btn btn-delete" data-id="${item.id}" aria-label="Delete expense">Delete</button>
            </div>
          `;
          expenseListEl.appendChild(li);
        });
      }
    }

    function escapeHTML(str) {
      if (!str) return '';
      return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    // Form submit event
    expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearErrors();

      const inputData = {
        date: expenseDate.value,
        amount: expenseAmount.value,
        category: expenseCategory.value,
        merchant: expenseMerchant.value,
        description: expenseDescription.value
      };

      const { isValid, errors } = validateExpenseInput(inputData);

      if (!isValid) {
        if (errors.date) dateError.textContent = errors.date;
        if (errors.amount) amountError.textContent = errors.amount;
        if (errors.category) categoryError.textContent = errors.category;
        if (errors.merchant) merchantError.textContent = errors.merchant;
        return;
      }

      const newExpense = {
        id: 'exp_' + Date.now(),
        date: inputData.date,
        amount: parseFloat(inputData.amount),
        category: inputData.category,
        merchant: inputData.merchant,
        description: inputData.description
      };

      const expenses = getExpenses();
      expenses.unshift(newExpense);
      saveExpenses(expenses);

      // Reset Form fields except date
      expenseAmount.value = '';
      expenseCategory.value = '';
      expenseMerchant.value = '';
      expenseDescription.value = '';

      renderUI();
    });

    // Delete expense event delegation
    expenseListEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete')) {
        const idToDelete = e.target.getAttribute('data-id');
        let expenses = getExpenses();
        expenses = expenses.filter(item => item.id !== idToDelete);
        saveExpenses(expenses);
        renderUI();
      }
    });

    // Filter event listeners
    searchInput.addEventListener('input', renderUI);
    filterCategory.addEventListener('change', renderUI);

    // Initial render
    renderUI();
  });
}

// Export for Node testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatPHP,
    validateExpenseInput,
    calculateTotals,
    filterExpensesList
  };
}

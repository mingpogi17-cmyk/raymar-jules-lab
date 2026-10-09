/**
 * Ray Mar Apps — Business Expense Tracker (MVP)
 * Core Application Logic & Validation
 */

const STORAGE_KEY = 'raymar_expenses_v1';
const APPROVED_CATEGORIES = ['Utilities', 'Supplies', 'Rent', 'Payroll', 'Marketing', 'Others'];

// Format currency in Philippine Peso (₱)
function formatPHP(amount) {
  const num = Number(amount);
  if (isNaN(num) || !isFinite(num)) {
    return '₱0.00';
  }
  return '₱' + num.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Get user's local date string formatted as YYYY-MM-DD
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Load expenses from storage safely
function getExpenses(customStorage) {
  try {
    const storage = customStorage !== undefined ? customStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) {
      return { success: true, data: [] };
    }
    const rawData = storage.getItem(STORAGE_KEY);
    if (rawData === null || rawData === undefined) {
      return { success: true, data: [] };
    }
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) {
      console.error('Stored data is valid JSON but not an Array:', parsed);
      return {
        success: false,
        data: [],
        error: 'Hindi valid na talaan ng gastos ang nakasave sa storage (Invalid data format).'
      };
    }
    return { success: true, data: parsed };
  } catch (e) {
    console.error('Failed to parse/access expenses from localStorage:', e);
    return {
      success: false,
      data: [],
      error: 'Hindi ma-access o mabasa ang data sa storage (Storage access error or malformed JSON).'
    };
  }
}

// Save expenses to storage safely
function saveExpenses(expenses, customStorage) {
  try {
    const storage = customStorage !== undefined ? customStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) {
      return { success: false, error: 'Walang available na localStorage.' };
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    return { success: true };
  } catch (e) {
    console.error('Failed to save expenses to localStorage:', e);
    return { success: false, error: 'Hindi ma-save ang data sa storage (Storage access error or quota exceeded).' };
  }
}

// Strict Date Validation (YYYY-MM-DD and real date check)
function isValidYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
}

// Strict Numeric Validation (Rejects "100abc", NaN, Infinity, <= 0)
function isValidAmount(amountInput) {
  if (typeof amountInput === 'number') {
    return !isNaN(amountInput) && isFinite(amountInput) && amountInput > 0;
  }
  if (typeof amountInput !== 'string') return false;

  const trimmed = amountInput.trim();
  if (trimmed === '') return false;

  // Ensure the string contains purely numeric characters (optional single decimal point)
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;

  const num = Number(trimmed);
  return !isNaN(num) && isFinite(num) && num > 0;
}

// Validation logic
function validateExpenseInput({ date, amount, category, merchant }) {
  const errors = {};

  if (!date || typeof date !== 'string' || !isValidYYYYMMDD(date.trim())) {
    errors.date = 'Valid date (YYYY-MM-DD) ay kinakailangan (Valid date required).';
  }

  if (!isValidAmount(amount)) {
    errors.amount = 'Ang halaga ay dapat mas mataas sa ₱0.00 at totoong numero (Valid amount > 0 required).';
  }

  if (!category || typeof category !== 'string' || !APPROVED_CATEGORIES.includes(category.trim())) {
    errors.category = 'Pumili ng kategorya sa approved list (Select a valid category).';
  }

  if (!merchant || typeof merchant !== 'string' || merchant.trim().length < 2) {
    errors.merchant = 'Ilagay ang merchant/payee (At least 2 characters).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Calculate totals safely against non-array or malformed item objects
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

  if (Array.isArray(expenses)) {
    expenses.forEach(item => {
      if (item && typeof item === 'object') {
        const amt = Number(item.amount);
        if (!isNaN(amt) && isFinite(amt) && amt > 0) {
          total += amt;
          const cat = (item.category || '').toString().trim();
          if (categories.hasOwnProperty(cat)) {
            categories[cat] += amt;
          } else {
            categories.Others += amt;
          }
        }
      }
    });
  }

  return { total, categories };
}

// Filter expenses logic safely
function filterExpensesList(expenses, searchKeyword, categoryFilter) {
  if (!Array.isArray(expenses)) return [];
  const safeKeyword = (searchKeyword || '').toString().toLowerCase().trim();
  const safeCategory = (categoryFilter || 'ALL').toString();

  return expenses.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const matchesCategory = safeCategory === 'ALL' || item.category === safeCategory;
    const merchantStr = (item.merchant || '').toString().toLowerCase();
    const descStr = (item.description || '').toString().toLowerCase();
    const matchesSearch = safeKeyword === '' || merchantStr.includes(safeKeyword) || descStr.includes(safeKeyword);

    return matchesCategory && matchesSearch;
  });
}

// Escape HTML helper
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// --- PHASE 1: JSON BACKUP & RESTORE HELPERS ---

// Validate imported JSON data structure and every expense record inside
function validateBackupData(parsedData) {
  if (!parsedData) {
    return { isValid: false, error: 'Ang backup file ay blangko (File is empty).' };
  }

  let records = parsedData;
  // Support both raw array and metadata container object { version: 1, expenses: [...] }
  if (!Array.isArray(parsedData) && typeof parsedData === 'object' && Array.isArray(parsedData.expenses)) {
    records = parsedData.expenses;
  }

  if (!Array.isArray(records)) {
    return { isValid: false, error: 'Hindi valid na backup format (Backup must be an array or valid backup object).' };
  }

  const validRecords = [];
  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    if (!item || typeof item !== 'object') {
      return { isValid: false, error: `Ang record #${i + 1} ay hindi valid object.` };
    }

    const { date, amount, category, merchant, description, id } = item;
    const { isValid, errors } = validateExpenseInput({ date, amount, category, merchant });

    if (!isValid) {
      const firstErrKey = Object.keys(errors)[0];
      return {
        isValid: false,
        error: `May maling data sa record #${i + 1} (${merchant || 'Unknown'}): ${errors[firstErrKey]}`
      };
    }

    validRecords.push({
      id: (id && typeof id === 'string' && id.trim() !== '') ? id.trim() : 'exp_' + Date.now() + '_' + i,
      date: String(date).trim(),
      amount: Number(amount),
      category: String(category).trim(),
      merchant: String(merchant).trim(),
      description: description ? String(description).trim() : ''
    });
  }

  return {
    isValid: true,
    data: validRecords
  };
}

// Generate formatted JSON string for backup export
function generateBackupJSON(expenses) {
  const exportPayload = {
    appName: 'Ray Mar Apps Business Expense Tracker',
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalRecords: Array.isArray(expenses) ? expenses.length : 0,
    expenses: Array.isArray(expenses) ? expenses : []
  };
  return JSON.stringify(exportPayload, null, 2);
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
    const storageAlert = document.getElementById('storageAlert');

    const totalExpensesEl = document.getElementById('totalExpenses');
    const categoryTotalsEl = document.getElementById('categoryTotals');
    const expenseListEl = document.getElementById('expenseList');
    const emptyStateEl = document.getElementById('emptyState');
    const expenseCountEl = document.getElementById('expenseCount');

    const searchInput = document.getElementById('searchInput');
    const filterCategory = document.getElementById('filterCategory');

    // Backup & Restore DOM Elements
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const importBackupInput = document.getElementById('importBackupInput');
    const backupMessage = document.getElementById('backupMessage');

    // Set default date to user's local date
    if (expenseDate) {
      expenseDate.value = getLocalDateString();
    }

    function clearErrors() {
      if (dateError) dateError.textContent = '';
      if (amountError) amountError.textContent = '';
      if (categoryError) categoryError.textContent = '';
      if (merchantError) merchantError.textContent = '';
      if (backupMessage) {
        backupMessage.textContent = '';
        backupMessage.style.display = 'none';
        backupMessage.className = 'backup-msg';
      }
      if (storageAlert) {
        storageAlert.textContent = '';
        storageAlert.style.display = 'none';
      }
    }

    function showStorageError(message) {
      if (storageAlert) {
        storageAlert.textContent = message;
        storageAlert.style.display = 'block';
      } else {
        alert(message);
      }
    }

    function showBackupStatus(message, isSuccess = false) {
      if (backupMessage) {
        backupMessage.textContent = message;
        backupMessage.style.display = 'block';
        backupMessage.className = isSuccess ? 'backup-msg success-msg' : 'backup-msg error-msg';
      } else {
        alert(message);
      }
    }

    function renderUI() {
      const loadRes = getExpenses();
      if (!loadRes.success) {
        showStorageError(loadRes.error || 'Hindi mabasa ang saved expenses.');

        // Clear dashboard totals and present error state rather than false ₱0.00 / 0 records
        if (totalExpensesEl) totalExpensesEl.textContent = 'Error';
        if (categoryTotalsEl) categoryTotalsEl.innerHTML = '<div class="error-msg">Unable to load categories</div>';
        if (expenseCountEl) expenseCountEl.textContent = 'Error loading data';
        if (emptyStateEl) {
          emptyStateEl.textContent = 'Hindi ma-load ang talaan ng gastos dahil sa storage error.';
          emptyStateEl.style.display = 'block';
        }
        if (expenseListEl) expenseListEl.innerHTML = '';
        return;
      }

      const expenses = loadRes.data || [];
      const filtered = filterExpensesList(expenses, searchInput ? searchInput.value : '', filterCategory ? filterCategory.value : 'ALL');
      const { total, categories } = calculateTotals(expenses);

      // Render Dashboard Total
      if (totalExpensesEl) totalExpensesEl.textContent = formatPHP(total);

      // Render Category Totals Grid
      if (categoryTotalsEl) {
        categoryTotalsEl.innerHTML = '';
        Object.keys(categories).forEach(cat => {
          const catDiv = document.createElement('div');
          catDiv.className = 'cat-item';
          catDiv.innerHTML = `<span>${escapeHTML(cat)}</span> <strong>${formatPHP(categories[cat])}</strong>`;
          categoryTotalsEl.appendChild(catDiv);
        });
      }

      // Render Count
      if (expenseCountEl) {
        expenseCountEl.textContent = `${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
      }

      // Render List
      if (expenseListEl && emptyStateEl) {
        expenseListEl.innerHTML = '';
        if (filtered.length === 0) {
          emptyStateEl.textContent = 'No expenses recorded yet.';
          emptyStateEl.style.display = 'block';
        } else {
          emptyStateEl.style.display = 'none';
          filtered.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const li = document.createElement('li');
            li.className = 'expense-item';
            li.innerHTML = `
              <div class="expense-details">
                <span class="expense-title">${escapeHTML(item.merchant || 'Unknown Merchant')}</span>
                <span class="expense-meta">${escapeHTML(item.date || '')} • <strong class="text-primary">${escapeHTML(item.category || 'Others')}</strong>${item.description ? ' • ' + escapeHTML(item.description) : ''}</span>
              </div>
              <div class="expense-right">
                <span class="expense-amount-tag">${formatPHP(item.amount)}</span>
                <button class="btn btn-delete" data-id="${escapeHTML(item.id || '')}" aria-label="Delete expense">Delete</button>
              </div>
            `;
            expenseListEl.appendChild(li);
          });
        }
      }
    }

    // Export Backup Handler
    if (exportBackupBtn) {
      exportBackupBtn.addEventListener('click', () => {
        clearErrors();
        const loadRes = getExpenses();
        if (!loadRes.success) {
          showBackupStatus('Hindi ma-export ang data dahil sa storage error.');
          return;
        }

        const expenses = loadRes.data || [];
        if (expenses.length === 0) {
          showBackupStatus('Walang ire-record na gastos para i-export (No records to export).');
          return;
        }

        const jsonString = generateBackupJSON(expenses);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raymar_expenses_backup_${getLocalDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showBackupStatus(`Matagumpay na na-export ang ${expenses.length} records bilang JSON backup file!`, true);
      });
    }

    // Import/Restore Backup Handler
    if (importBackupInput) {
      importBackupInput.addEventListener('change', (e) => {
        clearErrors();
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const fileContent = event.target.result;
            let parsedJSON;
            try {
              parsedJSON = JSON.parse(fileContent);
            } catch (err) {
              showBackupStatus('Hindi mabasa ang file. Ang file ay hindi valid na JSON string.');
              importBackupInput.value = '';
              return;
            }

            const { isValid, data: validatedRecords, error } = validateBackupData(parsedJSON);
            if (!isValid) {
              showBackupStatus(`Import error: ${error}`);
              importBackupInput.value = '';
              return;
            }

            const currentLoad = getExpenses();
            const currentCount = (currentLoad.success && currentLoad.data) ? currentLoad.data.length : 0;
            const confirmMsg = `Sigurado ka bang gusto mong palitan ang ${currentCount} kasalukuyang records gamit ang ${validatedRecords.length} records mula sa backup?`;

            if (confirm(confirmMsg)) {
              const saveRes = saveExpenses(validatedRecords);
              if (!saveRes.success) {
                showBackupStatus(`Hindi ma-save ang na-import na backup: ${saveRes.error}`);
                importBackupInput.value = '';
                return;
              }

              showBackupStatus(`Matagumpay na na-restore ang ${validatedRecords.length} records!`, true);
              renderUI();
            }
          } catch (err) {
            console.error('Error during backup import:', err);
            showBackupStatus('Nagka-error sa pag-process ng backup file.');
          } finally {
            importBackupInput.value = '';
          }
        };

        reader.onerror = () => {
          showBackupStatus('Hindi ma-read ang napiling file.');
          importBackupInput.value = '';
        };

        reader.readAsText(file);
      });
    }

    // Form submit event
    if (expenseForm) {
      expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearErrors();

        const inputData = {
          date: expenseDate ? expenseDate.value : '',
          amount: expenseAmount ? expenseAmount.value : '',
          category: expenseCategory ? expenseCategory.value : '',
          merchant: expenseMerchant ? expenseMerchant.value : '',
          description: expenseDescription ? expenseDescription.value : ''
        };

        const { isValid, errors } = validateExpenseInput(inputData);

        if (!isValid) {
          if (errors.date && dateError) dateError.textContent = errors.date;
          if (errors.amount && amountError) amountError.textContent = errors.amount;
          if (errors.category && categoryError) categoryError.textContent = errors.category;
          if (errors.merchant && merchantError) merchantError.textContent = errors.merchant;
          return;
        }

        const newExpense = {
          id: 'exp_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          date: inputData.date.trim(),
          amount: Number(inputData.amount.trim()),
          category: inputData.category.trim(),
          merchant: inputData.merchant.trim(),
          description: inputData.description ? inputData.description.trim() : ''
        };

        const loadRes = getExpenses();
        if (!loadRes.success) {
          showStorageError('Hindi ma-load ang kasalukuyang data. Hindi na-save ang bagong gastos.');
          return;
        }

        const expenses = loadRes.data;
        expenses.unshift(newExpense);

        const saveRes = saveExpenses(expenses);
        if (!saveRes.success) {
          showStorageError(saveRes.error || 'Nagka-error sa pag-save sa localStorage. Hindi na-save ang gastos.');
          return;
        }

        // Reset Form fields except date
        if (expenseAmount) expenseAmount.value = '';
        if (expenseCategory) expenseCategory.value = '';
        if (expenseMerchant) expenseMerchant.value = '';
        if (expenseDescription) expenseDescription.value = '';

        renderUI();
      });
    }

    // Delete expense event delegation
    if (expenseListEl) {
      expenseListEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete')) {
          const idToDelete = e.target.getAttribute('data-id');
          const loadRes = getExpenses();
          if (!loadRes.success) {
            showStorageError('Hindi ma-access ang storage para mag-delete.');
            return;
          }
          let expenses = loadRes.data;
          expenses = expenses.filter(item => item && item.id !== idToDelete);

          const saveRes = saveExpenses(expenses);
          if (!saveRes.success) {
            showStorageError('Hindi na-save ang pag-delete sa localStorage.');
            return;
          }
          renderUI();
        }
      });
    }

    // Filter event listeners
    if (searchInput) searchInput.addEventListener('input', renderUI);
    if (filterCategory) filterCategory.addEventListener('change', renderUI);

    // Initial render
    renderUI();
  });
}

// Export for Node testing environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APPROVED_CATEGORIES,
    formatPHP,
    getLocalDateString,
    getExpenses,
    saveExpenses,
    isValidYYYYMMDD,
    isValidAmount,
    validateExpenseInput,
    calculateTotals,
    filterExpensesList,
    escapeHTML,
    validateBackupData,
    generateBackupJSON
  };
}

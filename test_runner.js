const assert = require('assert');
const {
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
  escapeHTML
} = require('./app.js');

console.log('Running Ray Mar Apps Business Expense Tracker Comprehensive Unit Tests...\n');

// Mock localStorage implementation
function createMockStorage(shouldFailGet = false, shouldFailSet = false) {
  let store = {};
  return {
    getItem: (key) => {
      if (shouldFailGet) throw new Error('Simulated Read Error');
      return store[key] || null;
    },
    setItem: (key, val) => {
      if (shouldFailSet) throw new Error('Simulated Write Error / Quota Exceeded');
      store[key] = String(val);
    },
    clear: () => { store = {}; }
  };
}

// Test 1: Amount Validation
console.log('Test 1: Amount Validation (Strict Numeric)');
assert.strictEqual(isValidAmount('100'), true);
assert.strictEqual(isValidAmount('100.50'), true);
assert.strictEqual(isValidAmount('100abc'), false, '100abc must be rejected');
assert.strictEqual(isValidAmount('abc'), false, 'abc must be rejected');
assert.strictEqual(isValidAmount('0'), false, 'Zero must be rejected');
assert.strictEqual(isValidAmount('-50'), false, 'Negative amount must be rejected');
assert.strictEqual(isValidAmount(NaN), false, 'NaN must be rejected');
assert.strictEqual(isValidAmount(Infinity), false, 'Infinity must be rejected');
assert.strictEqual(isValidAmount(''), false, 'Empty string must be rejected');
console.log('✓ Passed: Amount validation correctly rejects malformed strings, NaN, Infinity, 0, and negatives.');

// Test 2: Date Validation (YYYY-MM-DD and real date)
console.log('\nTest 2: Date Validation (YYYY-MM-DD & Real Dates)');
assert.strictEqual(isValidYYYYMMDD('2025-02-17'), true);
assert.strictEqual(isValidYYYYMMDD('2025-02-31'), false, 'Feb 31 must be rejected');
assert.strictEqual(isValidYYYYMMDD('2025-13-01'), false, 'Month 13 must be rejected');
assert.strictEqual(isValidYYYYMMDD('02-17-2025'), false, 'MM-DD-YYYY format must be rejected');
assert.strictEqual(isValidYYYYMMDD('invalid-date'), false);
console.log('✓ Passed: Date validation strictly checks YYYY-MM-DD format and real date validity.');

// Test 3: Approved Category Validation
console.log('\nTest 3: Approved Category Validation');
APPROVED_CATEGORIES.forEach(cat => {
  const res = validateExpenseInput({ date: '2025-02-17', amount: '100', category: cat, merchant: 'Valid Merchant' });
  assert.strictEqual(res.isValid, true, `Category ${cat} should be valid`);
});

const unapprovedRes = validateExpenseInput({
  date: '2025-02-17',
  amount: '100',
  category: 'UnapprovedCategory',
  merchant: 'Valid Merchant'
});
assert.strictEqual(unapprovedRes.isValid, false);
assert.ok(unapprovedRes.errors.category, 'Unapproved category must return error');
console.log('✓ Passed: Only approved categories are accepted.');

// Test 4: LocalStorage Read/Write Handling
console.log('\nTest 4: Storage Error Handling');
const normalStorage = createMockStorage();
const saveResult = saveExpenses([{ id: '1', amount: 100 }], normalStorage);
assert.strictEqual(saveResult.success, true);

const loadResult = getExpenses(normalStorage);
assert.strictEqual(loadResult.success, true);
assert.strictEqual(loadResult.data.length, 1);

// Test Failures
const failingWriteStorage = createMockStorage(false, true);
const saveFailResult = saveExpenses([{ id: '1', amount: 100 }], failingWriteStorage);
assert.strictEqual(saveFailResult.success, false);
assert.ok(saveFailResult.error, 'Should contain error message when write fails');

const failingReadStorage = createMockStorage(true, false);
const loadFailResult = getExpenses(failingReadStorage);
assert.strictEqual(loadFailResult.success, false);
assert.ok(loadFailResult.error, 'Should contain error message when read fails');
console.log('✓ Passed: Storage read/write failures are handled gracefully without silent false successes.');

// Test 5: Local Date Formatting
console.log('\nTest 5: Local Date Formatting');
const testDate = new Date(2025, 1, 17); // Month index 1 is Feb
assert.strictEqual(getLocalDateString(testDate), '2025-02-17');
console.log('✓ Passed: Local date formatting returns YYYY-MM-DD matching local timezone date.');

// Test 6: HTML Escaping (XSS Protection)
console.log('\nTest 6: Safe HTML Escaping');
assert.strictEqual(escapeHTML('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
assert.strictEqual(escapeHTML("Merchant's Store & Shop"), 'Merchant&#39;s Store &amp; Shop');
console.log('✓ Passed: HTML special characters are escaped safely.');

// Test 7: Currency Formatting & Totals Calculation
console.log('\nTest 7: Currency Formatting & Calculation Safeguards');
assert.strictEqual(formatPHP(1250.5), '₱1,250.50');
assert.strictEqual(formatPHP('invalid'), '₱0.00');

const totals = calculateTotals([
  { amount: 1000, category: 'Utilities' },
  { amount: 'invalid', category: 'Rent' },
  { amount: -500, category: 'Supplies' },
  { amount: 500, category: 'Supplies' }
]);
assert.strictEqual(totals.total, 1500, 'Invalid and negative amounts should be ignored in total');
assert.strictEqual(totals.categories.Utilities, 1000);
assert.strictEqual(totals.categories.Supplies, 500);
console.log('✓ Passed: Totals calculation ignores malformed and negative data.');

console.log('\n======================================================');
console.log('ALL 7 TEST SUITES PASSED SUCCESSFULLY (0 FAILURES)! 🎉');
console.log('======================================================\n');

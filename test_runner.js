const assert = require('assert');
const { formatPHP, validateExpenseInput, calculateTotals, filterExpensesList } = require('./app.js');

console.log('Running Ray Mar Apps Business Expense Tracker Unit Tests...\n');

// Test 1: formatPHP
console.log('Test 1: Currency Formatting (PHP ₱)');
assert.strictEqual(formatPHP(1250.5), '₱1,250.50');
assert.strictEqual(formatPHP(0), '₱0.00');
assert.strictEqual(formatPHP('500'), '₱500.00');
console.log('✓ Passed: formatPHP formats numbers with ₱ and proper decimals.');

// Test 2: validateExpenseInput (Valid)
console.log('\nTest 2: Validation with Valid Data');
const validResult = validateExpenseInput({
  date: '2025-02-17',
  amount: '1500.00',
  category: 'Utilities',
  merchant: 'Meralco'
});
assert.strictEqual(validResult.isValid, true);
assert.strictEqual(Object.keys(validResult.errors).length, 0);
console.log('✓ Passed: Valid inputs pass validation smoothly.');

// Test 3: validateExpenseInput (Invalid)
console.log('\nTest 3: Validation with Invalid/Missing Data');
const invalidResult = validateExpenseInput({
  date: '',
  amount: '-50',
  category: '',
  merchant: 'A'
});
assert.strictEqual(invalidResult.isValid, false);
assert.ok(invalidResult.errors.date);
assert.ok(invalidResult.errors.amount);
assert.ok(invalidResult.errors.category);
assert.ok(invalidResult.errors.merchant);
console.log('✓ Passed: Invalid inputs produce correct error messages.');

// Test 4: calculateTotals
console.log('\nTest 4: Category Totals & Overall Aggregation');
const mockExpenses = [
  { amount: 1000, category: 'Utilities' },
  { amount: 500, category: 'Utilities' },
  { amount: 2000, category: 'Rent' },
  { amount: 300, category: 'Supplies' }
];
const totals = calculateTotals(mockExpenses);
assert.strictEqual(totals.total, 3800);
assert.strictEqual(totals.categories.Utilities, 1500);
assert.strictEqual(totals.categories.Rent, 2000);
assert.strictEqual(totals.categories.Supplies, 300);
assert.strictEqual(totals.categories.Payroll, 0);
console.log('✓ Passed: Totals and category aggregations are calculated correctly.');

// Test 5: filterExpensesList
console.log('\nTest 5: Filtering by Category and Search Keyword');
const sampleList = [
  { merchant: 'Meralco', category: 'Utilities', description: 'Electric bill' },
  { merchant: 'Office Warehouse', category: 'Supplies', description: 'Paper & ink' },
  { merchant: 'SM Cyberzone', category: 'Supplies', description: 'Mouse' }
];

const utilFilter = filterExpensesList(sampleList, '', 'Utilities');
assert.strictEqual(utilFilter.length, 1);
assert.strictEqual(utilFilter[0].merchant, 'Meralco');

const searchFilter = filterExpensesList(sampleList, 'ink', 'ALL');
assert.strictEqual(searchFilter.length, 1);
assert.strictEqual(searchFilter[0].merchant, 'Office Warehouse');

console.log('✓ Passed: Filtering and search return accurate subset.');

console.log('\nAll 5 Unit Test Suites Passed Successfully! 🎉');

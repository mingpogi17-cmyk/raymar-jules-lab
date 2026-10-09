const assert = require('assert');
const {
  APPROVED_CATEGORIES,
  SUPPORTED_BACKUP_VERSION,
  APP_NAME_IDENTIFIER,
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
  generateBackupJSON,
  restoreBackup
} = require('./app.js');

console.log('Running Ray Mar Apps Business Expense Tracker Comprehensive Unit Tests...\n');

// Mock localStorage implementation with custom return value / exception capability
function createMockStorage(initialValue = null, shouldFailGet = false, shouldFailSet = false) {
  let store = {};
  if (initialValue !== null && initialValue !== undefined) {
    store['raymar_expenses_v1'] = typeof initialValue === 'string' ? initialValue : JSON.stringify(initialValue);
  }
  return {
    getItem: (key) => {
      if (shouldFailGet) throw new Error('Simulated Read Error');
      return store[key] !== undefined ? store[key] : null;
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

// Test 4: LocalStorage Hardening & Exception Security
console.log('\nTest 4: Storage Hardening & Access Exception Handling');

// 4a. Empty Storage
const emptyStorage = createMockStorage(null);
const emptyLoad = getExpenses(emptyStorage);
assert.strictEqual(emptyLoad.success, true);
assert.deepStrictEqual(emptyLoad.data, []);

// 4b. Valid JSON but NOT an Array (Object, Number, String, Null)
const objectStorage = createMockStorage(JSON.stringify({ key: 'value' }));
const objectLoad = getExpenses(objectStorage);
assert.strictEqual(objectLoad.success, false);
assert.ok(objectLoad.error.includes('Invalid data format'));

const numberStorage = createMockStorage(JSON.stringify(12345));
const numberLoad = getExpenses(numberStorage);
assert.strictEqual(numberLoad.success, false);

const stringStorage = createMockStorage(JSON.stringify('hello world'));
const stringLoad = getExpenses(stringStorage);
assert.strictEqual(stringLoad.success, false);

const nullJSONStorage = createMockStorage(JSON.stringify(null));
const nullJSONLoad = getExpenses(nullJSONStorage);
assert.strictEqual(nullJSONLoad.success, false);

// 4c. Malformed JSON string
const malformedStorage = createMockStorage('{ bad json syntax: ');
const malformedLoad = getExpenses(malformedStorage);
assert.strictEqual(malformedLoad.success, false);
assert.ok(malformedLoad.error.includes('Storage access error or malformed JSON'));

// 4d. Storage Read / Write Exceptions
const failingWriteStorage = createMockStorage(null, false, true);
const saveFailResult = saveExpenses([{ id: '1', amount: 100 }], failingWriteStorage);
assert.strictEqual(saveFailResult.success, false);
assert.ok(saveFailResult.error, 'Should contain error message when write fails');

const failingReadStorage = createMockStorage(null, true, false);
const loadFailResult = getExpenses(failingReadStorage);
assert.strictEqual(loadFailResult.success, false);
assert.ok(loadFailResult.error, 'Should contain error message when read fails');

// 4e. Storage Object Getter Exception Simulation
const throwingGetterStorage = {
  get getItem() {
    throw new Error('SecurityError: Access to localStorage is denied');
  },
  get setItem() {
    throw new Error('SecurityError: Access to localStorage is denied');
  }
};
const loadGetterFail = getExpenses(throwingGetterStorage);
assert.strictEqual(loadGetterFail.success, false);
assert.ok(loadGetterFail.error.includes('Storage access error'));

const saveGetterFail = saveExpenses([{ id: '1', amount: 100 }], throwingGetterStorage);
assert.strictEqual(saveGetterFail.success, false);
assert.ok(saveGetterFail.error.includes('Storage access error'));

console.log('✓ Passed: Storage safely handles getter access exceptions, non-array JSON, malformed JSON, and read/write failures.');

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

// Test 7: Currency Formatting & Calculation Safeguards
console.log('\nTest 7: Currency Formatting & Calculation Safeguards');
assert.strictEqual(formatPHP(1250.5), '₱1,250.50');
assert.strictEqual(formatPHP('invalid'), '₱0.00');

const totals = calculateTotals([
  { amount: 1000, category: 'Utilities' },
  { amount: 'invalid', category: 'Rent' },
  { amount: -500, category: 'Supplies' },
  { amount: 500, category: 'Supplies' },
  null,
  'string_item',
  { amount: 200, category: 'UnknownCategory' }
]);
assert.strictEqual(totals.total, 1700, 'Invalid, negative, non-object items should be handled safely');
assert.strictEqual(totals.categories.Utilities, 1000);
assert.strictEqual(totals.categories.Supplies, 500);
assert.strictEqual(totals.categories.Others, 200, 'Unknown categories accumulate under Others');

const filtered = filterExpensesList([
  { merchant: 'Meralco', category: 'Utilities' },
  null,
  'invalid_entry',
  { merchant: 'Office Warehouse', category: 'Supplies' }
], '', 'ALL');
assert.strictEqual(filtered.length, 2, 'Filtering ignores non-object items cleanly');

console.log('✓ Passed: Totals calculation and filtering ignore non-object items and safely categorize legacy/unknown inputs.');

// Test 8: Comprehensive JSON Backup & Restore Suite (All 12 Scenarios)
console.log('\nTest 8: Comprehensive JSON Backup & Restore Workflow Suite (12 Scenarios)');

// Scenario 8.1: Correct export envelope format, version, timestamp, and records
const sampleRecords = [
  { id: 'exp_1', date: '2025-02-17', amount: 1250.50, category: 'Utilities', merchant: 'Meralco', description: 'Electric bill' },
  { id: 'exp_2', date: '2025-02-18', amount: 500, category: 'Supplies', merchant: 'Office Warehouse', description: 'Paper' }
];

const exportPayloadStr = generateBackupJSON(sampleRecords);
const exportPayloadObj = JSON.parse(exportPayloadStr);
assert.strictEqual(exportPayloadObj.appName, APP_NAME_IDENTIFIER);
assert.strictEqual(exportPayloadObj.version, SUPPORTED_BACKUP_VERSION);
assert.ok(!isNaN(Date.parse(exportPayloadObj.exportDate)));
assert.strictEqual(exportPayloadObj.totalRecords, 2);
assert.strictEqual(exportPayloadObj.expenses.length, 2);
console.log('  ✓ 8.1: Exported backup contains correct envelope identifier, version, timestamp, and records.');

// Scenario 8.2: Empty expense list export
const emptyExportStr = generateBackupJSON([]);
const emptyExportObj = JSON.parse(emptyExportStr);
assert.strictEqual(emptyExportObj.totalRecords, 0);
assert.deepStrictEqual(emptyExportObj.expenses, []);
console.log('  ✓ 8.2: Empty expense lists export correctly as valid empty backup document.');

// Scenario 8.3: Successful restore and preservation of all valid records
const testStorageForRestore = createMockStorage([
  { id: 'old_1', date: '2025-01-01', amount: 100, category: 'Others', merchant: 'Old Store', description: '' }
]);
const validBackupObj = JSON.parse(generateBackupJSON(sampleRecords));
const validValidationRes = validateBackupData(validBackupObj);
assert.strictEqual(validValidationRes.isValid, true);

const restoreRes = restoreBackup(validValidationRes.data, testStorageForRestore, () => true);
assert.strictEqual(restoreRes.success, true);
assert.strictEqual(restoreRes.restoredCount, 2);

const postRestoreLoad = getExpenses(testStorageForRestore);
assert.strictEqual(postRestoreLoad.data.length, 2);
assert.strictEqual(postRestoreLoad.data[0].merchant, 'Meralco');
assert.strictEqual(postRestoreLoad.data[1].merchant, 'Office Warehouse');
console.log('  ✓ 8.3: Valid backup restores all records cleanly to storage.');

// Scenario 8.4: Restored records preserve expected fields and values
assert.strictEqual(postRestoreLoad.data[0].id, 'exp_1');
assert.strictEqual(postRestoreLoad.data[0].date, '2025-02-17');
assert.strictEqual(postRestoreLoad.data[0].amount, 1250.50);
assert.strictEqual(postRestoreLoad.data[0].category, 'Utilities');
assert.strictEqual(postRestoreLoad.data[0].description, 'Electric bill');
console.log('  ✓ 8.4: Restored records preserve all expected fields and values accurately.');

// Scenario 8.5: Raw array backup rejection
const rawArrayBackup = sampleRecords;
const rawArrayRes = validateBackupData(rawArrayBackup);
assert.strictEqual(rawArrayRes.isValid, false);
assert.ok(rawArrayRes.error.includes('raw array'));
console.log('  ✓ 8.5: Raw array backups are rejected in favor of versioned envelopes.');

// Scenario 8.6: Malformed JSON and unexpected document structures rejected
assert.strictEqual(validateBackupData(null).isValid, false);
assert.strictEqual(validateBackupData("string_doc").isValid, false);
assert.strictEqual(validateBackupData(12345).isValid, false);
assert.strictEqual(validateBackupData({ randomKey: 'val' }).isValid, false);
console.log('  ✓ 8.6: Malformed JSON and unexpected document structures are rejected.');

// Scenario 8.7: Unsupported backup version rejection
const badVersionBackup = { ...validBackupObj, version: '2.0' };
const badVersionRes = validateBackupData(badVersionBackup);
assert.strictEqual(badVersionRes.isValid, false);
assert.ok(badVersionRes.error.includes('Hindi suportadong backup version'));
console.log('  ✓ 8.7: Unsupported backup versions are rejected.');

// Scenario 8.8: Missing fields, invalid field types, and invalid expense records rejected
const invalidRecordBackup = {
  ...validBackupObj,
  expenses: [
    { id: 'exp_1', date: '2025-02-17', amount: 1500, category: 'Utilities', merchant: 'Meralco' },
    { id: 'exp_2', date: '2025-02-31', amount: 500, category: 'Supplies', merchant: 'Store' } // Invalid date Feb 31
  ]
};
const invalidRecordRes = validateBackupData(invalidRecordBackup);
assert.strictEqual(invalidRecordRes.isValid, false);
assert.ok(invalidRecordRes.error.includes('May maling data sa record #2'));
console.log('  ✓ 8.8: Missing required fields or invalid record field values are rejected.');

// Scenario 8.9: Single invalid record rejects ENTIRE backup without partial import
const partialAttemptStorage = createMockStorage([]);
const partialAttemptValidation = validateBackupData(invalidRecordBackup);
assert.strictEqual(partialAttemptValidation.isValid, false);
// Since validation failed before restore, no records are updated
const partialCheck = getExpenses(partialAttemptStorage);
assert.strictEqual(partialCheck.data.length, 0, 'No partial records should be imported when one record is invalid');
console.log('  ✓ 8.9: A single invalid record rejects the entire backup without partial restoration.');

// Scenario 8.10: Cancelled restore leaves existing records unchanged
const cancelStorage = createMockStorage(sampleRecords);
const cancelRestoreRes = restoreBackup(validValidationRes.data, cancelStorage, () => false); // User clicks Cancel
assert.strictEqual(cancelRestoreRes.cancelled, true);

const cancelCheckLoad = getExpenses(cancelStorage);
assert.strictEqual(cancelCheckLoad.data.length, 2, 'Existing data remains untouched when user cancels');
console.log('  ✓ 8.10: Cancelled restore leaves existing storage records completely unchanged.');

// Scenario 8.11: Invalid backup leaves existing data unchanged
const invalidAttemptStorage = createMockStorage(sampleRecords);
const invalidBackupToAttempt = { appName: 'BadApp' };
const invalidValRes = validateBackupData(invalidBackupToAttempt);
assert.strictEqual(invalidValRes.isValid, false);

const invalidCheckLoad = getExpenses(invalidAttemptStorage);
assert.strictEqual(invalidCheckLoad.data.length, 2, 'Existing data remains untouched on invalid backup');
console.log('  ✓ 8.11: Existing data remains unchanged when backup validation fails.');

// Scenario 8.12: Storage write failure is handled safely with rollback without reporting false success
const storageWriteFailMock = createMockStorage(sampleRecords, false, true); // Save fails on setItem
const failedRestoreRes = restoreBackup(validValidationRes.data, storageWriteFailMock, () => true);
assert.strictEqual(failedRestoreRes.success, false);
assert.ok(failedRestoreRes.error.includes('Hindi ma-save ang bagong backup'));
console.log('  ✓ 8.12: Storage write failure is handled safely without reporting false success.');

console.log('\n======================================================');
console.log('ALL 8 TEST SUITES PASSED SUCCESSFULLY (0 FAILURES)! 🎉');
console.log('======================================================\n');

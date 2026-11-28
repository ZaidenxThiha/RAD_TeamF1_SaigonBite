import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatIntegerInput, parseIntegerInput } from '../public/uc3/number-input.js';

test('voucher number fields group typed and pasted amounts without rounding', () => {
  for (const [input, expected] of [['10000', '10,000'], ['70000', '70,000'], ['1234567', '1,234,567'],
    ['10,000', '10,000'], ['10', '10'], ['0', '0'], ['', ''], ['9007199254740993', '9,007,199,254,740,993']]) {
    assert.equal(formatIntegerInput(input).value, expected);
  }
  assert.equal(formatIntegerInput('10.5').value, '10.5');
  assert.equal(formatIntegerInput('-10').value, '-10');
});

test('formatting preserves the digit position for mid-value edits and selections', () => {
  assert.deepEqual(formatIntegerInput('12345', 2, 4), { value: '12,345', start: 2, end: 5 });
  assert.deepEqual(formatIntegerInput('1,2345', 6), { value: '12,345', start: 6, end: 6 });
  assert.deepEqual(formatIntegerInput('', 0), { value: '', start: 0, end: 0 });
});

test('formatted fields submit safe integers and preserve blank or invalid values as errors', () => {
  assert.equal(parseIntegerInput('10,000'), 10000);
  assert.equal(parseIntegerInput('70,000'), 70000);
  assert.equal(parseIntegerInput('10'), 10);
  assert.equal(parseIntegerInput('0'), 0);
  for (const input of ['', ' ', '10.5', '-10', 'abc', '1e3', '1,,000', '9,007,199,254,740,993']) {
    assert.equal(parseIntegerInput(input), null, input);
  }
});

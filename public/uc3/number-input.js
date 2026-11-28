// Integer display formatting only. Server-side voucher validation remains authoritative.
// Author: Thin Lei Sandi (523K0075).
export function formatIntegerInput(value, start = value.length, end = start) {
  if (!/^[\d,]*$/.test(value)) return { value, start, end };
  const digits = value.replaceAll(',', '');
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function position(index) {
    const count = value.slice(0, index).replaceAll(',', '').length;
    if (!count) return 0;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] !== ',' && ++seen === count) return i + 1;
    }
    return formatted.length;
  }
  return { value: formatted, start: position(start), end: position(end) };
}
export function parseIntegerInput(value) {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) return null;
  const number = Number(value.replaceAll(',', ''));
  return Number.isSafeInteger(number) ? number : null;
}
export function enableIntegerFormatting(input) {
  input.type = 'text';
  input.inputMode = 'numeric';
  input.value = formatIntegerInput(input.value).value;
  function update(event) {
    if (event.isComposing) return;
    const result = formatIntegerInput(input.value, input.selectionStart ?? 0, input.selectionEnd ?? 0);
    input.value = result.value;
    input.setSelectionRange(result.start, result.end);
  }
  input.addEventListener('input', update);
  input.addEventListener('compositionend', update);
}

// Смета: читаем поля, пересчитываем строки и обновляем общий итог.
const estimateItems = document.getElementById('estimate-items');
const rowTemplate = document.getElementById('estimate-row-template');
const addItemButton = document.getElementById('add-item');
const estimateTotal = document.getElementById('estimate-total');
const discountInput = document.getElementById('estimate-discount');
const vatInput = document.getElementById('estimate-vat');
const currencyInput = document.getElementById('estimate-currency');
const moneyFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

// Поддерживаем десятичную запятую и пробелы в записи «15 000».
function readNumber(value) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  const rounded = Math.round(value);
  return Number.isFinite(rounded) ? rounded : 0;
}

function formatMoney(value) {
  return `${moneyFormat.format(value)} ${currencyInput.value}`;
}

function updateEstimate() {
  let total = 0;
  for (const row of estimateItems.rows) {
    const quantity = readNumber(row.querySelector('.item-quantity').value);
    const price = readNumber(row.querySelector('.item-price').value);
    const sum = roundMoney(quantity * price);
    row.querySelector('.item-sum').textContent = formatMoney(sum);
    total = roundMoney(total + sum);
  }
  // Сначала скидка от суммы позиций, затем НДС от суммы со скидкой.
  const discountRate = Math.min(100, readNumber(discountInput.value));
  const vatRate = readNumber(vatInput.value);
  const discount = roundMoney(total * (discountRate / 100));
  const discounted = roundMoney(total - discount);
  const vat = roundMoney(discounted * (vatRate / 100));

  document.getElementById('estimate-subtotal').textContent = formatMoney(total);
  document.getElementById('discount-amount').textContent = formatMoney(discount);
  document.getElementById('discounted-amount').textContent = formatMoney(discounted);
  document.getElementById('vat-amount').textContent = formatMoney(vat);
  document.getElementById('discount-row').hidden = discount === 0;
  document.getElementById('discounted-row').hidden = discounted === 0;
  document.getElementById('vat-row').hidden = vat === 0;
  estimateTotal.textContent = formatMoney(roundMoney(discounted + vat));

  // Меняем знак и в заголовках таблицы, и в подписях мобильных карточек.
  document.querySelectorAll('[data-currency]').forEach((label) => {
    label.textContent = currencyInput.value;
  });
}

function addEstimateRow(focus = true) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  estimateItems.appendChild(row);
  updateEstimate();
  if (focus) row.querySelector('.item-name').focus();
  return row;
}

addItemButton.addEventListener('click', () => addEstimateRow());
estimateItems.addEventListener('input', updateEstimate);
discountInput.addEventListener('input', () => {
  if (readNumber(discountInput.value) > 100) discountInput.value = '100';
  updateEstimate();
});
vatInput.addEventListener('input', updateEstimate);
currencyInput.addEventListener('change', updateEstimate);

estimateItems.addEventListener('click', (event) => {
  const removeButton = event.target.closest('.item-remove');
  if (!removeButton) return;
  const row = removeButton.closest('tr');
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  if (estimateItems.rows.length === 0) {
    addEstimateRow();
  } else {
    updateEstimate();
    nextRow.querySelector('.item-name').focus();
  }
});

estimateItems.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing || event.target.tagName !== 'INPUT') return;
  if (event.target.closest('tr') === estimateItems.lastElementChild) {
    event.preventDefault();
    addEstimateRow();
  }
});

// Локальная дата компьютера: без сдвига дня из-за UTC.
const today = new Date();
document.getElementById('estimate-date').value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
].join('-');
addEstimateRow(false);

// Перед печатью создаём обычный текст вместо полей: длинные значения не обрежутся.
function prepareEstimatePrint() {
  updateEstimate();
  const number = document.getElementById('estimate-number').value.trim() || '—';
  const date = document.getElementById('estimate-date').value;
  const printDate = date ? date.split('-').reverse().join('.') : '—';
  document.getElementById('print-title').textContent = `Смета № ${number} от ${printDate}`;

  document.querySelectorAll('.print-value').forEach((value) => value.remove());
  document.querySelectorAll('.estimate-details input, #estimate-items input, #estimate-items select, #estimate-comment').forEach((field) => {
    const value = document.createElement('span');
    value.className = 'print-only print-value';
    value.textContent = (field.type === 'date' ? printDate : field.value.trim()) || '—';
    field.insertAdjacentElement('afterend', value);
  });
}

// beforeprint работает и при нажатии Ctrl+P, и при печати через меню браузера.
window.addEventListener('beforeprint', prepareEstimatePrint);
document.getElementById('save-pdf').addEventListener('click', () => {
  prepareEstimatePrint();
  window.print();
});

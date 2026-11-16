// Смета: читаем поля, пересчитываем строки и обновляем общий итог.
let draftReady = false;
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
  if (draftReady) saveEstimateDraft();
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
  if (draftReady) saveEstimateDraft();
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

// Черновик хранится только в localStorage текущего браузера.
const draftStorageKey = 'smeta-five-minutes.draft.v1';
const draftFieldIds = [
  'estimate-from', 'estimate-to', 'estimate-number', 'estimate-date',
  'estimate-discount', 'estimate-vat', 'estimate-currency', 'estimate-comment'
];
const draftStatus = document.getElementById('draft-status');
const copyStatus = document.getElementById('copy-status');
const manualCopy = document.getElementById('manual-copy');
const copyText = document.getElementById('copy-text');
let copyStatusTimer;

function collectEstimateDraft() {
  return {
    version: 1,
    fields: Object.fromEntries(draftFieldIds.map((id) => [id, document.getElementById(id).value])),
    items: Array.from(estimateItems.rows, (row) => ({
      name: row.querySelector('.item-name').value,
      quantity: row.querySelector('.item-quantity').value,
      unit: row.querySelector('.item-unit').value,
      price: row.querySelector('.item-price').value
    }))
  };
}

function saveEstimateDraft() {
  try {
    window.localStorage.setItem(draftStorageKey, JSON.stringify(collectEstimateDraft()));
    draftStatus.textContent = 'Черновик сохранён в этом браузере.';
  } catch {
    draftStatus.textContent = 'Браузер не разрешил сохранить черновик. Данные останутся на странице до её закрытия или обновления.';
  }
}

function restoreEstimateDraft() {
  try {
    const stored = window.localStorage.getItem(draftStorageKey);
    if (!stored) return;
    const draft = JSON.parse(stored);
    // Проверяем данные до изменения страницы: повреждённый черновик не ломает смету.
    if (!draft || draft.version !== 1 || !draft.fields || !Array.isArray(draft.items) || draft.items.length === 0 ||
        !draftFieldIds.every((id) => typeof draft.fields[id] === 'string') ||
        !['₸', '₽', '$', '€'].includes(draft.fields['estimate-currency']) ||
        !draft.items.every((item) => item && ['name', 'quantity', 'unit', 'price'].every((key) => typeof item[key] === 'string') &&
          ['шт', 'час', 'услуга'].includes(item.unit))) {
      throw new Error('Неверный формат черновика');
    }
    for (const id of draftFieldIds) document.getElementById(id).value = draft.fields[id];
    estimateItems.replaceChildren();
    for (const item of draft.items) {
      const row = addEstimateRow(false);
      row.querySelector('.item-name').value = item.name;
      row.querySelector('.item-quantity').value = item.quantity;
      row.querySelector('.item-unit').value = item.unit;
      row.querySelector('.item-price').value = item.price;
    }
    updateEstimate();
    draftStatus.textContent = 'Черновик восстановлен.';
  } catch {
    draftStatus.textContent = 'Не удалось прочитать черновик. Можно продолжить работу; для сохранения браузер должен разрешать localStorage.';
  }
}

// Ввод текста и изменение выбора сохраняются сразу, без таймера.
for (const eventName of ['input', 'change']) {
  document.getElementById('estimate').addEventListener(eventName, (event) => {
    if (draftReady && event.target.id !== 'copy-text') saveEstimateDraft();
  });
}

function nextEstimateNumber(value) {
  const match = value.trim().match(/^(.*?)(\d+)$/);
  if (!match) return '1';
  return match[1] + (BigInt(match[2]) + 1n).toString().padStart(match[2].length, '0');
}

document.getElementById('new-estimate').addEventListener('click', () => {
  if (!window.confirm('Создать новую смету? Текущие поля и позиции будут очищены.')) return;
  const nextNumber = nextEstimateNumber(document.getElementById('estimate-number').value);
  draftReady = false;
  for (const id of draftFieldIds) document.getElementById(id).value = '';
  document.getElementById('estimate-number').value = nextNumber;
  const date = new Date();
  document.getElementById('estimate-date').value = [
    date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')
  ].join('-');
  discountInput.value = '0';
  vatInput.value = '0';
  currencyInput.value = '₸';
  estimateItems.replaceChildren();
  addEstimateRow();
  document.querySelectorAll('.print-value').forEach((value) => value.remove());
  manualCopy.hidden = true;
  copyText.value = '';
  window.clearTimeout(copyStatusTimer);
  copyStatus.textContent = '';
  draftReady = true;
  saveEstimateDraft();
});

function buildWhatsAppText() {
  updateEstimate();
  const number = document.getElementById('estimate-number').value.trim() || '—';
  const date = document.getElementById('estimate-date').value;
  const lines = [`Смета № ${number} от ${date ? date.split('-').reverse().join('.') : '—'}`];
  for (const [id, label] of [['estimate-from', 'От кого'], ['estimate-to', 'Для кого']]) {
    const value = document.getElementById(id).value.trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push('');
  const quantityFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 20 });
  for (const row of estimateItems.rows) {
    const name = row.querySelector('.item-name').value.trim();
    const quantity = row.querySelector('.item-quantity').value;
    const price = row.querySelector('.item-price').value;
    if (!name && !quantity.trim() && !price.trim()) continue;
    const unit = row.querySelector('.item-unit').value;
    lines.push(`• ${name || 'Без названия'} — ${quantityFormat.format(readNumber(quantity))} ${unit} × ${formatMoney(readNumber(price))} = ${row.querySelector('.item-sum').textContent}`);
  }
  lines.push('', `Сумма: ${document.getElementById('estimate-subtotal').textContent}`);
  if (!document.getElementById('discount-row').hidden) {
    lines.push(`Скидка (${Math.min(100, readNumber(discountInput.value))}%): ${document.getElementById('discount-amount').textContent}`);
    lines.push(`Сумма со скидкой: ${document.getElementById('discounted-amount').textContent}`);
  }
  if (!document.getElementById('vat-row').hidden) {
    lines.push(`НДС (${readNumber(vatInput.value)}%): ${document.getElementById('vat-amount').textContent}`);
  }
  lines.push(`Итого к оплате: ${estimateTotal.textContent}`);
  const comment = document.getElementById('estimate-comment').value.trim();
  if (comment) lines.push('', `Комментарий: ${comment}`);
  return lines.join('\n').replace(/[\u00a0\u202f]/g, ' ');
}

document.getElementById('copy-whatsapp').addEventListener('click', async () => {
  const text = buildWhatsAppText();
  window.clearTimeout(copyStatusTimer);
  copyStatus.textContent = '';
  manualCopy.hidden = true;
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Копирование недоступно');
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = 'Скопировано ✓';
    copyStatusTimer = window.setTimeout(() => { copyStatus.textContent = ''; }, 2000);
  } catch {
    manualCopy.hidden = false;
    copyText.value = text;
    copyText.focus();
    copyText.select();
    copyStatus.textContent = 'Скопируйте текст вручную из поля ниже.';
  }
});

if (!document.getElementById('estimate-number').value) document.getElementById('estimate-number').value = '1';
restoreEstimateDraft();
draftReady = true;


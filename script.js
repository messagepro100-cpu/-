// Смета: читаем поля, пересчитываем строки и обновляем общий итог.
const estimateItems = document.getElementById('estimate-items');
const rowTemplate = document.getElementById('estimate-row-template');
const addItemButton = document.getElementById('add-item');
const estimateTotal = document.getElementById('estimate-total');
const moneyFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

// Поддерживаем десятичную запятую и пробелы в записи «15 000».
function readNumber(value) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isFinite(rounded) ? rounded : 0;
}

function formatMoney(value) {
  return `${moneyFormat.format(value)} ₸`;
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
  estimateTotal.textContent = formatMoney(total);
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

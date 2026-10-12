(() => {
  'use strict';

  const STORAGE_KEY = 'invovera-draft-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const form = $('#documentForm');
  const itemsEditor = $('#itemsEditor');
  const toast = $('#toast');
  let documentType = 'invoice';
  let toastTimer;

  const fieldIds = [
    'businessName', 'businessAddress', 'businessEmail', 'businessPhone',
    'clientName', 'clientAddress', 'clientEmail', 'documentNumber',
    'issueDate', 'dueDate', 'currency', 'discount', 'tax', 'notes', 'paymentDetails'
  ];

  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const addDaysISO = (iso, days) => {
    const date = new Date(`${iso || todayISO()}T12:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const escapeForInput = (value) => String(value ?? '');

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function readItems() {
    return $$('.item-editor-row', itemsEditor).map((row) => ({
      name: $('.item-name-input', row).value.trim(),
      quantity: Math.max(0, numberFrom($('.item-qty-input', row).value)),
      rate: Math.max(0, numberFrom($('.item-rate-input', row).value))
    }));
  }

  function numberFrom(value) {
    const num = Number.parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  }

  function createItemRow(item = {}) {
    const row = document.createElement('div');
    row.className = 'item-editor-row';

    const top = document.createElement('div');
    top.className = 'item-editor-top';

    const nameWrap = document.createElement('label');
    const nameLabel = document.createElement('span');
    nameLabel.className = 'item-mini-label';
    nameLabel.textContent = 'Item / service';
    const nameInput = document.createElement('input');
    nameInput.className = 'item-name-input';
    nameInput.type = 'text';
    nameInput.maxLength = 120;
    nameInput.placeholder = 'Website design';
    nameInput.value = escapeForInput(item.name);
    nameInput.setAttribute('aria-label', 'Item or service name');
    nameWrap.append(nameLabel, nameInput);

    const qtyWrap = document.createElement('label');
    const qtyLabel = document.createElement('span');
    qtyLabel.className = 'item-mini-label';
    qtyLabel.textContent = 'Qty';
    const qtyInput = document.createElement('input');
    qtyInput.className = 'item-qty-input';
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.step = '0.01';
    qtyInput.value = item.quantity ?? 1;
    qtyInput.setAttribute('aria-label', 'Quantity');
    qtyWrap.append(qtyLabel, qtyInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'item-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove item';
    removeBtn.setAttribute('aria-label', 'Remove item');
    removeBtn.addEventListener('click', () => {
      if ($$('.item-editor-row', itemsEditor).length === 1) {
        $('.item-name-input', row).value = '';
        $('.item-qty-input', row).value = '1';
        $('.item-rate-input', row).value = '0';
        updateEverything();
        showToast('At least one item row is kept for convenience.');
        return;
      }
      row.remove();
      updateEverything();
    });
    top.append(nameWrap, qtyWrap, removeBtn);

    const bottom = document.createElement('div');
    bottom.className = 'item-editor-bottom';
    const rateWrap = document.createElement('label');
    const rateLabel = document.createElement('span');
    rateLabel.className = 'item-mini-label';
    rateLabel.textContent = 'Rate per unit';
    const rateInput = document.createElement('input');
    rateInput.className = 'item-rate-input';
    rateInput.type = 'number';
    rateInput.min = '0';
    rateInput.step = '0.01';
    rateInput.value = item.rate ?? 0;
    rateInput.setAttribute('aria-label', 'Rate per unit');
    rateWrap.append(rateLabel, rateInput);

    const amountWrap = document.createElement('div');
    const amountLabel = document.createElement('span');
    amountLabel.className = 'item-mini-label';
    amountLabel.textContent = 'Line amount';
    const amountValue = document.createElement('input');
    amountValue.readOnly = true;
    amountValue.className = 'item-line-amount';
    amountValue.value = '0.00';
    amountValue.setAttribute('aria-label', 'Calculated line amount');
    amountWrap.append(amountLabel, amountValue);
    bottom.append(rateWrap, amountWrap);

    row.append(top, bottom);
    row.addEventListener('input', updateEverything);
    itemsEditor.append(row);
  }

  function getCurrencyInfo() {
    const currency = $('#currency').value || 'BDT';
    const config = {
      BDT: { code: 'BDT', symbol: '৳', locale: 'en-BD' },
      USD: { code: 'USD', symbol: '$', locale: 'en-US' },
      EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
      GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
      INR: { code: 'INR', symbol: '₹', locale: 'en-IN' }
    };
    return config[currency] || config.BDT;
  }

  function money(amount) {
    const { code, locale, symbol } = getCurrencyInfo();
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeAmount);
    } catch {
      return `${symbol}${safeAmount.toFixed(2)}`;
    }
  }

  function formatDate(isoDate) {
    if (!isoDate) return '—';
    const date = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  function setText(selector, value) {
    $(selector).textContent = value;
  }

  function renderPreview() {
    const values = Object.fromEntries(fieldIds.map((id) => [id, $(`#${id}`).value]));
    const items = readItems();
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const discountRate = Math.min(100, Math.max(0, numberFrom(values.discount)));
    const taxRate = Math.min(100, Math.max(0, numberFrom(values.tax)));
    const discountAmount = subtotal * discountRate / 100;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxableAmount * taxRate / 100;
    const grandTotal = taxableAmount + taxAmount;
    const typeTitle = documentType === 'invoice' ? 'INVOICE' : 'QUOTATION';

    setText('#previewBusinessName', values.businessName.trim() || 'Your Business Name');
    setText('#previewBusinessMeta', values.businessAddress.trim());
    const contactParts = [values.businessEmail.trim(), values.businessPhone.trim()].filter(Boolean);
    setText('#previewBusinessContact', contactParts.join('  ·  '));
    setText('#previewDocLabel', typeTitle);
    setText('#previewDocNumber', values.documentNumber.trim() || (documentType === 'invoice' ? 'INV-2026-001' : 'QUO-2026-001'));
    setText('#previewStatus', documentType === 'invoice' ? 'PAYMENT REQUEST' : 'ESTIMATE · NOT A TAX INVOICE');
    setText('#previewClientName', values.clientName.trim() || 'Client / Company Name');
    setText('#previewClientAddress', values.clientAddress.trim() || 'Client address will appear here');
    setText('#previewClientEmail', values.clientEmail.trim());
    setText('#previewIssueDate', formatDate(values.issueDate));
    setText('#previewDueLabel', documentType === 'invoice' ? 'DUE DATE' : 'VALID UNTIL');
    setText('#previewDueDate', formatDate(values.dueDate));
    setText('#previewGrandLabel', documentType === 'invoice' ? 'TOTAL DUE' : 'ESTIMATED TOTAL');
    setText('#previewNotesHeading', documentType === 'invoice' ? 'NOTES' : 'SCOPE / TERMS');
    setText('#previewNotes', values.notes.trim());
    setText('#previewPaymentDetails', values.paymentDetails.trim());
    setText('#previewFooterBrand', values.businessName.trim() || 'Your Business Name');
    setText('#previewCurrencyNote', `All amounts in ${getCurrencyInfo().code}`);
    setText('#previewDiscountPct', discountRate.toString());
    setText('#previewTaxPct', taxRate.toString());
    setText('#previewSubtotal', money(subtotal));
    setText('#previewDiscount', `− ${money(discountAmount)}`);
    setText('#previewTax', money(taxAmount));
    setText('#previewGrandTotal', money(grandTotal));
    $('#previewDiscountRow').hidden = discountRate === 0;
    $('#previewTaxRow').hidden = taxRate === 0;
    $('#previewNotesBlock').hidden = !values.notes.trim();
    $('#previewPaymentBlock').hidden = !values.paymentDetails.trim();

    const previewItems = $('#previewItems');
    previewItems.replaceChildren();
    const populatedItems = items.filter((item) => item.name || item.quantity || item.rate);
    const visibleItems = populatedItems.length ? populatedItems : [{ name: 'Your product or service', quantity: 1, rate: 0 }];
    visibleItems.forEach((item) => {
      const tr = document.createElement('tr');
      const desc = document.createElement('td');
      desc.textContent = item.name || 'Untitled item';
      if (!item.name) desc.classList.add('preview-empty');
      const qty = document.createElement('td');
      qty.textContent = Number.isInteger(item.quantity) ? String(item.quantity) : String(Number(item.quantity.toFixed(2)));
      const rate = document.createElement('td');
      rate.textContent = money(item.rate);
      const amount = document.createElement('td');
      amount.textContent = money(item.quantity * item.rate);
      tr.append(desc, qty, rate, amount);
      previewItems.append(tr);
    });
  }

  function saveDraft(silent = true) {
    try {
      const data = {
        documentType,
        fields: Object.fromEntries(fieldIds.map((id) => [id, $(`#${id}`).value])),
        items: readItems()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (!silent) showToast('Draft saved in this browser.');
      return true;
    } catch (error) {
      if (!silent) showToast('Could not save draft. Browser storage may be unavailable.');
      return false;
    }
  }

  function updateEverything() {
    // Keep discount and tax inside supported ranges even if values are typed manually.
    ['discount', 'tax'].forEach((id) => {
      const input = $(`#${id}`);
      const value = numberFrom(input.value);
      if (input.value !== '' && (value < 0 || value > 100)) input.value = String(Math.min(100, Math.max(0, value)));
    });
    $$('.item-editor-row', itemsEditor).forEach((row) => {
      const qty = Math.max(0, numberFrom($('.item-qty-input', row).value));
      const rate = Math.max(0, numberFrom($('.item-rate-input', row).value));
      $('.item-line-amount', row).value = money(qty * rate);
    });
    renderPreview();
    saveDraft(true);
  }

  function setDocumentType(type, showMessage = false) {
    documentType = type === 'quotation' ? 'quotation' : 'invoice';
    $$('.switch-option').forEach((button) => {
      const active = button.dataset.docType === documentType;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('#documentNumber').value = documentType === 'invoice' ? 'INV-2026-001' : 'QUO-2026-001';
    $('#dueDateLabel').textContent = documentType === 'invoice' ? 'Due date' : 'Valid until';
    $('#notes').placeholder = documentType === 'invoice' ? 'Thank you for your business.' : 'Outline the scope, delivery, or quotation terms.';
    updateEverything();
    if (showMessage) showToast(`${documentType === 'invoice' ? 'Invoice' : 'Quotation'} mode selected.`);
  }

  function resetDocument() {
    const confirmed = window.confirm('Reset this document and clear its saved draft?');
    if (!confirmed) return;
    form.reset();
    const today = todayISO();
    $('#issueDate').value = today;
    $('#dueDate').value = addDaysISO(today, 7);
    $('#documentNumber').value = 'INV-2026-001';
    documentType = 'invoice';
    itemsEditor.replaceChildren();
    createItemRow({ name: 'Website design', quantity: 1, rate: 15000 });
    createItemRow({ name: 'Maintenance & support', quantity: 1, rate: 5000 });
    saveDraft(true);
    $$('.switch-option').forEach((button) => {
      const active = button.dataset.docType === 'invoice';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('#dueDateLabel').textContent = 'Due date';
    $('#notes').placeholder = 'Thank you for your business.';
    updateEverything();
    showToast('A fresh sample document is ready.');
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.fields) return false;
      fieldIds.forEach((id) => {
        const el = $(`#${id}`);
        if (Object.prototype.hasOwnProperty.call(data.fields, id) && data.fields[id] !== null) {
          el.value = String(data.fields[id]);
        }
      });
      documentType = data.documentType === 'quotation' ? 'quotation' : 'invoice';
      itemsEditor.replaceChildren();
      const items = Array.isArray(data.items) ? data.items.slice(0, 50) : [];
      (items.length ? items : [{ name: 'Website design', quantity: 1, rate: 15000 }]).forEach(createItemRow);
      $$('.switch-option').forEach((button) => {
        const active = button.dataset.docType === documentType;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      $('#dueDateLabel').textContent = documentType === 'invoice' ? 'Due date' : 'Valid until';
      $('#notes').placeholder = documentType === 'invoice' ? 'Thank you for your business.' : 'Outline the scope, delivery, or quotation terms.';
      return true;
    } catch {
      return false;
    }
  }

  function printDocument() {
    saveDraft(true);
    window.print();
  }

  $('#addItemBtn').addEventListener('click', () => {
    if ($$('.item-editor-row', itemsEditor).length >= 50) {
      showToast('You can add up to 50 items per document.');
      return;
    }
    createItemRow({ name: '', quantity: 1, rate: 0 });
    updateEverything();
    const inputs = $$('.item-editor-row', itemsEditor);
    $('.item-name-input', inputs[inputs.length - 1]).focus();
  });

  $$('.switch-option').forEach((button) => button.addEventListener('click', () => {
    const type = button.dataset.docType;
    if (type === documentType) return;
    setDocumentType(type, true);
  }));
  form.addEventListener('input', updateEverything);
  form.addEventListener('change', updateEverything);
  $('#topPrintBtn').addEventListener('click', printDocument);
  $('#resetBtn').addEventListener('click', resetDocument);
  $('#clearSavedBtn').addEventListener('click', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      showToast('Saved draft cleared. Your current document is still open.');
    } catch {
      showToast('Browser storage could not be cleared.');
    }
  });
  window.addEventListener('beforeprint', renderPreview);

  // Initialize dates and example line items, then restore the previous local draft if available.
  const today = todayISO();
  $('#issueDate').value = today;
  $('#dueDate').value = addDaysISO(today, 7);
  createItemRow({ name: 'Website design', quantity: 1, rate: 15000 });
  createItemRow({ name: 'Maintenance & support', quantity: 1, rate: 5000 });
  const restored = restoreDraft();
  if (restored) showToast('Your last local draft has been restored.');
  setText('#footerYear', String(new Date().getFullYear()));
  updateEverything();
})();

/******************************
*******************************
	Author: Isaak S. Hayes
	April 2013, reworked October 2026
*******************************
*******************************/

(function () {
	'use strict';

	var STORE_KEY = 'tallyup.v1';

	var itemsEl = document.getElementById('items');
	// x_cookie.html and x_array.html also load this file. Do nothing there.
	if (!itemsEl) { return; }

	var totalEl    = document.getElementById('total');
	var nameEl     = document.getElementById('calcName');
	var currencyEl = document.getElementById('currency');
	var formEl     = document.getElementById('newItem');
	var amountEl   = document.getElementById('newAmount');
	var labelEl    = document.getElementById('newLabel');
	var emptyEl    = document.getElementById('empty');

	var state  = load();
	var dragId = null;

	// ---------- Storage ----------

	function load() {
		var fallback = { name: 'My Monthly Budget', currency: 'USD', items: [] };
		try {
			var saved = JSON.parse(localStorage.getItem(STORE_KEY));
			if (!saved || !Array.isArray(saved.items)) { return fallback; }
			return {
				name: typeof saved.name === 'string' ? saved.name : fallback.name,
				currency: typeof saved.currency === 'string' ? saved.currency : fallback.currency,
				items: saved.items.map(function (it) {
					return { id: String(it.id || newId()), amount: String(it.amount || ''), label: String(it.label || '') };
				})
			};
		} catch (e) {
			return fallback;
		}
	}

	function save() {
		try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode, storage full */ }
	}

	function newId() {
		return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	}

	// ---------- Money ----------

	// Returns a number, 0 for empty input, NaN for input that is not a number.
	function parseAmount(text) {
		var cleaned = String(text).replace(/,/g, '').trim().replace(/^[^\d.\-]+/, '');
		if (cleaned === '') { return String(text).trim() === '' ? 0 : NaN; }
		return Number(cleaned);
	}

	function formatMoney(n) {
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency: state.currency }).format(n);
		} catch (e) {
			return n.toFixed(2);
		}
	}

	function updateTotal() {
		var cents = 0;
		state.items.forEach(function (it) {
			var n = parseAmount(it.amount);
			if (!isNaN(n)) { cents += Math.round(n * 100); }
		});
		totalEl.textContent = formatMoney(cents / 100);
	}

	// ---------- Rendering ----------

	function el(tag, className) {
		var node = document.createElement(tag);
		if (className) { node.className = className; }
		return node;
	}

	function buildRow(item) {
		var row = el('section', 'tag');
		row.dataset.id = item.id;

		var handle = el('span', 'handle');
		handle.textContent = '\u2807';
		handle.title = 'Drag to reorder';
		handle.setAttribute('aria-hidden', 'true');

		var amount = el('input', 'moneyValue');
		amount.type = 'text';
		amount.inputMode = 'decimal';
		amount.value = item.amount;
		amount.placeholder = 'Amount';
		amount.setAttribute('aria-label', 'Amount');
		amount.classList.toggle('invalid', isNaN(parseAmount(item.amount)));

		var label = el('input', 'labelValue');
		label.type = 'text';
		label.value = item.label;
		label.placeholder = 'Label';
		label.setAttribute('aria-label', 'Label');

		var remove = el('button', 'red button');
		remove.type = 'button';
		remove.textContent = '\u2715';
		remove.title = 'Remove';
		remove.setAttribute('aria-label', 'Remove item');

		row.appendChild(handle);
		row.appendChild(amount);
		row.appendChild(label);
		row.appendChild(remove);

		// Edit in place. No re-render here, or the field would lose focus.
		amount.addEventListener('input', function () {
			item.amount = amount.value;
			amount.classList.toggle('invalid', isNaN(parseAmount(amount.value)));
			updateTotal();
			save();
		});

		// Tidy to two decimals when leaving the field
		amount.addEventListener('change', function () {
			var n = parseAmount(amount.value);
			if (!isNaN(n) && amount.value.trim() !== '') {
				amount.value = n.toFixed(2);
				item.amount = amount.value;
				updateTotal();
				save();
			}
		});

		label.addEventListener('input', function () {
			item.label = label.value;
			save();
		});

		remove.addEventListener('click', function () {
			state.items = state.items.filter(function (it) { return it.id !== item.id; });
			render();
			save();
		});

		// Drag to reorder. Only the handle starts a drag, so text in the
		// inputs stays selectable.
		handle.addEventListener('mousedown', function () { row.draggable = true; });
		handle.addEventListener('touchstart', function () { row.draggable = true; }, { passive: true });

		row.addEventListener('dragstart', function (e) {
			dragId = item.id;
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', item.id); // Firefox needs data set
			row.classList.add('dragging');
		});

		row.addEventListener('dragend', function () {
			dragId = null;
			row.draggable = false;
			row.classList.remove('dragging');
			clearDropMarks();
		});

		row.addEventListener('dragover', function (e) {
			if (dragId && dragId !== item.id) {
				e.preventDefault();
				row.classList.add('drop-target');
			}
		});

		row.addEventListener('dragleave', function () {
			row.classList.remove('drop-target');
		});

		row.addEventListener('drop', function (e) {
			e.preventDefault();
			if (dragId && dragId !== item.id) { move(dragId, item.id); }
			clearDropMarks();
		});

		return row;
	}

	function clearDropMarks() {
		var marked = itemsEl.querySelectorAll('.drop-target');
		for (var i = 0; i < marked.length; i++) { marked[i].classList.remove('drop-target'); }
	}

	function move(fromId, toId) {
		var from = indexOfId(fromId);
		var to = indexOfId(toId);
		if (from < 0 || to < 0 || from === to) { return; }
		var moved = state.items.splice(from, 1)[0];
		state.items.splice(to, 0, moved);
		render();
		save();
	}

	function indexOfId(id) {
		for (var i = 0; i < state.items.length; i++) {
			if (state.items[i].id === id) { return i; }
		}
		return -1;
	}

	function render() {
		itemsEl.textContent = '';
		state.items.forEach(function (it) { itemsEl.appendChild(buildRow(it)); });
		emptyEl.hidden = state.items.length > 0;
		updateTotal();
	}

	// ---------- Events ----------

	formEl.addEventListener('submit', function (e) {
		e.preventDefault();
		var raw = amountEl.value.trim();
		var n = parseAmount(raw);
		if (raw === '' || isNaN(n)) {
			amountEl.classList.add('invalid');
			amountEl.focus();
			return;
		}
		state.items.unshift({ id: newId(), amount: n.toFixed(2), label: labelEl.value.trim() });
		amountEl.value = '';
		labelEl.value = '';
		amountEl.classList.remove('invalid');
		render();
		save();
		amountEl.focus();
	});

	amountEl.addEventListener('input', function () {
		amountEl.classList.remove('invalid');
	});

	nameEl.addEventListener('input', function () {
		state.name = nameEl.value;
		save();
	});

	currencyEl.addEventListener('change', function () {
		state.currency = currencyEl.value;
		updateTotal();
		save();
	});

	// Tabs other than Calculate are placeholders for now
	document.querySelector('nav').addEventListener('click', function (e) {
		if (e.target.closest('a')) { e.preventDefault(); }
	});

	// ---------- Start ----------

	nameEl.value = state.name;
	currencyEl.value = state.currency;
	render();
}());

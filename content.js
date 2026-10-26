// BurgerShop POD Helper — panel nổi trên admin.burgershop.io
// Bước 1: Create POD product → chọn loại áo → Save (trong hộp thoại)
// Bước 2: chọn đúng các màu đã cấu hình
// (bạn tự upload design + bấm Save)
// Bước 3: điền Title, Description, Price = Compare price, chọn Tags
(() => {
  if (window.__podHelperLoaded) return;
  window.__podHelperLoaded = true;

  // Danh sách màu của Comfort Colors 1717 (lấy từ ảnh chụp). Bấm "Quét màu" để cập nhật theo trang.
  const DEFAULT_COLORS = [
    'Bay', 'Blue Jean', 'Blue Spruce', 'Brick', 'Chalky Mint', 'Chambray',
    'Chili', 'Crimson', 'Crunchberry', 'Flo Blue', 'Granite', 'Graphite',
    'Grey', 'Ice Blue', 'Ivory', 'Light Green', 'Moss', 'Mustard',
    'Mystic Blue', 'Orchid', 'Pepper', 'Periwinkle', 'Sandstone', 'Seafoam',
    'Watermelon', 'Yam', 'Berry', 'Banana', 'Denim', 'Red',
    'White', 'Hemp', 'Black', 'Blossom', 'Navy', 'Violet',
    'Butter', 'Midnight', 'Sage',
  ];
  const COLOR_LIMIT = 12;

  const DEFAULTS = {
    productName: 'Unisex T-Shirt | Comfort Colors 1717 (US)',
    searchKeyword: 'comfort colors 1717',
    availableColors: DEFAULT_COLORS,
    colors: [],
    autoColors: true, // chạy luôn bước 2 sau bước 1
    title: '',
    description: '',
    price: '',
    comparePrice: '',
    availableTags: [],
    tags: [],
    collapsed: false,
    pos: null, // {left, top} khi đã kéo panel đi chỗ khác
  };

  let cfg = { ...DEFAULTS };
  let busy = false;

  // ---------- tiện ích ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const lc = (s) => norm(s).toLowerCase();
  const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  async function waitFor(fn, timeout = 15000, interval = 200) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  }

  // Cuộn el xuống một đoạn. Trả false khi đã tới đáy hoặc cuộn không nhích được nữa
  // (trước đây chỉ dựa vào "tới đáy" nên có lúc lặp vô ích hàng phút).
  async function scrollStep(el, step, wait = 150) {
    if (!el || el.scrollTop + el.clientHeight >= el.scrollHeight - 5) return false;
    const before = el.scrollTop;
    el.scrollTop = before + step;
    el.dispatchEvent(new Event('scroll'));
    await sleep(wait);
    return el.scrollTop > before + 1;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function textToHtml(text) {
    if (/<\/?[a-z][\s\S]*>/i.test(text)) return text; // đã là HTML thì giữ nguyên
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text
      .split(/\n{2,}/)
      .map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>')
      .join('');
  }

  // Chưa đọc xong cấu hình thì không lưu (tránh ghi DEFAULTS đè lên bản đã lưu).
  // ownWrites: các bản chính tab này vừa ghi, để onChanged bỏ qua "tiếng vọng" của mình.
  let loaded = false;
  const ownWrites = new Set();
  const save = () => {
    if (!loaded) return;
    ownWrites.add(JSON.stringify(cfg));
    chrome.storage.local.set({ podHelper: cfg });
  };

  // ---------- log + danh sách lỗi cần chỉnh tay ----------
  // Mỗi bước có danh sách riêng; chạy lại bước nào thì danh sách bước đó được làm mới.
  // Mọi log 'err'/'warn' trong lúc chạy một bước cũng tự vào danh sách của bước đó.
  const STEP_NAMES = { s1: '① Chọn áo', s2: '② Màu', s3: '③ Thông tin' };
  const issues = { s1: null, s2: null, s3: null }; // null = chưa kiểm tra
  let currentStep = null;
  let logEl;
  let statusEl;
  // Dòng trạng thái "đang làm gì" ngay dưới các nút
  function status(text) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.hidden = !text;
  }
  function log(msg, type = '') {
    if (currentStep && (type === 'err' || type === 'warn')) addIssue(currentStep, msg);
    if (!logEl) return;
    const line = document.createElement('div');
    line.className = 'pod-log-line ' + type;
    line.textContent = new Date().toLocaleTimeString('vi-VN') + '  ' + msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function addIssue(step, msg) {
    (issues[step] = issues[step] || []).push(msg);
    renderIssues();
  }
  // Chạy fn như "bước step": xoá lỗi cũ của bước, gom lỗi mới
  async function asStep(step, fn) {
    const prev = currentStep;
    currentStep = step;
    issues[step] = [];
    renderIssues();
    try {
      return await fn();
    } finally {
      currentStep = prev;
      renderIssues();
    }
  }
  const sameNum = (a, b) => a !== '' && Math.abs(parseFloat(String(a).replace(',', '.')) - parseFloat(b)) < 0.005;
  const plainText = (s) => {
    if (!/<\/?[a-z][\s\S]*>/i.test(s)) return s;
    return new DOMParser().parseFromString(s, 'text/html').body.textContent || '';
  };

  // ---------- BƯỚC 1: tạo POD + chọn loại áo ----------
  const typeDialog = () => document.querySelector('bgs-add-product-type-dialog');

  function findProductCard(name) {
    const dlg = typeDialog();
    if (!dlg) return null;
    const span = [...dlg.querySelectorAll('span.truncate')].find((s) => lc(s.textContent) === lc(name));
    return span ? span.closest('div.cursor-pointer') : null;
  }

  async function step1() {
    if (!typeDialog()) {
      const btn = [...document.querySelectorAll('button')].find((b) => /create pod product/i.test(b.textContent) && visible(b));
      if (!btn) {
        log('Không thấy nút "Create POD product". Hãy mở trang Products → All products.', 'err');
        return false;
      }
      status('① Đang bấm Create POD product…');
      btn.click();
      log('Đã bấm Create POD product, chờ hộp thoại…');
    }
    status('① Đang chờ hộp thoại chọn áo…');
    if (!(await waitFor(typeDialog))) {
      log('Hộp thoại "Add product type" không hiện.', 'err');
      return false;
    }

    status('① Đang tìm áo "' + cfg.productName + '"…');
    let card = await waitFor(() => findProductCard(cfg.productName), 10000);
    if (!card && cfg.searchKeyword) {
      const input = typeDialog().querySelector('input[type="text"]');
      if (input) {
        setNativeValue(input, cfg.searchKeyword);
        card = await waitFor(() => findProductCard(cfg.productName), 5000);
      }
    }
    if (!card) {
      log('Không tìm thấy sản phẩm "' + cfg.productName + '". Kiểm tra lại tên (phải khớp đầy đủ).', 'err');
      return false;
    }
    status('① Đang chọn áo…');
    card.scrollIntoView({ block: 'center' });
    const alreadyChecked = !!card.querySelector('svg-icon[src*="checkbox"], img[src*="checkbox"]');
    if (!alreadyChecked) card.click();
    await sleep(300);

    const footerBtns = [...typeDialog().querySelectorAll('.dir-ltr button, button')].filter((b) => /^save$/i.test(norm(b.textContent)));
    const saveBtn = footerBtns[footerBtns.length - 1];
    if (!saveBtn) {
      log('Không thấy nút Save của hộp thoại.', 'err');
      return false;
    }
    status('① Đang bấm Save hộp thoại, chờ khung Design…');
    saveBtn.click();
    const item = await waitFor(() => findTypeItem(cfg.productName), 15000);
    if (!item) {
      log('Đã bấm Save nhưng chưa thấy "' + cfg.productName + '" trong khung Design.', 'err');
      return false;
    }
    return verifyStep1();
  }

  // Kiểm tra: đúng 1 loại áo, đúng tên, hộp thoại đã đóng
  async function verifyStep1() {
    status('① Đang kiểm tra loại áo…');
    await sleep(300);
    const items = [...document.querySelectorAll('bgs-product-type-item')];
    const names = items.map((it) => norm((it.querySelector('span') || it).textContent));
    let ok = true;
    if (!items.some((it) => lc(it.textContent).includes(lc(cfg.productName)))) {
      log('Khung Design không có "' + cfg.productName + '".', 'err');
      ok = false;
    }
    if (items.length > 1) {
      log('Có ' + items.length + ' loại áo trong Design (chỉ cần 1): ' + names.join(' | ') + ' → xoá bớt bằng dấu ×.', 'warn');
      ok = false;
    }
    if (typeDialog()) {
      log('Hộp thoại "Add product type" vẫn còn mở.', 'warn');
      ok = false;
    }
    if (ok) log('✔ Bước 1 đã kiểm tra: đúng "' + cfg.productName + '".', 'ok');
    return ok;
  }

  // ---------- BƯỚC 2: chọn màu ----------
  function findTypeItem(name) {
    const items = [...document.querySelectorAll('bgs-product-type-item')];
    if (!items.length) return null;
    if (!name) return items[0];
    return items.find((it) => lc(it.textContent).includes(lc(name))) || null;
  }

  function colorPanel() {
    return [...document.querySelectorAll('.p-overlaypanel')].find((p) => visible(p) && p.querySelector('.grid-cols-6'));
  }

  function readColorOptions(panel) {
    return [...panel.querySelectorAll('.grid-cols-6 > div')].map((el) => {
      const label = el.querySelector('span');
      const ring = el.querySelector('div');
      return {
        el,
        name: norm(label ? label.textContent : el.textContent),
        selected: !!ring && ring.classList.contains('border-primary'),
      };
    });
  }

  async function openColorPanel() {
    let panel = colorPanel();
    if (panel) return panel;
    const item = findTypeItem(cfg.productName) || findTypeItem('');
    if (!item) {
      log('Chưa có sản phẩm nào trong khung Design (chạy bước 1 trước).', 'err');
      return null;
    }
    const plus = [...item.querySelectorAll('button')].find((b) => b.querySelector('svg-icon[src*="plus"]')) || item.querySelector('button');
    if (!plus) {
      log('Không thấy nút "+" để mở bảng màu.', 'err');
      return null;
    }
    plus.click();
    panel = await waitFor(colorPanel, 5000);
    if (!panel) log('Bảng màu không mở được.', 'err');
    return panel;
  }

  async function step2() {
    const wanted = cfg.colors.map(lc);
    if (!wanted.length) {
      log('Chưa chọn màu nào trong tool — bỏ qua bước 2.', 'warn');
      return true;
    }
    if (wanted.length > COLOR_LIMIT) {
      log('Chỉ được tối đa ' + COLOR_LIMIT + ' màu.', 'err');
      return false;
    }
    status('② Đang mở bảng màu…');
    const panel = await openColorPanel();
    if (!panel) return false;

    const opts = () => readColorOptions(colorPanel() || panel);
    const find = (name) => opts().find((x) => lc(x.name) === lc(name));

    // Mỗi lần bấm màu, trang dựng lại cả bảng biến thể → bấm dồn dập sẽ bị nuốt hoặc bật/tắt ngược.
    // Nên: bấm 1 lần → chờ tới khi trang thật sự đổi trạng thái → mới bấm màu tiếp. Tối đa 3 lần thử.
    async function setColor(name, want) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const o = find(name);
        if (!o) return false;
        if (o.selected === want) return true;
        o.el.click();
        const done = await waitFor(() => {
          const x = find(name);
          return x && x.selected === want;
        }, 2500, 100);
        if (done) {
          await sleep(150); // cho trang dựng xong bảng biến thể
          return true;
        }
      }
      return false;
    }

    // Trang không cho bỏ màu cuối cùng và không cho vượt 12 màu,
    // nên: bỏ màu thừa trước (giữ lại ≥1), rồi thêm màu cần, rồi bỏ nốt màu thừa.
    const deselectExtras = async () => {
      const extras = opts().filter((o) => o.selected && !wanted.includes(lc(o.name))).map((o) => o.name);
      for (const name of extras) {
        if (opts().filter((x) => x.selected).length <= 1) break;
        status('② Đang bỏ màu thừa: ' + name);
        await setColor(name, false);
      }
    };
    // Lặp "bỏ thừa → chọn thiếu" vài vòng: khi màu mặc định (vd Bay) là màu duy nhất đang chọn thì
    // chưa bỏ được ngay, nó chiếm 1 suất → màu thứ 12 bị trang từ chối vì đủ 12. Vòng sau (Bay đã bỏ) mới chọn được.
    for (let round = 0; round < 3; round++) {
      await deselectExtras();
      const missing = wanted.map(find).filter((o) => o && !o.selected);
      if (!missing.length) break;
      for (const o of missing) {
        const i = wanted.indexOf(lc(o.name));
        status(`② Đang chọn màu ${i + 1}/${wanted.length}: ${o.name}`);
        const full = opts().filter((x) => x.selected).length >= COLOR_LIMIT;
        if (full) continue; // đợi vòng sau khi đã bỏ màu thừa
        if (!(await setColor(o.name, true)) && round === 2) log(`Bấm màu ${o.name} 3 lần mà trang không nhận.`, 'warn');
      }
    }
    await deselectExtras();
    await sleep(300);

    status('② Đang kiểm tra màu…');
    const ok = checkColors(opts());
    const close = (colorPanel() || panel).querySelector('svg-icon[src*="times"]');
    if (close) close.click();
    if (ok) log('→ Giờ bạn upload design rồi tự bấm Save. Sang trang điền thông tin thì bấm ③.');
    return ok;
  }

  // So màu đang chọn trên trang với màu đã tick trong tool
  function checkColors(options) {
    const wanted = cfg.colors.map(lc);
    const selected = options.filter((o) => o.selected).map((o) => o.name);
    const notOnPage = cfg.colors.filter((c) => !options.some((o) => lc(o.name) === lc(c)));
    const notSelected = cfg.colors.filter((c) => !notOnPage.includes(c) && !selected.some((s) => lc(s) === lc(c)));
    const extra = selected.filter((s) => !wanted.includes(lc(s)));
    if (notSelected.length) log('Màu chưa được chọn: ' + notSelected.join(', '), 'err');
    if (extra.length) log('Màu bị chọn thừa: ' + extra.join(', '), 'err');
    if (notOnPage.length) log('Trang không có màu: ' + notOnPage.join(', '), 'warn');
    const ok = !notSelected.length && !extra.length && !notOnPage.length;
    if (ok) log('✔ Bước 2 đã kiểm tra: đúng ' + selected.length + ' màu — ' + selected.join(', '), 'ok');
    return ok;
  }

  async function verifyStep2() {
    status('② Đang kiểm tra màu…');
    const panel = await openColorPanel();
    if (!panel) return false;
    const ok = checkColors(readColorOptions(panel));
    const close = panel.querySelector('svg-icon[src*="times"]');
    if (close) close.click();
    return ok;
  }

  async function scanColors() {
    const panel = await openColorPanel();
    if (!panel) return;
    const names = readColorOptions(panel).map((o) => o.name).filter(Boolean);
    if (names.length) {
      cfg.availableColors = names;
      cfg.colors = cfg.colors.filter((c) => names.some((n) => lc(n) === lc(c)));
      save();
      renderColors();
      log('Đã quét ' + names.length + ' màu.', 'ok');
    }
  }

  // ---------- BƯỚC 3: title, description, giá, tag ----------
  const setDescription = (html) => callBridge('setDescription', { html });
  const getDescriptionText = () => callBridge('getDescription', {});

  function callBridge(action, payload) {
    return new Promise((resolve) => {
      const onMsg = (ev) => {
        if (ev.source !== window || !ev.data || ev.data.__podHelper !== action + 'Result') return;
        window.removeEventListener('message', onMsg);
        resolve(ev.data);
      };
      window.addEventListener('message', onMsg);
      window.postMessage({ __podHelper: action, ...payload }, '*');
      setTimeout(() => {
        window.removeEventListener('message', onMsg);
        resolve({ ok: false, detail: 'hết thời gian chờ' });
      }, 3000);
    });
  }

  function variantPriceRows() {
    // Mỗi dòng biến thể có 2 ô số: Price rồi Compare price.
    // key = tên biến thể (".../Black/S") vì bảng dùng virtual scroll, DOM của dòng bị tái sử dụng.
    return [...document.querySelectorAll('tr')]
      .map((tr) => {
        const inputs = [...tr.querySelectorAll('input[type="number"][placeholder="$ 0.00"]')];
        const nameCell = [...tr.cells].find((td) => !td.querySelector('input') && /\//.test(td.textContent));
        return { tr, inputs, key: norm(nameCell ? nameCell.textContent : tr.textContent) };
      })
      .filter((r) => r.inputs.length >= 2);
  }
  const variantPriceInputs = () => variantPriceRows().map((r) => r.inputs);

  function scrollParent(el) {
    for (let p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 5) return p;
    }
    return null;
  }

  // Đi qua MỌI dòng biến thể (tự cuộn bảng + qua trang), gọi fn đúng 1 lần mỗi dòng
  async function forEachVariantRow(fn, label = '') {
    const done = new Set();
    const total = expectedVariantCount();
    const fillVisible = () => {
      for (const row of variantPriceRows()) {
        if (done.has(row.key)) continue;
        fn(row);
        done.add(row.key);
      }
      if (label) status(`${label} ${done.size}${total ? '/' + total : ''} biến thể…`);
    };

    for (let page = 0; page < 50; page++) {
      const rows = variantPriceRows();
      if (!rows.length) break;
      // Cuộn bảng từ đầu tới cuối, mỗi lần điền các dòng đang hiện
      const box = scrollParent(rows[0].tr);
      if (box) {
        box.scrollTop = 0;
        await sleep(150);
        for (let i = 0; i < 300; i++) {
          fillVisible();
          if (!(await scrollStep(box, Math.max(60, box.clientHeight * 0.75)))) break;
        }
        await sleep(150);
        fillVisible();
        box.scrollTop = 0;
      } else {
        fillVisible();
      }
      // Bảng có phân trang thì sang trang tiếp
      const next = [...document.querySelectorAll('.p-paginator-next')].find((b) => visible(b) && !b.disabled && !b.classList.contains('p-disabled'));
      if (!next) break;
      next.click();
      await sleep(600);
    }
    // quay về trang 1 nếu có phân trang
    const first = [...document.querySelectorAll('.p-paginator-first')].find((b) => visible(b) && !b.disabled && !b.classList.contains('p-disabled'));
    if (first) first.click();
    return done.size;
  }

  // price / compare: chuỗi số đã chuẩn hoá, hoặc null = không đụng vào cột đó
  function fillPrices(price, compare) {
    return forEachVariantRow(({ inputs: [p, c] }) => {
      if (price !== null) {
        setNativeValue(p, price);
        p.dispatchEvent(new Event('blur'));
      }
      if (compare !== null) {
        setNativeValue(c, compare);
        c.dispatchEvent(new Event('blur'));
      }
    }, '③ Đang điền giá:');
  }

  // Đếm tổng số biến thể theo chữ "x/400 Variants" nếu trang có hiện
  function expectedVariantCount() {
    const m = document.body.innerText.match(/(\d+)\s*\/\s*400\s*Variants/i);
    return m ? +m[1] : null;
  }

  function tagsMultiSelect() {
    const label = [...document.querySelectorAll('span, label')].find((s) => norm(s.textContent) === 'Tags' && visible(s));
    if (label) {
      const box = label.parentElement && label.parentElement.querySelector('.p-multiselect');
      if (box) return box;
    }
    return [...document.querySelectorAll('.p-multiselect')].find((m) => /select tags/i.test(m.textContent)) || null;
  }

  function tagPanel() {
    return [...document.querySelectorAll('.p-multiselect-panel')].find(visible);
  }

  async function openTagPanel() {
    const ms = tagsMultiSelect();
    if (!ms) {
      log('Không thấy ô Tags trên trang.', 'err');
      return null;
    }
    let panel = tagPanel();
    if (!panel) {
      ms.scrollIntoView({ block: 'center' });
      ms.click();
      panel = await waitFor(tagPanel, 4000);
    }
    if (!panel) log('Không mở được danh sách tag.', 'err');
    return panel;
  }

  function closeTagPanel() {
    const ms = tagsMultiSelect();
    if (tagPanel() && ms) {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.body.click();
    }
  }

  const tagItems = (panel) =>
    [...panel.querySelectorAll('li.p-multiselect-item, li[role="option"]')].map((li) => ({
      li,
      name: norm(li.getAttribute('aria-label') || li.textContent),
      selected: li.getAttribute('aria-selected') === 'true' || li.classList.contains('p-highlight'),
    }));

  async function setTagFilter(panel, text) {
    const f = panel.querySelector('input.p-multiselect-filter, .p-multiselect-filter-container input');
    if (!f) return false;
    setNativeValue(f, text);
    await sleep(text ? 500 : 250); // trang có thể lọc phía server
    return true;
  }

  async function scanTags() {
    const panel = await openTagPanel();
    if (!panel) return;
    await setTagFilter(panel, '');
    const found = new Set();
    // Danh sách tag dùng virtual scroll: phải cuộn dần mới render hết
    const scroller = panel.querySelector('.p-scroller') || panel.querySelector('.p-multiselect-items-wrapper');
    for (let i = 0; i < 400; i++) {
      tagItems(panel).forEach((t) => t.name && found.add(t.name));
      status(`Đang quét tag: đã thấy ${found.size}…`);
      if (!(await scrollStep(scroller, Math.max(100, scroller ? scroller.clientHeight - 35 : 0)))) {
        await sleep(300); // chờ lazy-load lần cuối
        tagItems(panel).forEach((t) => t.name && found.add(t.name));
        break;
      }
    }
    closeTagPanel();
    if (!found.size) return log('Không quét được tag nào — giữ nguyên danh sách cũ.', 'warn');
    cfg.availableTags = [...found].sort((a, b) => a.localeCompare(b));
    save();
    renderTags();
    log('Đã quét ' + found.size + ' tag.', 'ok');
  }

  // Cuộn danh sách tag (không lọc) từ đầu tới cuối 1 lượt, gọi visit(items) ở mỗi đoạn
  async function walkTagList(panel, visit) {
    const scroller = panel.querySelector('.p-scroller') || panel.querySelector('.p-multiselect-items-wrapper');
    if (scroller) {
      scroller.scrollTop = 0;
      await sleep(150);
    }
    for (let i = 0; i < 400; i++) {
      await visit(tagItems(tagPanel() || panel));
      if (!(await scrollStep(scroller, Math.max(100, scroller ? scroller.clientHeight - 35 : 0)))) break;
    }
    await visit(tagItems(tagPanel() || panel));
  }

  async function selectTags(tags) {
    const panel = await openTagPanel();
    if (!panel) return false;
    const want = new Set(tags.map(lc));
    const ok = new Set();
    await setTagFilter(panel, '');
    // Lượt chính: cuộn 1 lần qua cả danh sách, gặp tag cần thì bấm luôn
    await walkTagList(panel, async (items) => {
      for (const t of items) {
        const k = lc(t.name);
        if (!want.has(k) || ok.has(k)) continue;
        status(`③ Đang chọn tag ${ok.size + 1}/${want.size}: ${t.name}`);
        if (!t.selected) {
          t.li.click();
          await sleep(150);
        }
        ok.add(k);
      }
    });
    // Tag chưa gặp (danh sách lazy-load theo ô lọc) → thử tìm bằng ô lọc
    for (const tag of tags.filter((t) => !ok.has(lc(t)))) {
      status(`③ Đang tìm tag bằng ô lọc: ${tag}`);
      if (!(await setTagFilter(tagPanel() || panel, tag))) break;
      const item = await waitFor(() => tagItems(tagPanel() || panel).find((t) => lc(t.name) === lc(tag)), 1200);
      if (!item) continue;
      if (!item.selected) {
        item.li.click();
        await sleep(150);
      }
      ok.add(lc(tag));
    }
    await setTagFilter(tagPanel() || panel, '');
    closeTagPanel();
    log('Tag đã bấm chọn: ' + (tags.filter((t) => ok.has(lc(t))).join(', ') || '(không có)'));
    return true;
  }

  async function step3() {
    const titleInput = document.querySelector('input[formcontrolname="title"]');
    if (!titleInput) {
      log('Không thấy ô Title — bạn đã upload design và bấm Save chưa?', 'err');
      return false;
    }
    if (cfg.title) {
      status('③ Đang điền Title…');
      setNativeValue(titleInput, cfg.title);
      titleInput.dispatchEvent(new Event('blur'));
      log('Title: ' + titleInput.value, 'ok');
    }

    if (cfg.description) {
      status('③ Đang điền Description…');
      const r = await setDescription(textToHtml(cfg.description));
      log(r.ok ? 'Description: đã điền.' : 'Description lỗi: ' + r.detail, r.ok ? 'ok' : 'err');
    }

    const { price, compare } = configuredPrices(true);
    if (price !== null || compare !== null) {
      const n = await fillPrices(price, compare);
      log(n ? `Giá: đã điền ${n} biến thể.` : 'Không thấy bảng biến thể để điền giá.', n ? 'ok' : 'err');
    }

    if (cfg.tags.length) {
      status('③ Đang mở danh sách tag…');
      await selectTags(cfg.tags);
    }

    log('Đang kiểm tra lại toàn bộ bước ③…');
    return verifyStep3();
  }

  // Ô để trống = giữ nguyên giá trang tự đặt cho cột đó (null)
  function configuredPrices(report) {
    const toNum = (v, label) => {
      const s = String(v ?? '').trim().replace(',', '.');
      if (s === '') return null;
      if (isNaN(+s)) {
        if (report) log(label + ' trong tool không hợp lệ: ' + v, 'err');
        return null;
      }
      return s;
    };
    return { price: toNum(cfg.price, 'Price'), compare: toNum(cfg.comparePrice, 'Compare price') };
  }

  // Đọc toàn bộ danh sách tag, trả về tên các tag đang được chọn
  async function readSelectedTags() {
    const panel = await openTagPanel();
    if (!panel) return null;
    await setTagFilter(panel, '');
    const selected = new Set();
    const seen = new Set();
    await walkTagList(panel, async (items) => {
      items.forEach((t) => {
        seen.add(lc(t.name));
        if (t.selected) selected.add(t.name);
      });
      status(`🔍 Đang kiểm tra tag: thấy ${selected.size} tag đang chọn…`);
    });
    // Tag cần mà không hiện trong danh sách không lọc → hỏi bằng ô lọc
    for (const tag of cfg.tags.filter((t) => !seen.has(lc(t)))) {
      if (!(await setTagFilter(tagPanel() || panel, tag))) break;
      const item = await waitFor(() => tagItems(tagPanel() || panel).find((t) => lc(t.name) === lc(tag)), 1200);
      if (item && item.selected) selected.add(item.name);
    }
    await setTagFilter(tagPanel() || panel, '');
    closeTagPanel();
    return [...selected];
  }

  // Đưa trang về đầu (chỗ ô Title). Trang có thể cuộn bằng window hoặc bằng một khung bên trong,
  // nên cuộn cả window lẫn mọi khung cha của ô Title về 0.
  function scrollPageTop() {
    status('Đang cuộn lên đầu trang…');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const title = document.querySelector('input[formcontrolname="title"]');
    for (let p = title && title.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (p.scrollTop > 0) p.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // So từng mục trên trang với cấu hình trong tool; mọi chỗ lệch đều vào danh sách "cần chỉnh tay"
  async function verifyStep3() {
    let bad = 0;
    const err = (m) => {
      bad++;
      log(m, 'err');
    };

    status('🔍 Đang kiểm tra Title…');
    const titleInput = document.querySelector('input[formcontrolname="title"]');
    if (!titleInput) {
      err('Không thấy ô Title để kiểm tra.');
      return false;
    }
    if (cfg.title && norm(titleInput.value) !== norm(cfg.title)) {
      err(`Title chưa khớp. Trên trang: "${titleInput.value}"`);
    }
    if (!norm(titleInput.value)) err('Title đang trống.');

    if (cfg.description) {
      status('🔍 Đang kiểm tra Description…');
      const r = await getDescriptionText();
      if (!r.ok) err('Không đọc được Description: ' + r.detail);
      else if (lc(r.text) !== lc(plainText(cfg.description))) {
        err('Description chưa khớp với nội dung trong tool. Đầu đoạn trên trang: "' + norm(r.text).slice(0, 60) + '…"');
      }
    }

    const { price, compare } = configuredPrices(false);
    if (price !== null || compare !== null) {
      const wrong = [];
      const n = await forEachVariantRow(({ key, inputs: [p, c] }) => {
        const issues = [];
        if (price !== null && !sameNum(p.value, price)) issues.push('Price = ' + (p.value || 'trống'));
        if (compare !== null && !sameNum(c.value, compare)) issues.push('Compare = ' + (c.value || 'trống'));
        if (issues.length) wrong.push(key.replace(/^.*?\(US\)\s*\//, '') + ': ' + issues.join(', '));
      }, '🔍 Đang kiểm tra giá:');
      const total = expectedVariantCount();
      if (!n) err('Không đọc được bảng biến thể.');
      if (total && n < total) err(`Chỉ đọc được ${n}/${total} biến thể — kiểm tra phần còn lại bằng tay.`);
      if (wrong.length) {
        bad += wrong.length;
        addIssue(currentStep, `Sai giá ở ${wrong.length} biến thể (cần Price ${price ?? '—'}, Compare ${compare ?? '—'}):`);
        wrong.forEach((w) => addIssue(currentStep, '   • ' + w));
        log(`Sai giá ở ${wrong.length} biến thể.`, '');
      }
    }

    if (cfg.tags.length) {
      status('🔍 Đang mở danh sách tag để kiểm tra…');
      const selected = await readSelectedTags();
      if (!selected) err('Không đọc được danh sách tag.');
      else {
        const missing = cfg.tags.filter((t) => !selected.some((s) => lc(s) === lc(t)));
        const extra = selected.filter((s) => !cfg.tags.some((t) => lc(t) === lc(s)));
        if (missing.length) err('Tag chưa được chọn: ' + missing.join(', '));
        if (extra.length) err('Tag bị chọn thừa: ' + extra.join(', '));
      }
    }

    if (!bad) log('✔ Bước 3 đã kiểm tra: mọi thứ khớp. Bạn tự bấm Save.', 'ok');
    scrollPageTop();
    return !bad;
  }

  // ---------- chẩn đoán ----------
  function diagnose() {
    const info = {
      url: location.href,
      createPodBtn: !![...document.querySelectorAll('button')].find((b) => /create pod product/i.test(b.textContent)),
      typeDialog: !!typeDialog(),
      typeCards: typeDialog() ? typeDialog().querySelectorAll('span.truncate').length : 0,
      typeItems: [...document.querySelectorAll('bgs-product-type-item')].map((i) => norm(i.textContent).slice(0, 60)),
      colorPanelOpen: !!colorPanel(),
      colorOptions: colorPanel() ? readColorOptions(colorPanel()).map((o) => o.name + (o.selected ? '*' : '')) : [],
      titleInput: !!document.querySelector('input[formcontrolname="title"]'),
      descEditor: !!document.querySelector('[formcontrolname="desc"]'),
      priceRows: variantPriceInputs().length,
      expectedVariants: expectedVariantCount(),
      tableScroller: (() => {
        const r = variantPriceRows()[0];
        const b = r && scrollParent(r.tr);
        return b ? b.className.toString().slice(0, 80) + ` (${b.clientHeight}/${b.scrollHeight})` : null;
      })(),
      paginator: !!document.querySelector('.p-paginator'),
      tagsBox: !!tagsMultiSelect(),
      tagPanelOpen: !!tagPanel(),
      tagItemsVisible: tagPanel() ? tagItems(tagPanel()).length : 0,
      multiselects: document.querySelectorAll('.p-multiselect').length,
    };
    const text = JSON.stringify(info, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
    log('Chẩn đoán (đã copy vào clipboard):\n' + text);
  }

  // ---------- giao diện panel ----------
  const root = document.createElement('div');
  root.id = 'pod-helper';
  root.innerHTML = `
    <div class="pod-head">
      <span class="pod-title">POD Helper</span>
      <button class="pod-icon" data-act="collapse" title="Thu gọn">–</button>
    </div>
    <div class="pod-body">
      <div class="pod-run">
        <button class="pod-btn primary" data-act="s1">① Tạo POD + chọn áo</button>
        <button class="pod-btn" data-act="s2">② Chọn màu</button>
        <button class="pod-btn primary" data-act="s3">③ Điền thông tin</button>
        <button class="pod-btn" data-act="recheck">🔍 Kiểm tra lại (sau khi sửa tay)</button>
      </div>
      <div class="pod-status" hidden></div>
      <label class="pod-check"><input type="checkbox" data-k="autoColors"> Chạy luôn ② sau ①</label>

      <div class="pod-issues"></div>

      <details>
        <summary>Sản phẩm</summary>
        <label>Tên sản phẩm (khớp đầy đủ)<input data-k="productName"></label>
        <label>Từ khoá tìm (dự phòng)<input data-k="searchKeyword"></label>
      </details>

      <details>
        <summary>Màu <span class="pod-count" data-count="colors"></span></summary>
        <div class="pod-chips" data-list="colors"></div>
        <div class="pod-row">
          <button class="pod-mini" data-act="scanColors">Quét màu từ trang</button>
          <button class="pod-mini" data-act="clearColors">Bỏ chọn hết</button>
        </div>
      </details>

      <details>
        <summary>Title &amp; Description</summary>
        <label>Title<input data-k="title"></label>
        <label>Description<textarea data-k="description" rows="5"></textarea></label>
      </details>

      <details>
        <summary>Giá <small>(áp cho mọi biến thể)</small></summary>
        <div class="pod-row pod-prices">
          <label>Price<input data-k="price" inputmode="decimal" placeholder="VD: 29.95"></label>
          <label>Compare price<input data-k="comparePrice" inputmode="decimal" placeholder="VD: 35.95"></label>
        </div>
      </details>

      <details>
        <summary>Tags <span class="pod-count" data-count="tags"></span></summary>
        <input class="pod-filter" data-filter="tags" placeholder="Lọc tag…">
        <div class="pod-chips pod-tags" data-list="tags"></div>
        <div class="pod-row">
          <input class="pod-addtag" placeholder="Thêm tag thủ công + Enter">
        </div>
        <div class="pod-row">
          <button class="pod-mini" data-act="scanTags">Quét tag từ trang</button>
          <button class="pod-mini" data-act="clearTags">Bỏ chọn hết</button>
        </div>
      </details>

      <details class="pod-logbox">
        <summary>Log chi tiết</summary>
        <div class="pod-log"></div>
        <div class="pod-row">
          <button class="pod-mini" data-act="diag">Chẩn đoán</button>
          <button class="pod-mini" data-act="clearLog">Xoá log</button>
        </div>
      </details>
    </div>`;
  document.documentElement.appendChild(root);
  logEl = root.querySelector('.pod-log');
  statusEl = root.querySelector('.pod-status');
  const logBox = root.querySelector('.pod-logbox');
  const issuesEl = root.querySelector('.pod-issues');

  function renderIssues() {
    const checked = Object.keys(issues).filter((s) => issues[s] !== null);
    if (!checked.length) {
      issuesEl.innerHTML = '';
      return;
    }
    const total = checked.reduce((n, s) => n + issues[s].filter((m) => !m.startsWith('   •')).length, 0);
    issuesEl.className = 'pod-issues ' + (total ? 'has' : 'clean');
    issuesEl.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'pod-issues-head';
    head.textContent = currentStep
      ? 'Đang kiểm tra…'
      : total
        ? `⚠ Cần chỉnh tay (${total})`
        : '✔ Đã kiểm tra: không có chỗ nào lệch';
    issuesEl.appendChild(head);
    for (const s of checked) {
      if (!issues[s].length) continue;
      const g = document.createElement('div');
      g.className = 'pod-issues-step';
      g.textContent = STEP_NAMES[s];
      issuesEl.appendChild(g);
      for (const m of issues[s]) {
        const row = document.createElement('label');
        row.className = 'pod-issue' + (m.startsWith('   •') ? ' sub' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.title = 'Tick khi đã sửa xong';
        row.append(cb, document.createTextNode(' ' + m.replace(/^\s*•\s*/, '')));
        issuesEl.appendChild(row);
      }
    }
  }

  // Kiểm tra lại đúng màn hình đang mở (màn chọn màu hoặc màn điền thông tin)
  async function recheck() {
    if (document.querySelector('input[formcontrolname="title"]')) return asStep('s3', verifyStep3);
    if (findTypeItem('')) {
      await asStep('s1', verifyStep1);
      return asStep('s2', verifyStep2);
    }
    log('Không có gì để kiểm tra trên màn hình này.', 'warn');
  }

  function renderChips(kind, all, selected, filter = '') {
    const box = root.querySelector(`[data-list="${kind}"]`);
    box.innerHTML = '';
    const sel = new Set(selected.map(lc));
    const list = [...new Set([...all, ...selected])];
    list
      .filter((n) => !filter || lc(n).includes(lc(filter)) || sel.has(lc(n)))
      .forEach((name) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pod-chip' + (sel.has(lc(name)) ? ' on' : '');
        chip.textContent = name;
        chip.onclick = () => toggleChip(kind, name);
        box.appendChild(chip);
      });
    const count = root.querySelector(`[data-count="${kind}"]`);
    count.textContent = kind === 'colors' ? `(${selected.length}/${COLOR_LIMIT})` : `(${selected.length} chọn / ${all.length})`;
  }
  const renderColors = () => renderChips('colors', cfg.availableColors, cfg.colors);
  const renderTags = () => renderChips('tags', cfg.availableTags, cfg.tags, root.querySelector('[data-filter="tags"]').value);

  function toggleChip(kind, name) {
    const arr = cfg[kind];
    const i = arr.findIndex((x) => lc(x) === lc(name));
    if (i >= 0) arr.splice(i, 1);
    else {
      if (kind === 'colors' && arr.length >= COLOR_LIMIT) {
        log('Tối đa ' + COLOR_LIMIT + ' màu.', 'warn');
        return;
      }
      arr.push(name);
    }
    save();
    kind === 'colors' ? renderColors() : renderTags();
  }

  // Đổ cfg vào các ô; bỏ qua ô đang gõ để không nhảy con trỏ
  function fillFields() {
    root.querySelectorAll('[data-k]').forEach((el) => {
      if (el === document.activeElement) return;
      const k = el.dataset.k;
      if (el.type === 'checkbox') el.checked = !!cfg[k];
      else el.value = cfg[k] ?? '';
    });
    root.classList.toggle('collapsed', !!cfg.collapsed);
  }

  function bindFields() {
    fillFields();
    root.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
        cfg[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value || 0 : el.value;
        save();
      });
    });
    root.querySelector('[data-filter="tags"]').addEventListener('input', renderTags);
    root.querySelector('.pod-addtag').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const v = norm(e.target.value);
      if (v && !cfg.tags.some((t) => lc(t) === lc(v))) {
        cfg.tags.push(v);
        save();
        renderTags();
      }
      e.target.value = '';
    });
  }

  async function run(fn) {
    if (busy) return log('Đang chạy, chờ chút…', 'warn');
    busy = true;
    root.classList.add('busy');
    logBox.open = true; // hiện log trong lúc chạy
    try {
      await fn();
    } catch (e) {
      log('Lỗi: ' + (e && e.message ? e.message : e), 'err');
    } finally {
      busy = false;
      root.classList.remove('busy');
      status('');
      logBox.open = false; // xong thì ẩn log, chỉ để lại danh sách cần chỉnh tay
      renderIssues();
    }
  }

  const actions = {
    s1: () =>
      run(async () => {
        if ((await asStep('s1', step1)) && cfg.autoColors) {
          await sleep(800);
          await asStep('s2', step2);
        }
      }),
    s2: () => run(() => asStep('s2', step2)),
    s3: () => run(() => asStep('s3', step3)),
    recheck: () => run(recheck),
    scanColors: () => run(scanColors),
    scanTags: () => run(scanTags),
    clearColors: () => {
      cfg.colors = [];
      save();
      renderColors();
    },
    clearTags: () => {
      cfg.tags = [];
      save();
      renderTags();
    },
    diag: diagnose,
    clearLog: () => (logEl.innerHTML = ''),
    collapse: () => {
      cfg.collapsed = !cfg.collapsed;
      root.classList.toggle('collapsed', cfg.collapsed);
      save();
    },
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && actions[b.dataset.act]) actions[b.dataset.act]();
  });
  // ---------- kéo panel bằng thanh tiêu đề ----------
  function placePanel(left, top) {
    const w = root.offsetWidth;
    const h = root.querySelector('.pod-head').offsetHeight;
    left = Math.min(Math.max(0, left), window.innerWidth - Math.min(w, 80));
    top = Math.min(Math.max(0, top), window.innerHeight - h);
    root.style.left = left + 'px';
    root.style.top = top + 'px';
    root.style.right = 'auto';
    return { left, top };
  }
  root.querySelector('.pod-head').addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    const rect = root.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    root.classList.add('dragging');
    const move = (ev) => placePanel(ev.clientX - dx, ev.clientY - dy);
    const up = (ev) => {
      window.removeEventListener('mousemove', move, true);
      window.removeEventListener('mouseup', up, true);
      root.classList.remove('dragging');
      cfg.pos = placePanel(ev.clientX - dx, ev.clientY - dy);
      save();
    };
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
  });
  // Đổi kích thước cửa sổ thì kéo panel về lại trong màn hình
  window.addEventListener('resize', () => cfg.pos && placePanel(cfg.pos.left, cfg.pos.top));

  // Không để click trong panel làm PrimeNG đóng overlay/dropdown đang mở
  ['mousedown', 'click'].forEach((t) => root.addEventListener(t, (e) => e.stopPropagation()));

  chrome.storage.local.get('podHelper', (r) => {
    cfg = { ...DEFAULTS, ...(r.podHelper || {}) };
    loaded = true;
    bindFields();
    if (cfg.pos) placePanel(cfg.pos.left, cfg.pos.top);
    renderColors();
    renderTags();
    log('Sẵn sàng.');
  });

  // Mở nhiều tab admin cùng lúc: tab khác lưu thì cập nhật luôn cfg ở tab này.
  // Trước đây mỗi tab giữ bản cfg cũ từ lúc mở, rồi chỉ cần kéo/thu gọn panel là
  // ghi đè cả cấu hình bằng bản cũ → trông như tool bị reset.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.podHelper || !loaded) return;
    const nv = changes.podHelper.newValue;
    const json = JSON.stringify(nv);
    if (ownWrites.delete(json)) return;
    cfg = { ...DEFAULTS, ...(nv || {}) };
    fillFields();
    if (cfg.pos) placePanel(cfg.pos.left, cfg.pos.top);
    renderColors();
    renderTags();
  });
})();

// Chạy trong "MAIN world" của trang để gọi được window.tinymce
// (content script thường bị cô lập, không thấy biến của trang).
function descEditor() {
  const tm = window.tinymce;
  const editors = tm ? (tm.get ? tm.get() : tm.editors) || [] : [];
  // Form có 2 editor: "desc" (Description) và "short_desc" — chọn đúng cái desc.
  return (
    editors.find((e) => e.getElement && e.getElement() && e.getElement().closest('[formcontrolname="desc"]')) ||
    editors[0] ||
    null
  );
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window || !ev.data) return;
  const action = ev.data.__podHelper;
  if (action !== 'setDescription' && action !== 'getDescription') return;
  let ok = false;
  let detail = '';
  let text = '';
  try {
    const ed = descEditor();
    if (!ed) {
      detail = 'không thấy editor TinyMCE';
    } else if (action === 'setDescription') {
      ed.setContent(ev.data.html);
      const fire = (name) => (ed.dispatch ? ed.dispatch(name) : ed.fire(name));
      fire('input');
      fire('change');
      ed.save && ed.save();
      ok = true;
      detail = 'tinymce#' + (ed.id || '?');
    } else {
      text = ed.getContent({ format: 'text' });
      ok = true;
    }
  } catch (e) {
    detail = String(e);
  }
  window.postMessage({ __podHelper: action + 'Result', ok, detail, text }, '*');
});

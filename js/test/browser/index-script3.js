// Delegated event handling. The validator forbids inline event handler
// attributes (onclick, onload); these listeners give the same behaviour
// without any inline JavaScript.
(function () {
  function runAction(el, spec) {
    var m = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*\((.*)\)$/.exec(String(spec || '').trim());
    if (!m) return;
    var fn = window[m[1]];
    if (typeof fn !== 'function') return;
    var args = [];
    var raw = m[2].trim();
    if (raw) {
      raw.split(',').forEach(function (a) {
        a = a.trim();
        if (a === 'this') { args.push(el); }
        else if (/^-?\d+(\.\d+)?$/.test(a)) { args.push(Number(a)); }
        else if (/^(['"]).*\1$/.test(a)) { args.push(a.slice(1, -1)); }
        else { args.push(a); }
      });
    }
    fn.apply(el, args);
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el) runAction(el, el.getAttribute('data-action'));
  });
  window.addEventListener('load', function () {
    document.querySelectorAll('[data-onload]').forEach(function (el) {
      runAction(el, el.getAttribute('data-onload'));
    });
  });
})();

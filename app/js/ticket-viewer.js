// Full-screen ticket viewer outside #app. PDFs are drawn to canvases with PDF.js, loaded only when needed.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
// cdnjs's published SRI hashes for these exact files (checked against the downloaded bytes).
const SRI = { lib: 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==', worker: 'sha512-BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw==' };
// Keeps a load that worked; forgets one that failed, so "Try again" really tries again once there's signal.
export function retryable(load) {
  let pending = null;
  return () => (pending ??= load().catch((e) => { pending = null; throw e; }));
}

const loadPdfJs = retryable(() => new Promise((ok, fail) => {
  if (globalThis.pdfjsLib) { ok(globalThis.pdfjsLib); return; }
  const s = document.createElement('script');
  s.src = PDFJS; s.integrity = SRI.lib; s.crossOrigin = 'anonymous';
  s.onload = () => ok(globalThis.pdfjsLib);
  s.onerror = () => { s.remove(); fail(new Error('PDF viewer failed to load')); };
  document.head.append(s);
}).then(async (lib) => {
  const res = await fetch(WORKER, { integrity: SRI.worker });
  if (!res.ok) throw new Error('PDF viewer failed to load');
  lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await res.text()], { type: 'text/javascript' }));
  return lib;
}));

export function openTicketViewer({ ticket, load, onClose }) {
  const box = document.createElement('div');
  box.className = 'tv';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<div class="tv-bar"><b class="tv-title"></b><button class="btn small tv-ext" type="button">Open in phone viewer</button><button class="btn small p tv-close" type="button">Close</button></div><div class="tv-pages"><p class="tv-msg">Opening…</p></div>';
  box.querySelector('.tv-title').textContent = ticket.label;
  document.body.append(box);
  let url = null;
  const close = () => { if (url) URL.revokeObjectURL(url); box.remove(); onClose?.(); };
  box.querySelector('.tv-close').onclick = close;
  const pages = box.querySelector('.tv-pages');
  const fail = (msg) => { pages.innerHTML = ''; const p = document.createElement('p'); p.className = 'tv-msg'; p.textContent = msg; const retry = document.createElement('button'); retry.className = 'btn'; retry.textContent = 'Try again'; retry.onclick = () => { close(); openTicketViewer({ ticket, load, onClose }); }; pages.append(p, retry); };
  load().then(async (bytes) => {
    url = URL.createObjectURL(new Blob([bytes], { type: ticket.mime }));
    box.querySelector('.tv-ext').onclick = () => { if (confirmExternal(box)) window.open(url, '_blank'); };
    pages.innerHTML = '';
    if (ticket.mime !== 'application/pdf') { const img = document.createElement('img'); img.src = url; img.alt = ticket.label; pages.append(img); return; }
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const scale = (pages.clientWidth * devicePixelRatio) / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      pages.append(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
  }).catch(() => fail("Couldn't open this ticket. Check your signal and try again."));
}

function confirmExternal(box) {
  const note = box.querySelector('.tv-warn');
  if (note) return true;
  const p = document.createElement('p');
  p.className = 'tv-warn';
  p.textContent = 'The phone may save a copy of the ticket to Downloads. Tap again to open it anyway.';
  box.querySelector('.tv-bar').after(p);
  return false;
}

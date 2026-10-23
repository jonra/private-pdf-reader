# Private PDF Reader — Chrome/Edge extension

Opens every PDF in a clean, local reader instead of the browser's built-in one.
Thumbnails, outline, full-text search, draw/type signatures, and a theme toggle
(Sprout ↔ Parchment). **Nothing is uploaded** — PDF.js and pdf-lib are bundled
locally and all processing happens in your browser.

## Install (load unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `pdf-reader-extension` folder.
4. Done. Open any `.pdf` link on the web and it loads in the reader.

### Local files (optional)
To make it also open `file://…/something.pdf` from your disk:
- On the extension card, click **Details** → enable **Allow access to file URLs**.

## Use
- **Auto-open:** click any PDF link on the web — it opens in the reader.
- **Toolbar icon:** opens a blank reader; drag-drop or **Open PDF**.
- **Theme:** click **🎨** to switch between Sprout and Parchment (remembered).
- **Sign:** **✍️ Sign** → draw or type → drop on the page → drag/resize →
  **⬇ Save signed** downloads a flattened `…-signed.pdf`.
- **Search:** sidebar **Search** tab scans every page; click a result to jump.

## How it works
- `background.js` registers a `declarativeNetRequest` rule that redirects PDF
  navigations to `viewer.html?file=<original-url>`.
- `viewer.html/.css/.js` is the reader; it fetches the PDF locally and renders
  it with the bundled PDF.js. Signing uses the bundled pdf-lib.

## Notes / limits
- Catches URLs ending in `.pdf`. PDFs served without a `.pdf` extension
  (content-type only) won't auto-redirect — use the toolbar icon + Open for those.
- Signature fonts (Script / Elegant / Casual / Classic) are bundled as woff2 in
  `fonts/` and load offline. UI fonts fall back to system fonts (rounded sans for
  Sprout, serif for Parchment) to keep the package small.

See the [main README](../README.md) for permissions, packaging, privacy and licensing.

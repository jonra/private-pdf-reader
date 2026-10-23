# Chrome Web Store — Listing Copy & Submission Notes

Upload file: **private-pdf-reader-<version>.zip**, built as described in the [README](../README.md#packaging-for-the-chrome-web-store). Drop it in the "Add new item" box.

Privacy policy URL: https://github.com/jonra/private-pdf-reader/blob/main/PRIVACY.md

---

## Store listing fields

**Name**
Private PDF Reader

**Summary** (max 132 chars)
A clean, private PDF reader. Thumbnails, search, signing, and themes — all local. Your files never leave your device.

**Category**
Productivity

**Language**
English

**Detailed description**
Private PDF Reader replaces the browser's built-in PDF viewer with a clean, fast reader that does everything on your device — nothing is ever uploaded to a server.

Features
• Continuous scrolling with crisp, high-DPI rendering
• Page thumbnails, document outline, and full-text search
• Sign documents: draw or type a signature, place it on the page, and export a flattened signed PDF
• Two built-in themes (Sprout and Parchment) you can switch anytime
• Opens PDFs automatically, or open/drag-drop your own

Privacy
All processing happens locally in your browser using bundled open-source libraries (PDF.js and pdf-lib). The extension does not send your documents, browsing data, or any personal information to any server. There are no analytics and no tracking.

---

## Privacy practices tab (required answers)

**Single purpose description**
This extension is a PDF reader. Its single purpose is to display and lightly annotate (sign) PDF files locally in the browser.

**Permission justifications**

- **declarativeNetRequest / declarativeNetRequestWithHostAccess**
  Used to redirect PDF page loads to the extension's local viewer so PDFs open in this reader instead of the default viewer. No request content is read or sent anywhere.

- **host_permissions: `<all_urls>`**
  Required so the reader can open a PDF from whatever site the user navigated to (the viewer fetches the PDF bytes locally to render them) and so PDFs on any domain can be redirected to the local viewer. The extension does not read or transmit page content from other sites.

- **tabs**
  Used only to open the reader in a new tab when the user clicks the toolbar icon.

**Are you using remote code?** No. All code (PDF.js, pdf-lib) is bundled in the package.

**Data usage disclosures** (check the boxes accordingly)
- Does NOT collect or use: personally identifiable information, health info, financial info, authentication info, personal communications, location, web history, user activity, website content.
- Certify: data is not sold to third parties; not used for purposes unrelated to the core function; not used to determine creditworthiness / lending.

---

## Graphics assets you'll need to upload

- **Store icon:** 128×128 PNG — use [`store-icon-128.png`](store-icon-128.png) or `pdf-reader-extension/icons/icon128.png`.
- **Screenshots:** at least one, 1280×800 or 640×400 PNG. Take a couple of the reader open on a sample PDF (one in each theme makes a nice pair).
- **Small promo tile (optional):** 440×280 PNG.

---

## After you submit
- Set **Visibility** (Public, Unlisted, or Private) before publishing. Unlisted is a good way to share a direct link without showing up in search while you test.
- Review typically takes a few hours to a few days. The `<all_urls>` + redirect combo can draw extra scrutiny — the justifications above are written to address exactly that.
- To ship an update later: bump `version` in manifest.json, re-zip, upload a new package.

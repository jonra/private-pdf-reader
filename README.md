# Private PDF Reader

A Chrome / Edge extension that replaces the browser's built-in PDF viewer with a
clean reader that runs entirely on your device. It has thumbnails, an outline,
full-text search, signing and two themes. **Nothing is uploaded:** PDF.js and
pdf-lib are bundled with the extension, and every PDF is processed in your browser.

## Features

- **Auto-open:** links to `.pdf` files open in the reader instead of the default viewer.
- **Continuous scrolling** with sharp rendering on high-DPI screens, plus zoom and fit-to-width.
- **Sidebar** with page thumbnails, the document outline (bookmarks) and full-text search across every page.
- **Sign documents:** draw a signature or type one in one of four handwriting fonts, place it on a page, drag and resize it, then save a flattened `…-signed.pdf`.
- **Themes:** switch between *Sprout* (light green) and *Parchment* (warm serif). Your choice is remembered.
- **Open local files** with the toolbar button, by drag-and-drop, or through `file://` URLs.
- **Private by design:** no remote code, no analytics, no network requests other than fetching the PDF you opened.

## Install

### Download (recommended)

No git or build tools needed.

1. Download **[private-pdf-reader-1.0.0.zip](https://github.com/jonra/private-pdf-reader/releases/latest/download/private-pdf-reader-1.0.0.zip)**
   from the [latest release](https://github.com/jonra/private-pdf-reader/releases/latest).
2. Unzip it. You get a folder called `private-pdf-reader`.
   Keep it somewhere permanent, because Chrome loads the extension from that folder.
3. Open `chrome://extensions` (or `edge://extensions`).
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and select the `private-pdf-reader` folder.
6. Open any `.pdf` link on the web. It loads in the reader.

To update, download the new release, replace the folder's contents and click
the reload icon on the extension's card.

### From source (load unpacked)

1. Clone this repository:
   ```bash
   git clone https://github.com/jonra/private-pdf-reader.git
   ```
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `pdf-reader-extension` folder.
5. Open any `.pdf` link on the web. It loads in the reader.

### Opening local files (optional)

To also open `file:///…/something.pdf` from your disk, go to the extension's
card in `chrome://extensions`, click **Details** and enable
**Allow access to file URLs**.

## Usage

| Action | How |
| --- | --- |
| Open a PDF from the web | Click any link ending in `.pdf` |
| Open a PDF from disk | Toolbar icon → **Open PDF**, or drag a file onto the reader |
| Search | Sidebar → **Search** tab, type and press Enter, then click a result to jump to it |
| Navigate | Sidebar → **Thumbnails** or **Outline** |
| Change theme | Click **🎨** |
| Sign | **✍️ Sign** → draw or type → place on the page → drag/resize → **⬇ Save signed** |

Signed PDFs are *flattened*: the signature is drawn into the page content and
saved as a new file. The original file is never modified.

## How it works

```
pdf-reader-extension/
├── manifest.json     Manifest V3 definition
├── background.js     Service worker: installs the redirect rules, handles the toolbar icon
├── viewer.html/.css/.js  The reader UI
├── lib/              Bundled PDF.js 3.11.174 (render) and pdf-lib 1.17.1 (signing)
├── fonts/            Bundled signature fonts (woff2)
└── icons/            Extension icons
```

1. `background.js` registers `declarativeNetRequest` rules that redirect
   top-level navigations to `http(s)://…/*.pdf` and `file://…/*.pdf` to
   `viewer.html?file=<original-url>`.
2. The viewer fetches the PDF bytes, renders the pages with PDF.js and builds
   the thumbnails, outline and search index locally.
3. When you sign, pdf-lib embeds the signature images into a copy of the
   document and the result is downloaded through the browser.

### Permissions

| Permission | Why |
| --- | --- |
| `declarativeNetRequest`, `declarativeNetRequestWithHostAccess` | Redirect PDF page loads to the local viewer |
| `host_permissions: <all_urls>` | Fetch the PDF from whichever site you opened it on |
| `tabs` | Open a reader tab when you click the toolbar icon |

## Limitations

- Only URLs ending in `.pdf` (optionally followed by `?query` or `#hash`) are
  redirected. PDFs served without a `.pdf` extension, identified only by their
  `Content-Type`, stay in the default viewer. Use the toolbar icon and
  **Open PDF** for those.
- Some servers block requests from extension pages or require cookies that the
  viewer cannot send. If a PDF won't load, download it and open it locally.
- Fillable forms (AcroForm/XFA) are displayed but cannot be filled in.
- The UI fonts fall back to system fonts to keep the package small. Only the
  signature fonts are bundled.

## Packaging for the Chrome Web Store

```bash
cd pdf-reader-extension
zip -r ../private-pdf-reader-$(jq -r .version manifest.json).zip . -x '.*'
```

Bump `version` in `manifest.json` before every new upload. The listing copy,
permission justifications and privacy answers are in
[docs/STORE-LISTING.md](docs/STORE-LISTING.md).

## Privacy

See [PRIVACY.md](PRIVACY.md). In short, the extension collects no data and sends
nothing anywhere.

## Contributing

Issues and pull requests are welcome. There is no build step: edit the files in
`pdf-reader-extension/`, then click the reload icon on the extension's card in
`chrome://extensions` to test. Please keep the extension free of remote code and
network calls other than fetching the PDF itself.

## License

[MIT](LICENSE). Bundled third-party libraries and fonts keep their own
licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

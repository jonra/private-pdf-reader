// Redirect every PDF navigation to our local viewer.
// We build the rule at runtime so we know our own extension URL.

const VIEWER = chrome.runtime.getURL("viewer.html"); // chrome-extension://<id>/viewer.html

const RULES = [
  {
    id: 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { regexSubstitution: VIEWER + "?file=\\0" }
    },
    condition: {
      // http/https URLs ending in .pdf (optionally followed by ?query or #hash)
      regexFilter: "^https?://[^?#]+\\.pdf([?#].*)?$",
      resourceTypes: ["main_frame"]
    }
  },
  {
    id: 2,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { regexSubstitution: VIEWER + "?file=\\0" }
    },
    condition: {
      // local file:// PDFs (requires "Allow access to file URLs" in chrome://extensions)
      regexFilter: "^file://.+\\.pdf$",
      resourceTypes: ["main_frame"]
    }
  }
];

function installRules() {
  chrome.declarativeNetRequest.updateDynamicRules(
    { removeRuleIds: RULES.map(r => r.id), addRules: RULES },
    () => { if (chrome.runtime.lastError) console.error(chrome.runtime.lastError); }
  );
}

chrome.runtime.onInstalled.addListener(installRules);
chrome.runtime.onStartup.addListener(installRules);
installRules();

// Toolbar icon: open a blank reader tab
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
});

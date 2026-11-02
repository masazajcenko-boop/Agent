// Боковая панель остаётся доступной по иконке расширения.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Отдельное окно агента: Ctrl+Shift+Y (на macOS — Command+Shift+Y).
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-agent-window") return;
  try {
    const current = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let tab = current.find((item) => /^https?:/i.test(item.url || ""));
    if (!tab) {
      const activeTabs = await chrome.tabs.query({ active: true });
      tab = activeTabs.find((item) => /^https?:/i.test(item.url || ""));
    }
    if (!tab?.id) {
      console.warn("Chrome Crawler: не найдена активная вкладка сайта http/https.");
      return;
    }
    await chrome.windows.create({
      url: chrome.runtime.getURL(`panel/sidepanel.html?targetTabId=${encodeURIComponent(tab.id)}`),
      type: "popup",
      width: 460,
      height: 760,
      focused: true
    });
  } catch (error) {
    console.error("Chrome Crawler: не удалось открыть отдельное окно.", error);
  }
});

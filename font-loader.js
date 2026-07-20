(() => {
  "use strict";

  const script = document.currentScript;
  const sourceHref = script?.dataset.fontHref;
  if (!sourceHref) return;

  const mobileFontLite = window.matchMedia("(max-width: 920px), (pointer: coarse)").matches;

  const getFontHref = () => {
    if (!mobileFontLite) return sourceHref;

    try {
      const url = new URL(sourceHref, window.location.href);
      const entries = [...url.searchParams.entries()].filter(([key, value]) => {
        if (key !== "family") return true;
        return !/^Noto (?:Sans|Serif) SC(?::|$)/.test(value);
      });

      url.search = "";
      entries.forEach(([key, value]) => url.searchParams.append(key, value));
      return url.toString();
    } catch {
      return sourceHref;
    }
  };

  const fontHref = getFontHref();
  const loadFontStyles = () => {
    if (document.querySelector(`link[data-deferred-fonts="${fontHref}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontHref;
    link.dataset.deferredFonts = fontHref;
    document.head.append(link);
  };

  const schedule = () => {
    const connection = navigator.connection;
    const constrained = Boolean(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ""));
    const delay = constrained ? 2400 : mobileFontLite ? 800 : 180;
    const idleTimeout = constrained ? 3200 : mobileFontLite ? 2200 : 1400;

    window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(loadFontStyles, { timeout: idleTimeout });
      } else {
        loadFontStyles();
      }
    }, delay);
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
})();
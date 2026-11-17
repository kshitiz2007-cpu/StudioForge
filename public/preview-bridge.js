(() => {
  const sessionId = document.documentElement.dataset.studioforgeSession;
  if (!sessionId) return;
  const protocol = "studioforge.preview.v1";
  const send = (type, payload = {}) => parent.postMessage({ protocol, type, sessionId, ...payload }, "*");
  let selected = null;
  const style = document.createElement("style");
  style.textContent = "[data-studioforge-hover]{outline:2px solid #38bdf8!important;outline-offset:2px!important;cursor:pointer!important}[data-studioforge-selected]{outline:2px solid #10b981!important;outline-offset:2px!important}";
  document.head.appendChild(style);

  const roleFor = (el) => {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (["p","span","label","small","strong","em"].includes(tag)) return "text";
    if (["img","picture"].includes(tag)) return "image";
    if (tag === "button") return "button";
    if (tag === "a") return "link";
    if (["input","textarea","select"].includes(tag)) return "input";
    if (["ul","ol","li"].includes(tag)) return "list";
    if (["main","section","header","footer","nav","article","aside"].includes(tag)) return "section";
    if (tag === "div") return "container";
    return "other";
  };

  const describe = (el) => {
    const rect = el.getBoundingClientRect();
    const computedStyle = getComputedStyle(el);
    const properties = ["display","position","width","height","marginTop","marginRight","marginBottom","marginLeft","paddingTop","paddingRight","paddingBottom","paddingLeft","gap","fontFamily","fontSize","fontWeight","lineHeight","color","backgroundColor","backgroundImage","borderRadius","boxShadow","textAlign","justifyContent","alignItems","flexDirection","gridTemplateColumns"];
    const computed = {};
    properties.forEach((key) => computed[key] = computedStyle[key]);
    const tagName = el.tagName.toLowerCase();
    const selector = (() => {
      if (el.id) return "#" + CSS.escape(el.id);
      const parts = [];
      let node = el;
      while (node && node !== document.body && node instanceof HTMLElement) {
        const name = node.tagName.toLowerCase();
        const siblings = node.parentElement ? [...node.parentElement.children].filter((child) => child.tagName === node.tagName) : [];
        parts.unshift(name + ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")");
        node = node.parentElement;
        if (node instanceof HTMLElement && node.id) { parts.unshift("#" + CSS.escape(node.id)); break; }
      }
      return parts.join(" > ");
    })();
    let elementId = el.getAttribute("data-studioforge-id");
    if (!elementId) {
      elementId = crypto.randomUUID();
      el.setAttribute("data-studioforge-id", elementId);
    }
    return {
      elementId, selector, tagName, role: roleFor(el),
      textPreview: (el.innerText || el.getAttribute("alt") || "").trim().slice(0,120),
      classNames: [...el.classList],
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      computed
    };
  };

  const eligible = (node) => node instanceof HTMLElement && !node.closest("[data-studioforge-ui]");
  document.addEventListener("pointerover", (event) => {
    const el = event.target instanceof Element ? event.target.closest("body *") : null;
    if (!eligible(el) || el === selected) return;
    document.querySelectorAll("[data-studioforge-hover]").forEach((node) => node.removeAttribute("data-studioforge-hover"));
    el.setAttribute("data-studioforge-hover", "");
    send("element-hovered", { element: describe(el) });
  }, true);

  document.addEventListener("pointerout", (event) => {
    if (event.target instanceof HTMLElement) event.target.removeAttribute("data-studioforge-hover");
    send("element-hovered", { element: null });
  }, true);

  document.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? event.target.closest("body *") : null;
    if (!eligible(el)) return;
    event.preventDefault();
    event.stopPropagation();
    if (selected) selected.removeAttribute("data-studioforge-selected");
    selected = el;
    selected.setAttribute("data-studioforge-selected", "");
    send("element-selected", { element: describe(selected) });
  }, true);

  window.addEventListener("message", (event) => {\n    const data = event.data;\n    if (event.source !== parent || !data || data.protocol !== protocol || data.sessionId !== sessionId || data.type !== "apply-style") return;\n    if (!selected || data.elementId !== selected.getAttribute("data-studioforge-id") || typeof data.property !== "string" || typeof data.value !== "string") return;\n    selected.style.setProperty(data.property, data.value);\n    send("style-applied", { operationId: data.operationId, element: describe(selected) });\n  });\n\n  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selected) {
      selected.removeAttribute("data-studioforge-selected");
      selected = null;
      send("element-selected", { element: null });
    }
  });
  send("ready");
})();

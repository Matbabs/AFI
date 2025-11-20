document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["price", "orderStop", "orderLimit"], (result) => {
    if (result.price) document.getElementById("price").value = result.price;
    if (result.orderStop)
      document.getElementById("order-stop").value = result.orderStop;
    if (result.orderLimit)
      document.getElementById("order-limit").value = result.orderLimit;
  });

  document.getElementById("price").addEventListener("input", (e) => {
    chrome.storage.local.set({ price: e.target.value });
  });
  document.getElementById("order-stop").addEventListener("input", (e) => {
    chrome.storage.local.set({ orderStop: e.target.value });
  });
  document.getElementById("order-limit").addEventListener("input", (e) => {
    chrome.storage.local.set({ orderLimit: e.target.value });
  });

  document.getElementById("buy").addEventListener("click", async () => {
    const userPrice = parseFloat(document.getElementById("price").value);
    const userStop = parseFloat(document.getElementById("order-stop").value);
    const userLimit = parseFloat(document.getElementById("order-limit").value);
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: buy,
      args: [userPrice, userStop, userLimit],
    });
  });
});

function buy(userPrice, userStop, userLimit) {
  function extractNumber(str) {
    return parseFloat(str.replace(/[^\d,.-]/g, "").replace(",", "."));
  }

  function renderEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = 100;
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(
            new Error(`Element ${selector} not found within ${timeout}ms`)
          );
        } else {
          setTimeout(checkElement, checkInterval);
        }
      };
      checkElement();
    });
  }

  function waitForButtonWithText(text, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = 100;
      const checkButton = () => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (btn) => btn.textContent.toLowerCase().includes(text.toLowerCase())
        );

        if (button) {
          resolve(button);
        } else if (Date.now() - startTime > timeout) {
          reject(
            new Error(
              `Button with text "${text}" not found within ${timeout}ms`
            )
          );
        } else {
          setTimeout(checkButton, checkInterval);
        }
      };

      checkButton();
    });
  }

  async function safeGetElement(selector, timeout = 10000) {
    return await waitForElement(selector, timeout);
  }

  (async () => {
    // enter shares number
    const sharePriceContainer = await safeGetElement(".orderForm__price");
    const sharePrice = extractNumber(
      sharePriceContainer.querySelector("span").innerText
    );

    const buySharesSpan = await safeGetElement("#orderFlow__marketbuyShares");
    const buySharesInput = buySharesSpan.querySelector("input");
    const userShares = Math.floor(userPrice / sharePrice);
    buySharesInput.value = userShares;
    renderEvents(buySharesInput);

    // order buy
    const orderLayout = await safeGetElement(".orderLayout__action");
    const orderButton = orderLayout.querySelector("button");
    orderButton.click();
    const orderButtonConfirm = await safeGetElement(
      '[data-qa="order-review-cta"]'
    );
    orderButtonConfirm.click();
    const finishButton = await waitForButtonWithText("fini");
    finishButton.click();

    // wait
    await new Promise((r) => setTimeout(r, 1000));

    // setup sell
    const sellTabButton = await safeGetElement("#orderFlowTabs__sellTab");
    sellTabButton.click();
    const sellSharesSpan = await safeGetElement("#orderFlow__marketsellShares");
    const sellSharesInput = sellSharesSpan.querySelector("input");
    sellSharesInput.value = userShares;
    renderEvents(sellSharesInput);

    // check performance
    const performance = await safeGetElement(
      ".instrumentPosition__performanceValue"
    );

    while (true) {
      await new Promise((r) => setTimeout(r, 500));
      const isNegativeSvg = performance.querySelector("svg");
      if (!isNegativeSvg) {
        continue;
      }
      const isNegative = isNegativeSvg?.classList.contains("-negative");
      const valueElement = performance.querySelectorAll("data")[0];
      if (!valueElement || !valueElement.innerText.includes("€")) {
        continue;
      }
      const value = extractNumber(valueElement.innerText);
      const shouldSell = isNegative ? value >= userStop : value >= userLimit;
      console.log({
        perf: isNegative ? "↓" : "↑",
        userStop: userStop,
        value: value,
        userLimit: userLimit,
        shouldSell: shouldSell,
      });
      if (shouldSell) {
        const orderLayout = await safeGetElement(".orderLayout__action");
        const orderButton = orderLayout.querySelector("button");
        orderButton.click();
        const orderButtonConfirm = await safeGetElement(
          '[data-qa="order-review-cta"]'
        );
        orderButtonConfirm.click();
        break;
      }
    }
  })();
}

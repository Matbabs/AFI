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
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

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

  // enter shares number
  const sharePriceContainer = document.querySelectorAll(".orderForm__price")[0];
  const sharePrice = extractNumber(
    sharePriceContainer.querySelector("span").innerText
  );
  const buySharesSpan = document.getElementById("orderFlow__marketbuyShares");
  const buySharesInput = buySharesSpan.querySelector("input");
  const userShares = Math.floor(userPrice / sharePrice);
  buySharesInput.value = userShares;
  renderEvents(buySharesInput);

  // order buy
  const orderLayout = document.querySelectorAll(".orderLayout__action")[0];
  const orderButton = orderLayout.querySelector("button");
  orderButton.click();
  sleep(1000);

  // setup sell
  const sellTabButton = document.getElementById("orderFlowTabs__sellTab");
  sellTabButton.click();
  const sellSharesSpan = document.getElementById("orderFlow__marketsellShares");
  const sellSharesInput = sellSharesSpan.querySelector("input");
  sellSharesInput.value = 100;
  renderEvents(sellSharesInput);
  const sellLayout = document.querySelectorAll(".orderLayout__action")[0];
  const sellButton = sellLayout.querySelector("button");

  // check performance
  const performance = document.getElementsByClassName(
    "instrumentPosition__performanceValue"
  )[0];
  for (let i = 0; i < 1000; i++) {
    const isNegativeSvg = performance.querySelector("svg");
    const isNegative = isNegativeSvg.classList.contains("-negative");
    const value = extractNumber(
      performance.querySelectorAll("data")[0].innerText
    );
    console.log(isNegative, value);
    if (
      (isNegative && value <= userStop) ||
      (!isNegative && value >= userLimit)
    ) {
      sellButton.click();
      break;
    }
  }
}

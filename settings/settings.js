// "options_ui": {
// 	"page": "settings/settings.html"
// },

function saveOptions(e) {
  e.preventDefault();
  browser.storage.sync.set({
    color: document.querySelector("#webhook").value,
  });
}

function restoreOptions() {
  function setCurrentChoice(result) {
    document.querySelector("#webhook").value = result;
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.sync.get("webhook");
  getting.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);

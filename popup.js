// State variables
let currentTabId = null;
let isMonitoring = false;
let currentSettings = null;

var statusEl
var toggleBtn
var intervalInput
var timestampEl
var indicesInput

console.log("popup.js loaded")

document.addEventListener("DOMContentLoaded", async ()=>{
	document.getElementById("debug").onclick = alert("javascript is working properly.")

	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	//   console.log("loaded on " + tab.url)
	//   document.body.innerHTML += tab.url
	currentTabId = tab.id;

	statusEl = document.getElementById('status');
	toggleBtn = document.getElementById('toggleCheck');
	intervalInput = document.getElementById('refreshInterval');
	timestampEl = document.getElementById('timestamp');
	indicesInput = document.getElementById('wantedIndices');

	if (true){//tab.url === "https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option"){
		document.body.style.backgroundColor = "white"
		document.getElementById("controls").style.display = "block"
		document.getElementById("hidden").style.display = "none"
	}

	// Get current monitoring state for this tab
	const state = await browser.runtime.sendMessage({
		action: "getTabState",
		tabId: currentTabId
	});

	updateUI(state);

	// Event listeners
	toggleBtn.addEventListener('click', toggleMonitoring);
})

// Update UI based on monitoring state
function updateUI(state) {
	isMonitoring = state?.isMonitoring || false;
	currentSettings = state?.settings || null;

	if (isMonitoring && currentSettings) {
		statusEl.textContent = `checking every ${currentSettings.interval/1000}s`;
		statusEl.className = 'status active';
		toggleBtn.textContent = 'stop';
		intervalInput.value = currentSettings.interval / 1000;
		indicesInput.value = currentSettings.indices;
	} else {
		statusEl.textContent = 'not checking this tab';
		statusEl.className = 'status inactive';
		toggleBtn.textContent = 'start';
	}

	//   if (state?.index !== undefined) {
	//     currentValueEl.textContent = state.lastValue || 'No value found';
	//   }

	if (state?.timestamp) {
		timestampEl.textContent = `Last check: ${new Date(state.timestamp).toLocaleTimeString()}`;
	} else {
		timestampEl.textContent = '';
	}
}

// Toggle monitoring state
async function toggleMonitoring() {
	if (isMonitoring) {
		// Stop monitoring
		await browser.runtime.sendMessage({
			action: "stopMonitoring",
			tabId: currentTabId
		});
		updateUI({ isMonitoring: false });
	} else {
		// Start monitoring
		const interval = parseInt(intervalInput.value) * 1000;
		const indices = indicesInput.value.trim().split(" ");

		if (!indices) {
			alert('enter valid indices');
			return;
		}

		if (isNaN(interval) || interval < 30000) {
			alert('enter interval of at least 30s');
			return;
		}

		await browser.runtime.sendMessage({
			action: "startMonitoring",
			tabId: currentTabId,
			interval: interval,
			indices: indicesInput.value.trim().split(" ")
		});

		updateUI({
			isMonitoring: true,
			settings: { interval, indices }
		});
	}
}

// Handle messages from background script
browser.runtime.onMessage.addListener((message) => {
	if (message.action === "checkDone" && message.tabId === currentTabId) {
		updateUI({
			isMonitoring: true,
			//   index: message.index,
			timestamp: message.timestamp,
			settings: currentSettings
		});
	}
});

// document.getElementById('apply').addEventListener('click', async () => {
	// 	const refreshInterval = parseInt(document.getElementById('refreshInterval').value) * 1000;
// 	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

// 	await browser.tabs.sendMessage(tab.id, {
// 		command: "stop"
// 	});

// 	await browser.tabs.sendMessage(tab.id, {
// 		command: "start",
// 		indices: document.getElementById('wantedIndices').value.split(" "),
// 		interval: refreshInterval
// 	});
// });

// document.getElementById('stop').addEventListener('click', async () => {
	// 	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

// 	await browser.tabs.sendMessage(tab.id, {
// 		command: "stop"
// 	});
// });
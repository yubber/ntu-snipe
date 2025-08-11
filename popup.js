let currentTabId = null;
let isMonitoring = false;
let currentSettings = null;

var statusEl
var toggleBtn
var intervalInput
var timestampEl
var indicesInput

let getTabState = async (tabId) => {
	let x = await browser.runtime.sendMessage({
		action: "getTabState",
		tabId: tabId
	});
	// console.log(`fetched tab ${tabId}'s state:`)
	// console.log(x)
	// console.log(x.settings)
	return x
}

// Update UI based on monitoring state
function updateUI(state) {
	isMonitoring = state?.isMonitoring || false;
	currentSettings = state?.settings || null;

	if (isMonitoring && currentSettings) {
		statusEl.textContent = `checking every ${currentSettings.interval/1000}s`;
		statusEl.className = 'status active';
		toggleBtn.textContent = 'stop';
		intervalInput.value = currentSettings.interval / 1000;
		indicesInput.value = currentSettings.indices.join(" ");
	} else {
		statusEl.textContent = 'not checking this tab';
		statusEl.className = 'status inactive';
		toggleBtn.textContent = 'start';
	}

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

		// update the tab env's indices
		// await browser.scripting.executeScript({
		// 	code: `indices = ${indices}`,
		// });

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

window.onload = async () => {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	currentTabId = tab.id;

	statusEl = document.getElementById('status');
	toggleBtn = document.getElementById('toggleCheck');
	intervalInput = document.getElementById('refreshInterval');
	timestampEl = document.getElementById('timestamp');
	indicesInput = document.getElementById('wantedIndices');

	if (tab.url === "https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option"){
		document.body.style.backgroundColor = "white"
		document.getElementById("controls").style.display = "block"
		document.getElementById("hidden").style.display = "none"
	}

	toggleBtn.addEventListener('click', toggleMonitoring);

	updateUI(await getTabState(currentTabId));
}
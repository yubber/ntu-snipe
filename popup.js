let currentTabId = null;
let isMonitoring = false;
let currentSettings = null;

var statusEl
var toggleBtn
var intervalInput
var timestampEl
var indicesInput

let getTabState = async (tabId) => {
	// console.log(`fetched tab ${tabId}'s state:`)
	return(await browser.runtime.sendMessage({
		action: "getTabState",
		tabId: tabId
	}))
	// console.log(x)
	// console.log(x.settings)
	// return x
}

function updateUI(state) {
	isMonitoring = state?.isMonitoring || false;
	currentSettings = state?.settings || null;

	if (isMonitoring && currentSettings) {
		statusEl.textContent = `checking every ${currentSettings.interval}s`;
		statusEl.className = 'status active';
		toggleBtn.textContent = 'stop';
		intervalInput.value = currentSettings.interval;
		console.log(currentSettings.indices)
		if (currentSettings.indices){
			indicesInput.value = currentSettings.indices.join(" ");
		}
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
		const interval = parseInt(intervalInput.value);
		const indices = indicesInput.value.trim().split(" ");

		if (!indices) {
			alert('enter valid indices');
			return;
		}

		if (isNaN(interval) || interval < 30) {
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

window.onload = async () => {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	currentTabId = tab.id;

	console.log("popup ", currentTabId)

	statusEl = document.getElementById('status');
	toggleBtn = document.getElementById('toggleCheck');
	intervalInput = document.getElementById('refreshInterval');
	timestampEl = document.getElementById('timestamp');
	indicesInput = document.getElementById('wantedIndices');

	if (true){
	// if (tab.url === "https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option"){
		// i enjoyed this album far earlier and in a much gayer, deeper and emotionally unstable way than you do
		document.body.style.backgroundColor = "rgb(138,206,0)"
		document.getElementById("controls").style.display = "block"
		document.getElementById("hidden").style.display = "none"
	}

	toggleBtn.addEventListener('click', toggleMonitoring);

	updateUI(await getTabState(currentTabId));

	// document.getElementById("debug").addEventListener("click", () => {
	// 	browser.storage.local.get(`ntusnipe_tabSettings_${currentTabId}`).then(e => {
	// 		console.log(JSON.stringify(e))
	// 	})
	// 	browser.alarms.getAll().then(e => {
	// 		console.log(JSON.stringify(e))
	// 	})
	// })
}
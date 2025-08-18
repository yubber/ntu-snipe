async function getTabSettings(tabId) {
	const result = await browser.storage.local.get(`ntusnipe_tabSettings_${tabId}`);
	return result[`ntusnipe_tabSettings_${tabId}`] || null;
}

// must always provide timestamp, interval and indices, because set just naively replaces the entire object
async function setTabSettings(tabId, settings) {
	await browser.storage.local.set({
		[`ntusnipe_tabSettings_${tabId}`]: settings
	});
}

async function clearTabSettings(tabId) {
	await browser.storage.local.remove(`ntusnipe_tabSettings_${tabId}`);
}

// scrape, check and refresh logic
async function searchTab(tabId, indices) {
	// console.log(await browser.tabs.get(tabId))
	try {
		console.log(tabId)
		// refresh page by going back and forward (to avoid form resubmission errors and to prevent site from erroring because of missing POST data), waiting for page loads
		await browser.tabs.goBack(tabId) // the promise is fulfilled when page nav finishes

		// clear cache to force refetching indices
		// in chrome it's origins, in firefox it's hostnames
		await browser.browsingData.removeCache({
			// origins: ['https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option']
			hostnames: [new URL("https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option").hostname] // this probably also clears cache for other pages :(
		}).then(
			()=>{},(err)=>{console.error(err)}
		);

		// maybe try this https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/update

		// go forward until back at the index pg. because sometimes it no worky
		for (let i = 0; i < 7; i++){
			await browser.tabs.goForward(tabId)
			await new Promise(resolve => setTimeout(resolve, 500)); // wait
		}
		let tab;
		let triesLeft = 10;
		while (triesLeft >= 0){
			await browser.tabs.goForward(tabId)
			await new Promise(resolve => setTimeout(resolve, 500)); // wait
			tab = (await browser.tabs.get(tabId))
			if (tab.url.includes("https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option")) {
				break
			}
			triesLeft--;
		}

		if (triesLeft < 0){
			console.error("couldn't refresh")
			browser.notifications.create({
				type: "basic",
				title: 'NTU Snipe error',
				message: `Failed to refresh page`
			});
		}

		let data = await browser.scripting.executeScript({
			target: {tabId: tabId},
			func: ()=>{
				let scraped = {}

				Array.from(document.querySelectorAll("select[name='new_index_nmbr']>option"))
				.filter(e =>  // matches regex "5digit / digit+ / digit+"
					(/\d{5} \/ \d+ \/ \d+/gm).test(e.innerText)
				)
				.forEach(e => {
					scraped[e.value.toString()] = parseInt(e.innerText.split("/")[1].trim()) // index : slots
				})

				// apparently mutating the dom this way gets preserved when you refresh by navigation
				// prepend refresh log to last p elem
				document.querySelector('p:last-of-type').insertAdjacentHTML('afterbegin', `refreshed at: ${new Date().toLocaleTimeString()}<br>`)

				return scraped;
			},
			world: 'MAIN' // not very good but NOTHING ELSE WORKS https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld
		})

		data = data[0].result
		// console.log("data: ",data)
		// console.log("indices: ",indices)

		for (const i of indices){
			// console.log(i, data[i.toString()] > 0)
			if (data[i.toString()] > 0){
				return [i, data[i]]
			}
		}
		return null

	} catch (error) {
		console.error(`failed in tab ${tabId}:`, error);
		return null;
	}
}

// perform 1 check, handles messages to update state etc.
const checkAndReport = async (tabId) => {
	try {
		const settings = await getTabSettings(tabId);
		const { interval, indices } = settings;

		const [index, slots] = (await searchTab(tabId, indices)) ?? [null, null]

		browser.runtime.sendMessage({
			action: "checkDone",
			tabId: tabId,
			index: index,
			timestamp: Date.now()
		}).catch(() => {});

		await setTabSettings(tabId, {
			timestamp: Date.now(),
			indices: indices,
			interval: interval
		})

		// if found
		if (index != null){
			// using the notif here instead, in case content script doesn't run
			browser.notifications.create({
				type: "basic",
				title: 'Course index found!',
				message: `${index} with ${slots} slots left`
			});
		}
	} catch (error) {
		console.error(`check failed for tab ${tabId}:`, error);
		stopMonitoring(tabId);
	}
}

// set up constant check on a tab
const monitorTab = async (tabId) => {
	const settings = await getTabSettings(tabId);
	if (!settings) {
		console.error(`monitor failed: could not get settings for tab ${tabId}`)
		return;
	}

	const { interval, indices } = settings;

	browser.alarms.create(
		`ntusnipe_${tabId}`,
		{
			delayInMinutes: 0.1,
			periodInMinutes: interval / 60
		}
	)
}

browser.alarms.onAlarm.addListener((alarm) => {
	// console.log(`received alarm ${alarm.name}`)
	let [extension, tabId] = alarm.name.split("_")
	if (extension === "ntusnipe"){
		tabId = parseInt(tabId)
		checkAndReport(tabId)
	}
});

// deletes alarm and clears monitors var
function stopMonitoring(tabId) {
	if (!browser.alarms.clear(`ntusnipe_${tabId}`)){
		console.error(`couldn't delete alarm ${tabId}`)
	}
}

browser.runtime.onMessage.addListener(async (message, sender) => {
	switch (message.action) {
		case "startMonitoring":
			await setTabSettings(message.tabId, {
				interval: message.interval,
				indices: message.indices,
				timestamp: Date.now()
			});
			monitorTab(message.tabId);
			break;
		case "stopMonitoring":
			stopMonitoring(message.tabId);
			await clearTabSettings(message.tabId);
			break;
		case "getTabState":
			return Promise.resolve({
				isMonitoring: (await browser.alarms.get(`ntusnipe_${message.tabId}`)) !== undefined,
				settings: await getTabSettings(message.tabId)
			});
	}
});

// Tab lifecycle management
browser.tabs.onRemoved.addListener((tabId) => {
	stopMonitoring(tabId);
	clearTabSettings(tabId);
});

// Restore monitoring on extension restart
browser.runtime.onStartup.addListener(async () => {
	const allItems = await browser.storage.local.get();
	Object.keys(allItems)
		.filter(key => key.startsWith('ntusnipe_tabSettings_'))
		.forEach(async (key) => {
			const tabId = parseInt(key.split('_').at(-1));
			try {
				await browser.tabs.get(tabId); // Verify tab exists
				monitorTab(tabId);
			} catch {
				await clearTabSettings(tabId);
			}
		});
});

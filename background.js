const activeMonitors = {};

async function getTabSettings(tabId) {
	const result = await browser.storage.local.get(`ntusnipe_tabSettings_${tabId}`);
	return result[`ntusnipe_tabSettings_${tabId}`] || null;
}

async function setTabSettings(tabId, settings) {
  await browser.storage.local.set({
	[`ntusnipe_tabSettings_${tabId}`]: settings
  });
}

async function clearTabSettings(tabId) {
  await browser.storage.local.remove(`ntusnipe_tabSettings_${tabId}`);
}

async function searchTab(tabId, indices) {
	// console.log(await browser.tabs.get(tabId))
	try {
		// refresh page by going back and forward (to avoid form resubmission errors and to prevent site from erroring because of missing POST data), waiting for page loads
		await browser.tabs.goBack(tabId) // the promise is fulfilled when page nav finishes

		// go forward until back at the index pg. because sometimes it no worky
		let tab;
		let triesLeft = 10;
		while (triesLeft >= 0){
			await browser.tabs.goForward(tabId)
			tab = (await browser.tabs.get(tabId))
			if (tab.url.includes("https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option")) {
				break
			}
			await new Promise(resolve => setTimeout(resolve, 500)); // wait
			triesLeft--;
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

				// console.log("grabbed data ", scraped)

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

// Monitoring logic
async function monitorTab(tabId) {
  if (activeMonitors[tabId]) return;

  const settings = await getTabSettings(tabId);
  if (!settings) return;

  const { interval, indices } = settings;

  const checkAndRefresh = async () => {
	try {
		// Verify tab still exists
		const tab = await browser.tabs.get(tabId);

		// refresh and check
		console.log(`searching tab ${tabId} for ${indices}`)
		
		// if not found, both null
		const [index, slots] = (await searchTab(tabId, indices)) ?? [null, null]

		browser.runtime.sendMessage({
			action: "checkDone",
			tabId: tabId,
			index: index,
			timestamp: Date.now()
		}).catch(() => {});

		await setTabSettings(tabId, {
			timestamp: Date.now()
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

		// Wait for page load to start timer
		const onCompleted = (updatedTabId, changeInfo) => {
			if (updatedTabId === tabId && changeInfo.status === 'complete') {
				browser.tabs.onUpdated.removeListener(onCompleted);
				activeMonitors[tabId] = setTimeout(() => checkAndRefresh(), interval);
			}
		};

		browser.tabs.onUpdated.addListener(onCompleted);

	} catch (error) {
		console.error(`Monitoring failed for tab ${tabId}:`, error);
		stopMonitoring(tabId);
	}
  };

  // Start the monitoring cycle
  checkAndRefresh();
}

function stopMonitoring(tabId) {
  if (activeMonitors[tabId]) {
	clearTimeout(activeMonitors[tabId]);
	delete activeMonitors[tabId];
  }
}

// Message handling
browser.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.action) {
	case "startMonitoring":
	  await setTabSettings(message.tabId, {
		interval: message.interval,
	  	indices: message.indices
	  });
	  monitorTab(message.tabId);
	  break;

	case "stopMonitoring":
	  stopMonitoring(message.tabId);
	  await clearTabSettings(message.tabId);
	  break;

	case "getTabState":
		const settings = await getTabSettings(message.tabId);
		return Promise.resolve({
			isMonitoring: !!activeMonitors[message.tabId],
			settings: settings,
			lastValue: (await browser.storage.local.get(`lastValue_${message.tabId}`))[`lastValue_${message.tabId}`]
		});
		break
  }
});

// Tab lifecycle management
browser.tabs.onRemoved.addListener((tabId) => {
	stopMonitoring(tabId);
	clearTabSettings(tabId);
	browser.storage.local.remove(`lastValue_${tabId}`);
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

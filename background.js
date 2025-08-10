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
	try {
		/*
		1. refresh page by going back and forward (to avoid form resubmission errors and to prevent site from erroring because of missing POST data), waiting for page loads
		2. setup message listener
		3. send message ordering check, with indices
		5. once promise is resolved return search results
		*/
		// background.js
		let data = await browser.tabs.goBack(tabId).then(()=>{ // the promise is fulfilled when page nav finishes
			browser.tabs.goForward(tabId).then(()=>{
				browser.scripting.executeScript({
					target: {tabId: tabId},
					func: ()=>{
						let scraped = {}

						Array.from(document.querySelectorAll("select[name='new_index_nmbr']>option"))
							// indices not defined
							// .filter(e => indices.includes(`${e.value}`)) // list of elems
							.filter(e =>  // matches regex "5digit / digit+ / digit+"
								(/\d{5} \/ \d+ \/ \d+/gm).test(e.innerText)
							)
							.forEach(e => {
								scraped[e.value.toString()] = parseInt(e.innerText.split("/")[1].trim()) // index : slots
							})

						return scraped;
					},
					world: 'MAIN' // not very good but NOTHING ELSE WORKS https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld
				}).catch(err => {
					console.error("Injection failed:", err);
				});
			})
		})

		console.log(data)
		if (data === undefined){

		}

		for (const i of indices){
			if (data[i.toString()] > 0){
				new Notification('Course index found!',{
					body: `${i} with ${data[i.toString()]} slots left`
				});

				return i
			}
		}
		console.log("this iteration's search failed...")
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
		const index = await searchTab(tabId, indices);

		browser.runtime.sendMessage({
			action: "checkDone",
			tabId: tabId,
			// index: index,
			timestamp: Date.now()
		}).catch(() => {});

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

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

// execute the function once tab loaded. returning is jank because of the listener
async function waitForLoad(tabId, func) {
	browser.tabs.onUpdated.addListener(async (updatedTabId, changeInfo) => {
		if (updatedTabId === tabId && changeInfo.status === 'complete') {
			browser.tabs.onUpdated.removeListener(onCompleted);
			await func();
		}
	});
}

async function searchTab(tabId) {
  try {
	// console.log(await getTabSettings(tabId))
	await browser.tabs.executeScript(tabId, {
		// refresh and skip confirmation. can't use query string, stars freaks out if unrecognized query is there
		// stars also freaks out if you do a hacky url manipulation method because the http data is different...
		// at worst, about:config -> dom.confirm_repost.testing.always_accept = true
		code: "window.history.back();"
	});

	// wait until loaded, then go to original pg
	waitForLoad(tabId, async () => {
		console.log("hi")
		await browser.tabs.executeScript(tabId, {
			code: "window.history.forward();"
		})
	});

	// wait, with blocking. can't wrap the return stuff in this because of return jank
	waitForLoad(tabId, async () => {
		return;
	});

	let result = await browser.tabs.executeScript(tabId, {
		file: "scripts/findIndex.js"
	})

	return results?.[0] || null;
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

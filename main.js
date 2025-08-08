function scrapeOptions(indices){
	let data = {}

	Array.from(document.querySelectorAll("select[name='new_index_nmbr']>option"))
		.filter(e => indices.includes(`${e.value}`)) // list of elems
		.forEach(e => {
			data[e.value] = parseInt(e.innerText.split("/")[1].trim()) // {index : slots}
		})

	return data
}

function selectIndex(data, indices){
	for (const i of indices){
		if (data[i] > 0){
			return i
		}
	}
	console.log("this iteration's search failed...")
	return undefined
}

window.onload = () => {
	browser.runtime.onMessage.addListener((message) => {
		if (message.action === "check" && message.tabId === currentTabId) {
			const indices = message.indices



			let data = scrapeOptions(indices)
			let result = selectIndex(data, indices)
			if (result !== undefined){
				alert(`Course index found:\n${result} with ${data[result]} slots left`)
				new Notification('Course index found!',{
					body: `${result} with ${data[result]} slots left`
				});

				document.querySelector("select[name='new_index_nmbr']").value = result
			}
		}
	})
}
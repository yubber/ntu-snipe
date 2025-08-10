function scrapeOptions(indices){
	let data = {}

	Array.from(document.querySelectorAll("select[name='new_index_nmbr']>option"))
		.filter(e => indices.includes(`${e.value}`)) // list of elems
		.forEach(e => {
			data[e.value] = parseInt(e.innerText.split("/")[1].trim()) // index : slots
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

indices = getTabSettings(tabId)

let data = scrapeOptions(message.indices)
let result = selectIndex(data, message.indices)
if (result !== undefined){
	new Notification('Course index found!',{
		body: `${i} with ${data[i]} slots left`
	});

	document.querySelector("select[name='new_index_nmbr']").value = result
}
result // this is returned if tabs.executeScript is called
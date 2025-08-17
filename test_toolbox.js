// these are snippets to paste in the dev console, useful for testing.

// get all indices of a course that have no slots left
(()=>{
	let scraped = {}
	Array.from(document.querySelectorAll("select[name='new_index_nmbr']>option"))
		.filter(e =>  // matches regex "5digit / digit+ / digit+"
			(/\d{5} \/ \d+ \/ \d+/gm).test(e.innerText)
		)
		.forEach(e => {
			scraped[e.value.toString()] = parseInt(e.innerText.split("/")[1].trim()) // index : slots
		})
	copy(Object.keys(scraped).filter(e=>scraped[e]===0).join(" "))
})()
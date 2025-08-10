console.log("hiiii")

// begone redeclaration error
// reportIndices.js
(()=>{
	let data = {}

	Array.from(document.querySelectorAll("select[name='new_index_nmbr']>option"))
		// indices not defined
		// .filter(e => indices.includes(`${e.value}`)) // list of elems
		.filter(e =>  // matches regex "5digit / digit+ / digit+"
			(/\d{5} \/ \d+ \/ \d+/gm).test(e.innerText)
		)
		.forEach(e => {
			data[e.value.toString()] = parseInt(e.innerText.split("/")[1].trim()) // index : slots
		})

	return data;
})()

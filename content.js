// doesn't seem to run consistently when refreshing idfk
/*
"content_scripts": [{
	"matches": ["https://wish.wis.ntu.edu.sg/pls/webexe/AUS_STARS_MENU.menu_option"],
	"js": ["content.js"],
	"run_at": "document_end"
}],
*/
browser.runtime.onMessage.addListener((message) => {
	if (message.action === "checkDone") {
		// if index in dropdown
		if (document.querySelector("select[name='new_index_nmbr']>content").map(e=>parseInt(e.innerText.split("/")[1].trim())).includes(message.index)){
			document.querySelector("select[name='new_index_nmbr']").value = message.index
			alert(`found ${message.index}`)
		}
	}
});
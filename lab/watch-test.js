import fs from "fs";

//let watcher=fs.watch("attic/test",{recursive: true});
let watcher=fs.watch(".",{recursive: true},(e,filename)=>{
	console.log("change here",e,filename);
});

/*watcher.addEventListener("change",e=>{
	console.log("change ev")
});*/

watcher.on("change",(e,filename)=>{
	console.log("change",e,filename);
});

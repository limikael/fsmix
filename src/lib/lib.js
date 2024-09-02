import IndexKv from "./IndexKv.js";
import KeyFs from "./KeyFs.js";

//export {IndexFs} from "./IndexFs.js";
//export {KeyFs} from "./KeyFs.js";

export function createIndexFs({indexedDB, dbName, cacheMaxItems, stats}={}) {
	let kv=new IndexKv({indexedDB, dbName, cacheMaxItems});
	let fs=new KeyFs(kv,{stats});
	return fs;
}

export async function initIndexFs(options) {
	let fs=createIndexFs(options);
	await fs.init();
	return fs;
}
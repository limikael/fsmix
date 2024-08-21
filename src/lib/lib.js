import IndexKv from "./IndexKv.js";
import KeyFs from "./KeyFs.js";

//export {IndexFs} from "./IndexFs.js";
//export {KeyFs} from "./KeyFs.js";

export function createIndexFs({indexedDB, dbName}={}) {
	let kv=new IndexKv({indexedDB, dbName});
	return new KeyFs(kv);
}
import {ResolvablePromise, splitPath, callbackify} from "../utils/js-util.js";
import {requestPromise} from "../utils/idb-util.js";
import path from "path-browserify";
import StatMap from "../utils/StatMap.js";
import FileError from "../utils/FileError.js";
import Stat from './Stat.js';
import KeyFsPromises from "./KeyFsPromises.js";

/*
	func:
	- readFile
	- writeFile
	- link
	- readdir
	- stat
	- lstat
	- symlink
	- readlink
	- realpath
	- rename
	- rmdir, rm, unlink

	skip for now:
	- copyFile, cp
	- lutimes
	- utimes
*/

export class KeyFs extends EventTarget {
	constructor(kv) {
		super();

		this.kv=kv;
		this.kv.addEventListener("error",ev=>{
			let dispatchEv=new Event("error");
			dispatchEv.error=ev.error;
			this.dispatchEvent(dispatchEv);
		});

		this.promises=new KeyFsPromises(this);

		let funcs=[
			"readFile", "writeFile", 
			"mkdir", "readdir",
			"stat", "lstat",
			"link", "unlink", "symlink", "readlink",
			"rm", "rmdir", 
			"realpath",
			"rename"
		];

		for (let func of funcs)
			this[func]=callbackify(this.promises[func].bind(this.promises));
	}

	generateId() {
		return crypto.randomUUID();
	}

	async init() {
		if (this.initPromise)
			return this.initPromise;

		this.initPromise=new ResolvablePromise();

		try {
			this.statMap=new StatMap(await this.kv.get("index"));
			this.initPromise.resolve();
		}

		catch (e) {
			this.initPromise.reject(e);
		}

		return this.initPromise;
	}

	async sync() {
		if (this.saveIndexTimeout) {
			clearTimeout(this.saveIndexTimeout)
			this.saveIndexTimeout=null;
		}

		await this.kv.set("index",this.statMap.getData());
		await this.kv.sync();
	}

	scheduleSaveIndex() {
		if (this.saveIndexTimeout)
			return;

		//console.log("will save index...")
		this.saveIndexTimeout=setTimeout(()=>{
			this.saveIndexTimeout=null;
			console.log("saving index");
			this.kv.set("index",this.statMap.getData())
				.then(()=>{
					console.log("index saved");
				});
		},5000);
	}

	async op(type, fn) {
		await this.init();
		let res=await fn();

		if (type=="readwrite")
			this.scheduleSaveIndex();
			//await this.kv.set("index",this.statMap.getData());

		return res;
	}

	existsSync(name) {
		if (!this.initPromise || !this.initPromise.isSettled())
			throw new Error("Can't call existsSync before init");

		if (this.statMap.get(name))
			return true;

		else
			return false;
	}
}

export default KeyFs;
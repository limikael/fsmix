import {ResolvablePromise, splitPath, callbackify} from "../utils/js-util.js";
import {requestPromise} from "../utils/idb-util.js";
import path from "path-browserify";
import StatMap from "../utils/StatMap.js";
import FileError from "../utils/FileError.js";

/*
	func:
	- readFile
	- writeFile

	- stat
	- lstat
	- link
	- symlink
	- readdir
	- readlink
	- realpath
	- rename
	- rmdir
	- rm
	- unlink
	- copyFile, cp

	skip:
	- lutimes
	- utimes
*/

class IndexFsPromises {
	constructor(fs) {
		this.fs=fs;
	}

	async writeFile(name, content) {
		return await this.fs.op("readwrite",async store=>{
			if (typeof content=="string" ||
					ArrayBuffer.isView(content))
				content=new Blob([content]);

			if (!content instanceof Blob)
				throw new Error("Need something blobbable.");

			let stat=this.fs.statMap.get(name);
			if (stat) {
				if (stat.type!="file")
					throw new FileError("ENOTFILE");

				await requestPromise(store.put(content,stat.key));
			}

			else {
				//console.log("create: "+name);
				stat=this.fs.statMap.create(name,"file");
				stat.key=await requestPromise(store.add(content));
			}
		});
	}

	async readFile(name, encoding) {
		return await this.fs.op("readonly",async store=>{
			let stat=this.fs.statMap.get(name);
			if (!stat)
				throw new FileError("ENOENT");

			if (stat.type!="file")
				throw new FileError("ENOTFILE");

			let content=await requestPromise(store.get(stat.key));
			if (encoding=="utf8")
				content=await content.text();

			else if (encoding)
				throw new Error("Can only handle utf8 encoding");

			return content
		});
	}

	async mkdir(name) {
		return await this.fs.op("readwrite",async store=>{
			this.fs.statMap.create(name,"dir");
		});
	}
}

export default class IndexFs {
	constructor({dbName, indexedDB}) {
		this.dbName=dbName;
		this.indexedDB=indexedDB;
		this.promises=new IndexFsPromises(this);

		let funcs=[
			"readFile", "writeFile", "mkdir"
		];

		for (let func of funcs)
			this[func]=callbackify(this.promises[func].bind(this.promises));
	}

	async init() {
		if (this.initPromise)
			return this.initPromise;

		this.initPromise=new ResolvablePromise();
		let req=this.indexedDB.open(this.dbName,1);
		req.onupgradeneeded=(ev)=>{
			let db=ev.target.result;
			db.createObjectStore("files",{autoIncrement: true});
			//console.log("** upgrade event");
		}

		try {
			this.db=await requestPromise(req);

			let transaction=this.db.transaction(["files"],"readonly");
			let store=transaction.objectStore("files");
			this.statMap=new StatMap(await requestPromise(store.get("index")));
			await requestPromise(transaction);

			this.initPromise.resolve();
		}

		catch (e) {
			this.initPromise.reject(e);
		}

		return this.initPromise;
	}

	async op(type, fn) {
		await this.init();
		let transaction=this.db.transaction(["files"],type);
		let store=transaction.objectStore("files");
		let res=await fn(store);
		if (type=="readwrite")
			await requestPromise(store.put(this.statMap.getData(),"index"));

		await requestPromise(transaction);
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
import {ResolvablePromise, splitPath, callbackify} from "../utils/js-util.js";
import {requestPromise} from "../utils/idb-util.js";
import path from "path-browserify";
import StatMap from "../utils/StatMap.js";
import FileError from "../utils/FileError.js";
import Stat from './Stat.js';

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

			if (!(content instanceof Blob))
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

			stat.size=content.size;
			stat.mtimeMs=Date.now();
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

			return content;
		});
	}

	async mkdir(name) {
		return await this.fs.op("readwrite",async store=>{
			this.fs.statMap.create(name,"dir");
		});
	}

	async stat(name) {
		await this.fs.init();
		let stat=this.fs.statMap.get(name);
		if (!stat)
			throw new FileError("ENOENT");

		return new Stat(stat);
	}

	async link(oldName, newName) {
		return await this.fs.op("readwrite",async store=>{
			this.fs.statMap.link(oldName,newName);
		});
	}

	// todo: recursive
	async unlink(name, options) {
		return await this.fs.op("readwrite",async store=>{
			let entry=this.fs.statMap.unlink(name);
			if (entry.nlink==0 && entry.type=="file") {
				await requestPromise(store.delete(entry.key));
			}
		});
	}

	async rm(name, options) {
		return await this.unlink(name,options);
	}

	async rmdir(name, options) {
		return await this.unlink(name,options);
	}

	async readdir(name) {
		let entry=this.fs.statMap.get(name);
		if (!entry)
			throw new FileError("ENOENT");

		if (entry.type!="dir")
			throw new FileError("ENOTDIR");

		return Object.keys(entry.children);
	}
}

export default class IndexFs {
	constructor({dbName, indexedDB}) {
		if (!dbName)
			dbName="files";

		if (!indexedDB)
			indexedDB=globalThis.indexedDB;

		this.dbName=dbName;
		this.indexedDB=indexedDB;
		this.promises=new IndexFsPromises(this);

		let funcs=[
			"readFile", "writeFile", "mkdir", "stat", "link",
			"unlink", "rm", "rmdir", "readdir"
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
		if (type=="readwrite") {
			await requestPromise(store.put(this.statMap.getData(),"index"));
			await requestPromise(transaction);
		}

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
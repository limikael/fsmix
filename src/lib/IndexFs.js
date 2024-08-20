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

	skip for now:
	- copyFile, cp
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
				return await content.text();

			else if (encoding=="blob")
				return content;

			else if (encoding)
				throw new Error("Can only handle utf8 encoding");

			//console.log(content);

			return new Uint8Array(await (new Response(content)).arrayBuffer());
		});
	}

	_mkdir(name, {recursive}={}) {
		if (!recursive) {
			this.fs.statMap.create(name,"dir");
			return;
		}

		let current=this.fs.statMap.get(name);
		if (current) {
			if (current.type!="dir")
				throw new FileError("ENOTDIR");

			return;
		}

		let splitName=splitPath(name);
		let parentSplit=splitName.slice(0,splitName.length-1);
		this._mkdir(parentSplit,{recursive});

		this.fs.statMap.create(name,"dir");
	}

	async mkdir(name, options) {
		return await this.fs.op("readwrite",async store=>{
			this._mkdir(name,options);
		});
	}

	async stat(name) {
		await this.fs.init();
		let stat=this.fs.statMap.get(name);
		if (!stat)
			throw new FileError("ENOENT");

		return new Stat(stat);
	}

	async lstat(name) {
		await this.fs.init();
		let stat=this.fs.statMap.lget(name);
		if (!stat)
			throw new FileError("ENOENT");

		return new Stat(stat);
	}

	async link(oldName, newName) {
		return await this.fs.op("readwrite",async store=>{
			this.fs.statMap.link(oldName,newName);
		});
	}

	async _unlink(store, name, options={}) {
		if (options.recursive) {
			let stat=this.fs.statMap.lget(name);
			if (!stat)
				throw new FileError("ENOENT");

			let splitName=splitPath(name);
			if (stat.type=="dir") {
				for (let child of Object.keys(stat.children)) {
					let childName=[...splitName,child];
					await this._unlink(store,childName,options);
				}
			}
		}

		let entry=this.fs.statMap.unlink(name);
		if (entry.nlink==0 && entry.type=="file") {
			await requestPromise(store.delete(entry.key));
		}
	}

	async unlink(name, options={}) {
		return await this.fs.op("readwrite",async store=>{
			await this._unlink(store,name,options)
		});
	}

	async rm(name, options={}) {
		await this.fs.init();
		return await this.unlink(name,options);
	}

	async rmdir(name, options={}) {
		await this.fs.init();
		return await this.unlink(name,options);
	}

	async symlink(target, name) {
		return await this.fs.op("readwrite",async store=>{
			let entry=this.fs.statMap.create(name,"symlink");
			entry.target=target;
		});
	}

	async readlink(name) {
		return await this.fs.op("readonly",async store=>{
			let entry=this.fs.statMap.lget(name);
			if (!entry)
				throw new FileError("ENOENT");

			if (entry.type!="symlink")
				throw new FileError("EINVAL");

			return entry.target;
		});
	}

	async readdir(name) {
		await this.fs.init();
		let entry=this.fs.statMap.get(name);
		if (!entry)
			throw new FileError("ENOENT");

		if (entry.type!="dir")
			throw new FileError("ENOTDIR");

		return Object.keys(entry.children);
	}

	async realpath(name) {
		await this.fs.init();
		return this.fs.statMap.realpath(name);
	}

	async rename(from, to) {
		return await this.fs.op("readwrite",async store=>{
			this.fs.statMap.rename(from,to);
		});
	}
}

export class IndexFs {
	constructor({dbName, indexedDB}={}) {
		if (!dbName)
			dbName="files";

		if (!indexedDB)
			indexedDB=globalThis.indexedDB;

		this.dbName=dbName;
		this.indexedDB=indexedDB;
		this.promises=new IndexFsPromises(this);

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

export default IndexFs;
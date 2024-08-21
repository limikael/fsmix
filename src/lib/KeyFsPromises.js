import {ResolvablePromise, splitPath, callbackify} from "../utils/js-util.js";
import {requestPromise} from "../utils/idb-util.js";
import path from "path-browserify";
import StatMap from "../utils/StatMap.js";
import FileError from "../utils/FileError.js";
import Stat from './Stat.js';

export default class KeyFsPromises {
	constructor(fs) {
		this.fs=fs;
	}

	async writeFile(name, content) {
		return await this.fs.op("readwrite",async ()=>{
			if (typeof content=="string" ||
					ArrayBuffer.isView(content))
				content=new Blob([content]);

			if (!(content instanceof Blob))
				throw new Error("Need something blobbable.");

			let stat=this.fs.statMap.get(name);
			if (stat) {
				if (stat.type!="file")
					throw new FileError("ENOTFILE");

				await this.fs.kv.set(stat.key,content);
			}

			else {
				//console.log("create: "+name);
				stat=this.fs.statMap.create(name,"file");
				stat.key=this.fs.generateId();
				await this.fs.kv.set(stat.key,content);
			}

			stat.size=content.size;
			stat.mtimeMs=Date.now();
		});
	}

	async readFile(name, encoding) {
		return await this.fs.op("readonly",async ()=>{
			let stat=this.fs.statMap.get(name);
			if (!stat)
				throw new FileError("ENOENT");

			if (stat.type!="file")
				throw new FileError("ENOTFILE");

			let content=await this.fs.kv.get(stat.key);
			if (!content) {
				throw new Error("Inode missing, fn="+name+" inode="+JSON.stringify(stat));
			}

			if (encoding=="utf8")
				return await content.text();

			else if (encoding=="blob")
				return content;

			else if (encoding)
				throw new Error("Can only handle utf8 encoding");

			//console.log(content);

			let uint8Array=new Uint8Array(await (new Response(content)).arrayBuffer());
			//console.log("haxxing uint8array");
			uint8Array.toString=function() {
				let decoder=new TextDecoder();
				return decoder.decode(this);
			}
			return uint8Array;
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
			await this.fs.kv.delete(entry.key);
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

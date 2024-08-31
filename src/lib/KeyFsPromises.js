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
			this.fs.contentConverter.assertValidContent(content);
			let stat=this.fs.statMap.get(name);
			if (stat) {
				if (stat.type!="file")
					throw new FileError("ENOTFILE");
			}

			else {
				//console.log("create: "+name);
				stat=this.fs.statMap.create(name,"file");
				stat.key=this.fs.generateId();
			}

			//console.log("write: "+name+" sync: "+this.fs.isSync(name));

			if (this.fs.isSync(name))
				this.fs.kv.setSync(stat.key,content);

			else
				await this.fs.kv.set(stat.key,content);

			stat.size=this.fs.contentConverter.getContentSize(content);
			stat.mtimeMs=Date.now();

			this.fs.notifyWatchers(name,"change");
		});
	}

	async readFile(name, encoding="buffer") {
		return await this.fs.op("readonly",async ()=>{
			let stat=this.fs.statMap.get(name);
			if (!stat)
				throw new FileError("ENOENT");

			if (stat.type!="file")
				throw new FileError("ENOTFILE");

			let content=await this.fs.kv.get(stat.key);
			if (content===undefined)
				throw new Error("Inode missing, fn="+name+" inode="+JSON.stringify(stat));

			return this.fs.contentConverter.convert(content,encoding);
		});
	}

	async mkdir(name, options) {
		await this.fs.init();
		this.fs.mkdirSync(name,options);
	}

	async stat(name) {
		await this.fs.init();
		return this.fs.statSync(name);
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

	async unlink(name, options={}) {
		await this.fs.init();
		this.fs.unlinkSync(name,options);
		/*return await this.fs.op("readwrite",async store=>{
			await this._unlink(store,name,options)
		});*/
	}

	async rm(name, options={}) {
		await this.fs.init();
		this.fs.unlinkSync(name,options);
		//return await this.unlink(name,options);
	}

	async rmdir(name, options={}) {
		await this.fs.init();
		this.fs.unlinkSync(name,options);
		//return await this.unlink(name,options);
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
		return this.fs.readdirSync(name);
	}

	async realpath(name) {
		await this.fs.init();
		return this.fs.statMap.realpath(name);
	}

	async rename(from, to) {
		return await this.fs.op("readwrite",async store=>{
			this.fs.statMap.rename(from,to);
			this.fs.notifyWatchers(from,"change");
			this.fs.notifyWatchers(to,"change");
		});
	}
}

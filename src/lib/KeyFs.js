import {ResolvablePromise, splitPath, callbackify} from "../utils/js-util.js";
import {requestPromise} from "../utils/idb-util.js";
import path from "path-browserify";
import StatMap from "../utils/StatMap.js";
import FileError from "../utils/FileError.js";
import Stat from './Stat.js';
import KeyFsPromises from "./KeyFsPromises.js";
import {minimatchAny, findFiles} from "../utils/minimatch-util.js";
import ContentConverter from "../utils/ContentConverter.js";
import Watcher from "./Watcher.js";
import {statsCount} from "../utils/stats-util.js";

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
	constructor(kv, {stats}={}) {
		super();

		this.stats=stats;

		this.kv=kv;
		this.kv.addEventListener("error",ev=>{
			let dispatchEv=new Event("error");
			dispatchEv.error=ev.error;
			this.dispatchEvent(dispatchEv);
		});

		this.promises=new KeyFsPromises(this);
		this.contentConverter=new ContentConverter();

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

		this.syncPatterns=[];
		this.syncIgnorePatterns=[];
		this.watchers=[];
	}

	notifyWatchers(event, name) {
		if (!["change","delete","create"].includes(event))
			throw new Error("Unknown change event: "+event);

		if (!this.watchers.length)
			return;

		//let realName=this.realpathSync(name);
		for (let w of this.watchers)
			if (w.match(name))
				w.dispatch(event,name);
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
			//console.log("saving index");
			this.kv.set("index",this.statMap.getData())
				.then(()=>{
					//console.log("index saved");
				});
		},500);
	}

	async op(type, fn) {
		await this.init();
		let res=await fn();

		if (type=="readwrite")
			this.scheduleSaveIndex();
			//await this.kv.set("index",this.statMap.getData());

		return res;
	}

	async refreshSyncFiles() {
		let syncFiles=findFiles({
			fs: this,
			patterns: this.syncPatterns,
			ignore: this.syncIgnorePatterns
		});

		let keys=[];
		for (let name of syncFiles) {
			let stat=this.statMap.get(name);
			keys.push(stat.key);
		}

		await this.kv.populateSync(keys);

		//console.log("sync files: "+syncFiles);
	}

	async addSyncPattern(pattern) {
		await this.init();
		this.syncPatterns.push(pattern);
		await this.refreshSyncFiles();
	}

	async addSyncIgnorePattern(pattern) {
		await this.init();
		this.syncIgnorePatterns.push(pattern);
		this.syncIgnorePatterns.push(pattern+"/**");
		await this.refreshSyncFiles();
	}

	assertInit() {
		if (!this.initPromise || !this.initPromise.isSettled())
			throw new Error("This call requires explicit initialization.");
	}

	isSync(name) {
		if (this.existsSync(name)) {
			name=this.realpathSync(name);
		}

		if (!this.existsSync(name)) {
			let split=splitPath(name);
			name=this.realpathSync(split.slice(0,split.length-1));
			if (!name.endsWith("/"))
				name+="/";

			name+=split[split.length-1];
		}

		//console.log(name);

		if (minimatchAny(name,this.syncPatterns) &&
				!minimatchAny(name,this.syncIgnorePatterns))
			return true;

		return false;
	}

	existsSync(name) {
		this.assertInit();
		if (this.statMap.get(name))
			return true;

		else
			return false;
	}

	realpathSync(name) {
		this.assertInit();
		return this.statMap.realpath(name);
	}

	writeFileSync(name, content) {
		this.assertInit();
		if (!this.isSync(name))
			throw new Error("Not avilable sync: "+name);

		if (typeof content!="string" &&
				!ArrayBuffer.isView(content) &&
				!(content instanceof Blob))
			throw new Error("Can only save strings, array buffers and blobs.");

		let stat=this.statMap.get(name);
		let eventType="change";
		if (stat) {
			if (stat.type!="file")
				throw new FileError("ENOTFILE");

			this.kv.setSync(stat.key,content);
		}

		else {
			//console.log("create: "+name);
			eventType="create";
			stat=this.statMap.create(name,"file");
			stat.key=this.generateId();
			this.kv.setSync(stat.key,content);
		}

		stat.size=content.size;
		stat.mtimeMs=Date.now();
		this.notifyWatchers(eventType,this.realpathSync(name));
		this.scheduleSaveIndex();
	}

	readFileSync(name, encoding="buffer") {
		this.assertInit();
		if (!this.isSync(name))
			throw new Error("Not avilable sync: "+name);

		let stat=this.statMap.get(name);
		if (!stat)
			throw new FileError("ENOENT");

		if (stat.type!="file")
			throw new FileError("ENOTFILE");

		let content=this.kv.getSync(stat.key);
		if (content===undefined) {
			throw new Error("Inode missing, fn="+name+" inode="+JSON.stringify(stat));
		}

		return this.contentConverter.convertSync(content,encoding);
	}

	readdirSync(name) {
		this.assertInit();
		let entry=this.statMap.get(name);
		if (!entry)
			throw new FileError("ENOENT");

		if (entry.type!="dir")
			throw new FileError("ENOTDIR");

		return Object.keys(entry.children);
	}

	statSync(name) {
		this.assertInit();
		let stat=this.statMap.get(name);
		if (!stat)
			throw new FileError("ENOENT");

		return new Stat(stat);
	}

	_mkdirSync(name, {recursive}={}) {
		if (!recursive) {
			this.statMap.create(name,"dir");
			this.notifyWatchers("create",this.realpathSync(name));
			return;
		}

		let current=this.statMap.get(name);
		if (current) {
			if (current.type!="dir")
				throw new FileError("ENOTDIR");

			return;
		}

		let splitName=splitPath(name);
		let parentSplit=splitName.slice(0,splitName.length-1);
		this._mkdirSync(parentSplit,{recursive});

		this.statMap.create(name,"dir");
		this.notifyWatchers("create",this.realpathSync(name));
	}

	mkdirSync(name, options) {
		this.assertInit();
		this._mkdirSync(name,options);
		this.scheduleSaveIndex();
	}

	_unlinkSync(name, options={}) {
		if (options.recursive) {
			let stat=this.statMap.lget(name);
			if (!stat && options.force)
				return;

			if (!stat)
				throw new FileError("ENOENT");

			let splitName=splitPath(name);
			if (stat.type=="dir") {
				for (let child of Object.keys(stat.children)) {
					let childName=[...splitName,child];
					this._unlinkSync(childName,options);
				}
			}
		}

		let realName=this.realpathSync(name);
		let entry=this.statMap.unlink(name);
		this.notifyWatchers("delete",realName);
		if (entry.nlink==0 && entry.type=="file") {
			this.kv.deleteSync(entry.key);
		}
	}

	unlinkSync(name, options) {
		this.assertInit();
		this._unlinkSync(name,options);
		this.scheduleSaveIndex();
	}

	rmSync(name, options) {
		this.unlinkSync(name,options);
	}

	rmdirSync(name, options) {
		this.unlinkSync(name,options);
	}

	renameSync(from, to) {
		this.assertInit();
		if (!this.isSync(from) || !this.isSync(to))
			throw new Error("Not available sync: "+from+" or "+to);

		let realFrom=this.realpathSync(from);
		this.statMap.rename(from,to);
		this.notifyWatchers("delete",realFrom);
		this.notifyWatchers("create",this.realpathSync(to));
		this.scheduleSaveIndex();
	}

	watch(name, options={}) {
		let realName=this.realpathSync(name);
		let watcher=new Watcher(realName,{
			recursive: options.recursive,
			fs: this
		});
		this.watchers.push(watcher);
		statsCount(this.stats,"num watchers");

		return watcher;
	}
}

export default KeyFs;
import {ResolvablePromise, eventPromise} from "../utils/js-util.js";
import LruCache from "../utils/LruCache.js";
import {statsCount, statsDistinct} from "../utils/stats-util.js";

export default class IndexKv extends EventTarget {
	constructor({indexedDB, dbName, storeName, cache, cacheMaxItems, stats}={}) {
		super();

		this.indexedDB=indexedDB||globalThis.indexedDB;
		this.dbName=dbName||"kv";
		this.storeName=storeName||"kv";
		this.stats=stats;
		this.writeQueue={};
		this.written={};
		this.syncData={};

		if (!cacheMaxItems)
			cacheMaxItems=10;

		if (cache===undefined)
			cache=true;

		if (cache)
			this.lruCache=new LruCache({maxItems: cacheMaxItems});
	}

	async init() {
		if (this.initPromise)
			return this.initPromise;

		this.initPromise=new ResolvablePromise();
		try {
			let req=this.indexedDB.open(this.dbName,1,{
				durability: "relaxed"
			});
			req.onupgradeneeded=(ev)=>{
				let db=ev.target.result;
				db.createObjectStore(this.storeName,{autoIncrement: true});
				//console.log("** upgrade event: "+this.storeName);
			}

			let ev=await eventPromise(req,"success","error");
			this.db=ev.target.result;
			this.initPromise.resolve();
		}

		catch (e) {
			this.initPromise.reject(e);
		}

		//console.log("initialized");
		await this.initPromise;
		this.initComplete=true;

		return this.initPromise;
	}

	handleError(error) {
		let ev=new Event("error");
		event.error=error;
		this.dispatchEvent(ev);
	}

	startWriteTransaction() {
		if (this.currentWriteTransaction)
			return;

		if (!Object.keys(this.writeQueue).length)
			return;

		statsCount(this.stats,"kv write tx");

		this.written=this.writeQueue;
		this.writeQueue={};

		let tx=this.db.transaction([this.storeName],"readwrite",{
			durability: "relaxed"
		});

		this.currentWriteTransaction=tx;
		eventPromise(tx,"complete",["abort","error"])
			.then(ev=>{
				this.currentWriteTransaction=null;
				this.written={};
				this.startWriteTransaction();
			})
			.catch(ev=>{
				this.handleError(ev);
			});

		let store=tx.objectStore(this.storeName);
		for (let k in this.written) {
			if (this.written[k]===undefined)
				store.delete(k);

			else
				store.put(this.written[k],k);
		}
	}

	getReadTransaction() {
		if (!this.currentReadTransaction) {
			statsCount(this.stats,"kv read tx");

			//console.log("starting new read tx");
			let tx=this.db.transaction([this.storeName],"readonly",{
				durability: "relaxed"
			});

			this.currentReadTransaction=tx;
			eventPromise(tx,"complete",["abort","error"])
				.then(ev=>{
					//console.log("******* READ TRANSACTION COMPLETE");
					this.currentReadTransaction=null;
				})
				.catch(ev=>{
					this.handleError(ev);
				});
		}

		return this.currentReadTransaction;
	}

	tryReadOp(fn) {
		let tx=this.getReadTransaction();
		let store=tx.objectStore(this.storeName);
		return fn(store);
	}

	readOp(fn) {
		try {
			return this.tryReadOp(fn);
		}

		catch (e) {
			if (!["InvalidStateError","TransactionInactiveError"].includes(e.name))
				throw e;

			//console.log("tx inactive");

			this.currentReadTransaction=null;
			return this.tryReadOp(fn);
		}
	}

	sanitizeKey(key) {
		if (!key)
			throw new Error("Bad key: "+key);

		return String(key);
	}

	async get(key) {
		if (!this.initComplete)
			await this.init();

		key=this.sanitizeKey(key);

		statsCount(this.stats,"kv get");
		statsDistinct(this.stats,"kv seen keys",key);

		if (this.syncData[key]!==undefined)
			return this.syncData[key];

		if (this.lruCache && this.lruCache.has(key)) {
			statsCount(this.stats,"kv cache hit");
			return this.lruCache.get(key);
		}

		//console.log("reading: "+key);
		//console.log(this.writeQueue,this.written);

		let value;
		if (this.writeQueue.hasOwnProperty(key))
			value=this.writeQueue[key];

		else if (this.written.hasOwnProperty(key))
			value=this.written[key];

		else {
			//console.log("not in queue, doing tx");
			let req=this.readOp(store=>store.get(key));
			let ev=await eventPromise(req,"success","error");
			value=ev.target.result;
		}

		if (this.lruCache)
			this.lruCache.set(key,value);

		return value;
	}

	getSync(key, value) {
		if (!this.initComplete)
			throw new Error("Need explicit init for sync operation");

		key=this.sanitizeKey(key);
		statsCount(this.stats,"kv get");
		statsDistinct(this.stats,"kv seen keys",key);

		if (this.syncData[key]===undefined)
			throw new Error("Not avilable sync: "+key);

		return this.syncData[key];
	}

	async set(key, value) {
		if (!this.initComplete)
			await this.init();

		key=this.sanitizeKey(key);
		statsCount(this.stats,"kv set");
		statsDistinct(this.stats,"kv seen keys",key);

		if (this.syncData[key]!==undefined)
			this.syncData[key]=value;

		else if (this.lruCache)
			this.lruCache.set(key,value);

		this.writeQueue[key]=value;
		this.startWriteTransaction();
	}

	setSync(key, value) {
		if (!this.initComplete)
			throw new Error("Need explicit init for sync operation");

		key=this.sanitizeKey(key);
		statsCount(this.stats,"kv set");
		statsDistinct(this.stats,"kv seen keys",key);

		if (this.lruCache)
			this.lruCache.delete(key);

		if (value===undefined)
			delete this.syncData[key];

		else
			this.syncData[key]=value;

		this.writeQueue[key]=value;
		this.startWriteTransaction();
	}

	async delete(key) {
		if (!this.initComplete)
			await this.init();

		this.deleteSync(key);
	}

	deleteSync(key) {
		if (!this.initComplete)
			throw new Error("Need explicit init for sync operation");

		key=this.sanitizeKey(key);

		if (this.syncData[key]!==undefined)
			delete this.syncData[key];

		if (this.lruCache)
			this.lruCache.delete(key);

		this.writeQueue[key]=undefined;
		this.startWriteTransaction();
	}

	async populateSync(keys) {
		if (!this.initComplete)
			await this.init();

		for (let key of keys) {
			key=this.sanitizeKey(key);
			if (this.syncData[key]===undefined)
				this.syncData[key]=await this.get(key);
		}

		for (let key of Object.keys(this.syncData))
			if (!keys.includes(key))
				delete this.syncData[key];
	}

	async sync() {
		while (this.currentWriteTransaction)
			await eventPromise(this.currentWriteTransaction,"complete");
	}
}
import {ResolvablePromise, eventPromise} from "../utils/js-util.js";

export default class IndexKv extends EventTarget {
	constructor({indexedDB, dbName, storeName}={}) {
		super();

		this.indexedDB=indexedDB||globalThis.indexedDB;
		this.dbName=dbName||"kv";
		this.storeName=storeName||"kv";
		this.writeQueue={};
		this.written={};
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

		globalThis.stats?.count("kv write tx");

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
			globalThis.stats?.count("kv read tx");

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
			if (e.name!="TransactionInactiveError")
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

		globalThis.stats?.count("kv get");
		key=this.sanitizeKey(key);

		if (globalThis.stats) {
			if (!globalThis.stats.seenKeys)
				globalThis.stats.seenKeys=[];

			if (!globalThis.stats.seenKeys.includes(key)) {
				globalThis.stats.count("kv seen keys");
				globalThis.stats.seenKeys.push(key);
			}
		}

		//console.log("reading: "+key);
		//console.log(this.writeQueue,this.written);

		if (this.writeQueue.hasOwnProperty(key))
			return this.writeQueue[key];

		if (this.written.hasOwnProperty(key))
			return this.written[key];

		//console.log("not in queue, doing tx");

		let req=this.readOp(store=>store.get(key));
		let ev=await eventPromise(req,"success","error");
		return ev.target.result;
	}

	async set(key, value) {
		if (!this.initComplete)
			await this.init();

		globalThis.stats?.count("kv set");
		key=this.sanitizeKey(key);

		if (globalThis.stats) {
			if (!globalThis.stats.seenKeys)
				globalThis.stats.seenKeys=[];

			if (!globalThis.stats.seenKeys.includes(key)) {
				globalThis.stats.count("kv seen keys");
				globalThis.stats.seenKeys.push(key);
			}

		}

		this.writeQueue[key]=value;
		this.startWriteTransaction();
	}

	async delete(key) {
		if (!this.initComplete)
			await this.init();

		key=this.sanitizeKey(key);
		this.writeQueue[key]=undefined;
		this.startWriteTransaction();
	}

	async sync() {
		while (this.currentWriteTransaction)
			await eventPromise(this.currentWriteTransaction,"complete");
	}
}
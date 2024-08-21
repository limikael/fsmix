import {ResolvablePromise} from "../utils/js-util.js";
import {requestPromise} from "../utils/idb-util.js";

export default class IndexKv {
	constructor({indexedDB, dbName, storeName}={}) {
		this.indexedDB=indexedDB||globalThis.indexedDB;
		this.dbName=dbName||"kv";
		this.storeName=storeName||"kv";
	}

	async init() {
		if (this.initPromise)
			return this.initPromise;

		this.initPromise=new ResolvablePromise();
		try {
			let req=this.indexedDB.open(this.dbName,1);
			req.onupgradeneeded=(ev)=>{
				let db=ev.target.result;
				db.createObjectStore(this.storeName,{autoIncrement: true});
				//console.log("** upgrade event: "+this.storeName);
			}

			this.db=await requestPromise(req);
			this.initPromise.resolve();
		}

		catch (e) {
			this.initPromise.reject(e);
		}

		//console.log("initialized");

		return await this.initPromise;
	}

	async restartTransaction() {
		if (this.restartTransactionPromise)
			return this.restartTransactionPromise;

		this.restartTransactionPromise=new ResolvablePromise();
		return await this.restartTransactionPromise;
	}

	handleTransactionComplete() {
		//console.log("******* TRANSACTION COMPLETE");
		this.currentTransaction=null;
		this.currentStore=null;

		if (this.restartTransactionPromise) {
			let p=this.restartTransactionPromise;
			this.restartTransactionPromise=null;
			this.beginTransaction();
			p.resolve();
		}
	}

	beginTransaction() {
		if (this.currentTransaction)
			throw new Error("tx already started");

		this.currentTransaction=this.db.transaction([this.storeName],"readwrite");
		this.currentTransaction.oncomplete=()=>this.handleTransactionComplete();
		this.currentTransaction.onabort=ev=>{
			console.log("******** TRANSACTION ABORT");
			console.log(ev);
		}
		this.currentTransaction.onerror=ev=>{
			console.log("******** TRANSACTION ERROR");
			console.log(ev);
		}
		this.currentStore=this.currentTransaction.objectStore(this.storeName);
	}

	async op(fn) {
		await this.init();

		if (!this.currentTransaction)
			this.beginTransaction();

		try {
			return await requestPromise(fn(this.currentStore));
		}

		catch (e) {
			if (e.name!="TransactionInactiveError")
				throw e;

			console.log("restarting tx!!!");

			await this.restartTransaction();
			return await requestPromise(fn(this.currentStore));
		}
	}

	async get(key) {
		//console.log("getting: "+key);
		return await this.op(store=>store.get(key));
	}

	async set(key, value) {
		await this.op(store=>store.put(value,key));
	}

	async delete(key) {
		await this.op(store=>store.delete(key));
	}
}
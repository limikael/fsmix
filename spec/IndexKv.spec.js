import IndexKv from "../src/lib/IndexKv.js";
import {indexedDB} from "fake-indexeddb";

describe("IndexKv",()=>{
	it("works",async ()=>{
		let stats={};
		let kv=new IndexKv({indexedDB: indexedDB, dbName: "index-test1", stats});

		await kv.set(1,"hello world");
		await kv.set(2,"hello world again");
		await kv.set("index","the index");

		await new Promise(r=>setTimeout(r,100));
		expect(await kv.get(1)).toEqual("hello world");
		//console.log("got: "+await kv.get(1));

		//await kv.delete(1);
		//await new Promise(r=>setTimeout(r,100));
		//expect(await kv.get(1)).toEqual(undefined);
		//console.log("got: "+await kv.get(1));

		//console.log(stats);
		expect(stats["kv seen keys"]).toEqual(["1","2","index"]);
	});

	it("can disable the cache",async ()=>{
		let kv=new IndexKv({indexedDB: indexedDB, dbName: "index-test2", cache: false});

		await kv.set("test","hello");
		expect(await kv.get("test")).toEqual("hello");
		expect(kv.lruCache).toEqual(undefined);
		await kv.delete("test");
		expect(await kv.get("test")).toEqual(undefined);
	});

	it("can access sync",async ()=>{
		let stats={};
		let kv=new IndexKv({indexedDB: indexedDB, dbName: "index-test3", cache: false, stats});
		await kv.init();

		kv.setSync("test-sync","hello");
		await kv.set("test-sync","world");
		await kv.set("test-async","hello2");//kv.setSync("test","hello");
		//expect(kv.getSync("test")).toEqual("hello");

		await new Promise(r=>setTimeout(r,100));

		expect(kv.getSync("test-sync")).toEqual("world");

		expect(await kv.get("test-sync")).toEqual("world");
		expect(await kv.get("test-async")).toEqual("hello2");

		expect(stats["kv read tx"]).toEqual(1);

		expect(()=>kv.getSync("test-async")).toThrow(new Error("Not avilable sync: test-async"));

		await kv.populateSync(["test-async"]);
		expect(await kv.getSync("test-async")).toEqual("hello2");
	});
});
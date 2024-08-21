import IndexKv from "../src/lib/IndexKv.js";
import {indexedDB} from "fake-indexeddb";

describe("IndexKv",()=>{
	it("works",async ()=>{
		let kv=new IndexKv({indexedDB: indexedDB, dbName: "test1"});

		await kv.set(1,"hello world");
		await kv.set(2,"hello world again");
		await kv.set("index","the index");

		await new Promise(r=>setTimeout(r,100));
		expect(await kv.get(1)).toEqual("hello world");
		//console.log("got: "+await kv.get(1));

		/*await kv.delete(1);
		await new Promise(r=>setTimeout(r,100));
		expect(await kv.get(1)).toEqual(undefined);*/
		//console.log("got: "+await kv.get(1));
	});
});
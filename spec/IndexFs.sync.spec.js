import {createIndexFs} from "../src/lib/lib.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";
import {minimatch} from "minimatch";

describe("sync",()=>{
	it("can match sync patterns",async ()=>{
		let fs=createIndexFs({indexedDB, dbName: "sync-test-1"});

		await fs.promises.mkdir("hello");
		await fs.promises.writeFile("hello/world","test");

		await fs.addSyncPattern("/hello/**");

		fs.readFileSync("hello/world","utf8");

		fs.writeFileSync("/hello/sync","synccontent");
		expect(fs.readFileSync("/hello/sync","utf8")).toEqual("synccontent");
		expect(await fs.promises.readFile("/hello/sync","utf8")).toEqual("synccontent");

		//console.log(fs.kv.syncData);
		expect(Object.keys(fs.kv.syncData).length).toEqual(2);

		await fs.addSyncIgnorePattern("/hello/world");

		expect(Object.keys(fs.kv.syncData).length).toEqual(1);

		expect(()=>fs.readFileSync("/hello/world")).toThrow(new Error("Not avilable sync: /hello/world"));

		fs.mkdirSync("syncdir");
		await fs.addSyncPattern("/syncdir/**");
		await fs.writeFileSync("syncdir/test","hello");
	});
});

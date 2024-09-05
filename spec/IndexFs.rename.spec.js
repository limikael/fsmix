import {createIndexFs} from "../src/lib/lib.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";

describe("rename",()=>{
	it("works",async ()=>{
		let fs=createIndexFs({indexedDB, dbName: "renametest"});
		await fs.promises.mkdir("hello");
		await fs.promises.mkdir("hello/world");
		await fs.promises.writeFile("hello/world/test","testing");

		await fs.promises.rename("hello/world/test","/bla");
		expect(await fs.promises.readFile("/bla","utf8")).toEqual("testing");

		expect(fs.existsSync("hello/world/test")).toEqual(false);
	});

	it("works sync",async ()=>{
		let fs=createIndexFs({indexedDB, dbName: "renametest-2"});
		await fs.promises.mkdir("hello");
		await fs.addSyncPattern("/hello/**");
		fs.mkdirSync("hello/world");
		fs.writeFileSync("hello/world/test","testing");

		fs.renameSync("hello/world/test","/hello/bla");
		expect(fs.readFileSync("/hello/bla","utf8")).toEqual("testing");

		expect(fs.existsSync("hello/world/test")).toEqual(false);
	});
});

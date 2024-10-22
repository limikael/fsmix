import {createIndexFs} from "../src/lib/lib.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";

describe("cp",()=>{
	it("works",async ()=>{
		let fs=createIndexFs({indexedDB, dbName: "cptest"});
		await fs.promises.mkdir("hello");
		await fs.promises.mkdir("hello/world");
		await fs.promises.writeFile("hello/world/test","testing");

		await fs.promises.cp("hello/world/test","/bla");
		expect(await fs.promises.readFile("/bla","utf8")).toEqual("testing");

		expect(fs.existsSync("hello/world/test")).toEqual(true);
	});
});

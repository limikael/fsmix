import IndexFs from "../src/lib/IndexFs.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";

describe("rename",()=>{
	it("works",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "renametest"});
		await fs.promises.mkdir("hello");
		await fs.promises.mkdir("hello/world");
		await fs.promises.writeFile("hello/world/test","testing");

		await fs.promises.rename("hello/world/test","/bla");
		expect(await fs.promises.readFile("/bla","utf8")).toEqual("testing");
	});
});

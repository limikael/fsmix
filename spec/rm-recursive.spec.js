import IndexFs from "../src/lib/IndexFs.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";

describe("rm recursive",()=>{
	it("works",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "rmtest"});
		await fs.promises.mkdir("hello");
		await fs.promises.mkdir("hello/world");
		await fs.promises.writeFile("hello/world/test","testing");

		await fs.promises.unlink("hello",{recursive: true});
		expect(Object.keys(fs.statMap.map).length).toEqual(1);
	});
});

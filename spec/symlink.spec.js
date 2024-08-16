import IndexFs from "../src/lib/IndexFs.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";

describe("symlink",()=>{
	it("works",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "symlinktest"});
		await fs.promises.writeFile("hello","testing");
		await fs.promises.symlink("hello","world");
		await fs.promises.link("world","world2");

		//await fs.promises.unlink("world");
		expect(await fs.promises.readlink("world")).toEqual("hello");
		expect(await fs.promises.readlink("world2")).toEqual("hello");

		let stat=await fs.promises.stat("world");
		expect(stat.isFile()).toEqual(true);
		let lstat=await fs.promises.lstat("world");
		expect(lstat.isSymbolicLink()).toEqual(true);

		let id=fs.statMap.map.root.children["world"];
		expect(fs.statMap.map[id].nlink).toEqual(2);

		await fs.promises.unlink("world2");
		expect(fs.statMap.map[id].nlink).toEqual(1);
		//console.log(fs.statMap.map);
		await fs.promises.unlink("world");
		expect(fs.statMap.map[id]).toEqual(undefined);
		//console.log(fs.statMap.map);
	});

	it("can symlink dirs",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "symlinktest2"});
		await fs.promises.mkdir("hello");
		await fs.promises.symlink("hello","world");

		await fs.promises.writeFile("hello/test","bla");
		let content=await fs.promises.readFile("world/test","utf8");
		//console.log(content);
	});

	it("can get realpath",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "symlinktest3"});
		await fs.promises.mkdir("hello");
		await fs.promises.writeFile("hello/test","val");
		await fs.promises.mkdir("hello2");
		await fs.promises.mkdir("hello2/sub2");
		await fs.promises.symlink("../../hello/test","hello2/sub2/link-to-test");
		//await fs.promises.symlink("/hello/test","hello2/sub2/link-to-test");

		expect(await fs.promises.readFile("hello2/sub2/link-to-test","utf8")).toEqual("val");
		expect(await fs.promises.realpath("hello2/sub2/link-to-test")).toEqual("/hello/test");
	})
})

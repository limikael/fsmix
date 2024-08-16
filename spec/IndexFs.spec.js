import IndexFs from "../src/lib/IndexFs.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";
import {ResolvablePromise} from "../src/utils/js-util.js";

describe("indexfs",()=>{
	it("works",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test"});
		await fs.promises.writeFile("hello","testing");
		await fs.promises.writeFile("/helloworld","testing2");

		await fs.promises.mkdir("dir");
		await fs.promises.mkdir("dir/test");
		//console.log(fs.statMap.map);

		await fs.promises.writeFile("/dir/test/hello","testing3");

		let content=await fs.promises.readFile("/hello","utf8");
		expect(content).toEqual("testing");

		let contentAgain=await fs.promises.readFile("/dir/test/hello","utf8");
		expect(contentAgain).toEqual("testing3");

		let fs2=new IndexFs({indexedDB, dbName: "test"});
		await fs2.init();
		//console.log(fs2.statMap.map);
		let content2=await fs2.promises.readFile("dir/test/hello","utf8");
		expect(content2).toEqual("testing3");
	});

	it("throws an error",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test2"});
		let e=await catchError(async ()=>await fs.promises.readFile("doesnotexist"));
		expect(e.code).toEqual("ENOENT");
	});

	it("can check existence",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test4"});
		await fs.init();
		expect(fs.existsSync("/hello")).toEqual(false);
		await fs.promises.writeFile("/hello","test");
		expect(fs.existsSync("/hello")).toEqual(true);
	})

	it("has a callback interface",async ()=>{
		let p=new ResolvablePromise();
		let fs=new IndexFs({indexedDB, dbName: "test3"});
		fs.mkdir("/hello",()=>{
			p.resolve();
		});

		await p;
	});

	it("works with blobs",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test4"});
		await fs.promises.writeFile("hellofile","hello");//new Blob(["hello"]));
		//console.log(await fs.promises.readFile("hellofile"));
		expect(await (await fs.promises.readFile("hellofile")).text()).toEqual("hello");
		expect(await fs.promises.readFile("hellofile","utf8")).toEqual("hello");
	});

	it("can stat",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test5"});
		await fs.promises.writeFile("hellofile","hello");
		let s=await fs.promises.stat("hellofile");
		expect(s.isFile()).toEqual(true);
		expect(s.size).toEqual(5);

		await fs.promises.writeFile("hellofile","helloagain");
		let s3=await fs.promises.stat("hellofile");
		expect(s3.size).toEqual(10);

		expect(s.mtimeMs).not.toEqual(s3.mtimeMs);

		await fs.promises.mkdir("/test");
		let s2=await fs.promises.stat("/test");
		expect(s2.isDirectory()).toEqual(true);
	});

	it("can hard link",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test5"});
		await fs.promises.writeFile("hellofile","hello");
		await fs.promises.link("hellofile","hello2");

		expect(await fs.promises.readFile("hello2","utf8")).toEqual("hello");
		let id=fs.statMap.map.root.children["hellofile"];
		expect(fs.statMap.map[id].nlink).toEqual(2);

		let fs2=new IndexFs({indexedDB, dbName: "test5"});
		await fs2.init();
		expect(fs2.statMap.map[id].nlink).toEqual(2);
	});

	it("can unlink",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test6"});
		await fs.promises.writeFile("hellofile","hello");
		await fs.promises.link("hellofile","hello2");
		let id=fs.statMap.map.root.children["hellofile"];

		expect(fs.statMap.map[id].nlink).toEqual(2);

		await fs.promises.unlink("hellofile");
		expect(await fs.promises.readFile("hello2","utf8")).toEqual("hello");
		expect(fs.statMap.map[id].nlink).toEqual(1);

		await fs.promises.unlink("hello2");
		expect(fs.statMap.map[id]).toEqual(undefined);
	});

	it("can unlink dirs",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test7"});
		await fs.promises.mkdir("hello");
		await fs.promises.writeFile("hello/test","content");

		let e=await catchError(async ()=>await fs.promises.unlink("hello"));
		expect(e.code).toEqual("ENOTEMPTY");

		await fs.promises.unlink("hello/test");
		await fs.promises.unlink("hello");
		expect(Object.keys(fs.statMap.map).length).toEqual(1);
	});

	it("can readdir",async ()=>{
		let fs=new IndexFs({indexedDB, dbName: "test8"});
		await fs.promises.mkdir("dir");
		await fs.promises.writeFile("dir/test","hello");
		await fs.promises.writeFile("dir/test2","hello2");

		expect(await fs.promises.readdir("dir")).toEqual(["test","test2"]);
	});
})

import {createIndexFs} from "../src/lib/lib.js";
import {indexedDB} from "fake-indexeddb";
import Watcher from "../src/lib/Watcher.js";

describe("watch",()=>{
	it("can match a file",()=>{
		let w=new Watcher("test");
		expect(w.match("/test")).toEqual(true);
		expect(w.match("/test/sub")).toEqual(false);
		expect(w.match("/bla")).toEqual(false);

		let w2=new Watcher("test",{recursive: true});
		expect(w2.match("/test")).toEqual(true);
		expect(w2.match("/test/sub")).toEqual(true);
		expect(w2.match("/bla")).toEqual(false);
	});

	it("can watch",async ()=>{
		let fs=createIndexFs({indexedDB, dbName: "watch-test-1"});
		await fs.init();

		fs.mkdirSync("hello");
		let watcher=fs.watch("hello",{recursive: true});

		let rec=[];
		watcher.addEventListener("change",ev=>{
			rec.push(ev.filename);
		})

		await fs.promises.writeFile("hello/world","test");
		await fs.promises.mkdir("hello/world2");
		await fs.promises.writeFile("hello/world2/test2","stuff");

		expect(rec).toEqual(["world","world2","world2/test2"]);

		watcher.close();
		await fs.promises.writeFile("hello/world2/test2","stuff");
		expect(rec).toEqual(["world","world2","world2/test2"]);
	});

	it("can watch with nodejs style events",async ()=>{
		let fs=createIndexFs({indexedDB, dbName: "watch-test-2"});
		await fs.init();

		fs.mkdirSync("hello");
		let watcher=fs.watch("hello",{recursive: true});

		let rec=[];
		watcher.on("change",(eventType,filename)=>{
			rec.push(filename);
		});

		await fs.promises.writeFile("hello/world","test");
		await fs.promises.mkdir("hello/world2");
		await fs.promises.writeFile("hello/world2/test2","stuff");

		expect(rec).toEqual(["world","world2","world2/test2"]);
	});

	it("watches removal",async ()=>{
		let fs=createIndexFs({indexedDB, dbName: "watch-test-3"});
		await fs.init();

		fs.mkdirSync("hello");
		let watcher=fs.watch("hello",{recursive: true});

		let rec=[];
		watcher.addEventListener("change",ev=>{
			rec.push(ev.filename);
		})

		await fs.promises.writeFile("hello/world","test");
		expect(rec).toEqual(["world"]);

		await fs.promises.rm("hello/world");
		expect(rec).toEqual(["world","world"]);
	});
});
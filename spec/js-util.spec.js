import {pathResolve, eventPromise} from "../src/utils/js-util.js";

describe("js-util",()=>{
	it("can resolve paths",async ()=>{
		expect(pathResolve("hello/world","test")).toEqual(["hello","world","test"]);
		expect(pathResolve("hello/world","/test")).toEqual(["test"]);
		expect(pathResolve("hello/world","./test")).toEqual(["hello","world","test"]);
		expect(pathResolve("hello/world","../test")).toEqual(["hello","test"]);
		expect(pathResolve("hello/world/bla","../../test/xyz")).toEqual(["hello","test","xyz"]);
	});

	it("can create event promises",async ()=>{
		let target=new EventTarget();
		setTimeout(()=>target.dispatchEvent(new Event("hello")));

		let ev=await eventPromise(target,"hello")
		expect(ev.type).toEqual("hello");
	});
})

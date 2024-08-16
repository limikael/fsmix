import {pathResolve} from "../src/utils/js-util.js";

describe("js-util",()=>{
	it("can resolve paths",async ()=>{
		expect(pathResolve("hello/world","test")).toEqual(["hello","world","test"]);
		expect(pathResolve("hello/world","/test")).toEqual(["test"]);
		expect(pathResolve("hello/world","./test")).toEqual(["hello","world","test"]);
		expect(pathResolve("hello/world","../test")).toEqual(["hello","test"]);
		expect(pathResolve("hello/world/bla","../../test/xyz")).toEqual(["hello","test","xyz"]);
	});
})

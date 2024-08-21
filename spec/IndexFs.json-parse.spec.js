import {createIndexFs} from "../src/lib/lib.js";
import {indexedDB} from "fake-indexeddb";
import {catchError} from "../src/utils/test-util.js";
import nodeFs from "fs";

describe("parsing json",()=>{
	it("works",async ()=>{
		/*let data={hello: "world"};
		await nodeFs.promises.writeFile("hello.json",JSON.stringify(data));

		let readContent=await nodeFs.promises.readFile("hello.json");
		console.log(readContent);
		let readData=JSON.parse(readContent);
		console.log(readData);*/

		let fs=createIndexFs({indexedDB, dbName: "jsontest"});
		let data={hello: "world"};

		await fs.promises.writeFile("hello.json",JSON.stringify(data));
		let readContent=await fs.promises.readFile("hello.json");

		//console.log(readContent);
		let readData=JSON.parse(readContent);
		//console.log(readData);

		expect(readData.hello=="world");
	});
});

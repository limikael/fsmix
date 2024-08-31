import path from "path";
import {fileURLToPath} from 'url';
import {findFiles, minimatchAny} from "../src/utils/minimatch-util.js";
import fs from "fs";

const __dirname=path.dirname(fileURLToPath(import.meta.url));

describe("minimatch util",()=>{
	it("can match",()=>{
		//console.log(minimatchAny("/",["/home/micke"]));
	});

	it("can find matching files",()=>{
		let patterns=[
			path.join(__dirname,"/../**")
		];

		let ignore=[
			//"/home/micke/Repo/fsmix/node_modules"
			"**/node_modules/**",
			"**/attic"
		];

		let res=findFiles({
			patterns: patterns, 
			ignore: ignore, 
			fs: fs,
		});

		//console.log(res);
		expect(res.length).toBeGreaterThan(20);
		expect(res.length).toBeLessThan(40);
	});
});
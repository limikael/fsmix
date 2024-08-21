import LruCache from "../src/utils/LruCache.js";

describe("LruCache",()=>{
	it("works",async ()=>{
		let lruCache=new LruCache({maxItems: 3});

		lruCache.set("a",123);
		lruCache.set("b",123);
		lruCache.set("c",123);
		lruCache.set("d",123);

		expect(lruCache.keys()).toEqual(["b","c","d"]);

		lruCache.get("c");
		expect(lruCache.keys()).toEqual(["b","d","c"]);

		lruCache.delete("d");
		expect(lruCache.keys()).toEqual(["b","c"]);

	});
});
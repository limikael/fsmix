import ContentConverter from "../src/utils/ContentConverter.js";

describe("content converter",()=>{
	it("can convert content",async ()=>{
		let c=new ContentConverter();

		let b=await c.convert("hello","buffer");

		expect(c.getContentSize(b)).toEqual(5);
		expect(ArrayBuffer.isView(b)).toEqual(true);
		expect(b.toString()).toEqual("hello");

		expect(c.convertSync(b,"utf8")).toEqual("hello");
		expect(await c.convert(b,"utf8")).toEqual("hello");

		let blob=await c.convert("hello","blob");
		expect(c.getContentSize(blob)).toEqual(5);
		expect(await c.convert(blob,"utf8")).toEqual("hello");
		expect((await c.convert(blob,"buffer")).toString()).toEqual("hello");

		expect(()=>c.convertSync(blob,"utf8")).toThrow(new Error("Can not convert blobs sync"));;
	});
});
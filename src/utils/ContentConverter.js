export default class ContentConverter {
	constructor() {
		this.textEncoder=new TextEncoder();
		this.textDecoder=new TextDecoder();
	}

	assertValidContent(content) {
		this.getContentType(content);
	}

	getContentSize(content) {
		switch (this.getContentType(content)) {
			case "utf8":
			case "buffer":
				return content.length;

			case "blob":
				return content.size;
		}

		throw new Error("Unknown content type.");
	}

	getContentType(content) {
		if (typeof content=="string")
			return "utf8";

		if (ArrayBuffer.isView(content))
			return "buffer";

		if (content instanceof Blob)
			return "blob";

		throw new Error("Unknown content type.");
	}

	appendBufferToString(b) {
		b.toString=function() {
			let decoder=new TextDecoder();
			return decoder.decode(this);
		}
	}

	async convert(input, format) {
		switch (format) {
			case "utf8":
				return await this.asString(input);
				break;

			case "buffer":
				return await this.asBuffer(input);
				break;

			case "blob":
				return this.asBlobSync(input);
				break;
		}

		throw new Error("Unknown format: "+format);
	}

	convertSync(input, format) {
		switch (format) {
			case "utf8":
				return this.asStringSync(input);
				break;

			case "buffer":
				return this.asBufferSync(input);
				break;

			case "blob":
				return this.asBlobSync(input);
				break;
		}

		throw new Error("Unknown format: "+format);
	}

	async asString(content) {
		switch (this.getContentType(content)) {
			case "utf8":
			case "buffer":
				return this.asStringSync(content);
				break;

			case "blob":
				return await content.text();
				break;
		}

		throw new Error("Unknown encoding");
	}

	asStringSync(content) {
		switch (this.getContentType(content)) {
			case "utf8":
				return content;
				break;

			case "buffer":
				return this.textDecoder.decode(content);
				break;

			case "blob":
				throw new Error("Can not convert blobs sync");
				break;
		}

		throw new Error("Unknown encoding");
	}

	async asBuffer(content) {
		switch (this.getContentType(content)) {
			case "utf8":
			case "buffer":
				return this.asBufferSync(content);
				break;

			case "blob":
				let b=new Uint8Array(await content.arrayBuffer());
				this.appendBufferToString(b);
				return b;
				break;
		}

		throw new Error("Unknown encoding");
	}

	asBufferSync(content) {
		switch (this.getContentType(content)) {
			case "utf8":
				let b=this.textEncoder.encode(content);
				this.appendBufferToString(b)
				return b;
				break;

			case "buffer":
				return content;
				break;

			case "blob":
				throw new Error("Can not convert blobs sync");
				break;
		}

		throw new Error("Unknown encoding");
	}

	asBlobSync(content) {
		switch (this.getContentType(content)) {
			case "utf8":
			case "buffer":
				return new Blob([content]);
				break;

			case "blob":
				return content;
		}

		throw new Error("Unknown encoding");
	}
}
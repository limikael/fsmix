export default class Stat {
	constructor(o) {
		this.type=o.type;
		this.nlink=o.nlink;
		this.size=o.size;
		this.ctimeMs=o.ctimeMs;
		this.mtimeMs=o.mtimeMs;
	}

	isFile() {
		return this.type=="file";
	}

	isDirectory() {
		return this.type=="dir";
	}
}
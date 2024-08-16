export default class Stat {
	constructor(o) {
		this.type=o.type;

		if (["file","symlink"].includes(o.type))
			this.nlink=o.nlink;

		if (["file"].includes(o.type))
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

	isSymbolicLink() {
		return this.type=="symlink";
	}
}
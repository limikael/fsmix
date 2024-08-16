export default class FileError extends Error {
	constructor(code) {
		let messages={
			"ENOENT": "No such file or directory.",
			"EISDIR": "Is a directory.",
			"ENOTDIR": "Not a directory.",
			"ENOTEMPTY": "Directory not empty.",
			"ENOTFILE": "Not a regular file.",
			"EEXIST": "File already exists."
		};

		if (!messages[code])
			throw new Error("Unknown file error");

		super(messages[code]);
		this.code=code;
	}
}
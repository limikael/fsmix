import {splitPath} from "./js-util.js";
import FileError from "../utils/FileError.js";

export default class StatMap {
	constructor(map) {
		if (!map)
			map={};

		if (!map.root)
			map.root={type: "dir", children:{}}

		this.map=map;
	}

	getData() {
		return this.map;
	}

	get(name) {
		let split=splitPath(name);
		if (!split.length)
			return this.map.root;

		let parentPath=split.slice(0,split.length-1);
		let basename=split[split.length-1];

		let parent=this.get(parentPath);
		if (!parent)
			return;

		let id=parent.children[basename];
		if (!id)
			return;

		return this.map[id];
	}

	create(name, type) {
		let split=splitPath(name);
		let parentPath=split.slice(0,split.length-1);
		let basename=split[split.length-1];

		let parent=this.get(parentPath);
		if (!parent)
			throw new FileError("ENOENT");

		if (parent.type!="dir")
			throw new FileError("ENOTDIR");

		if (parent.children[basename])
			throw new FileError("EEXIST");

		let entry={nlink: 1, type: type};
		switch (type) {
			case "dir":
				entry.children={};
				break;

			case "file":
				break;

			default:
				throw new Error("Unknown object type: "+type);
				break;
		}

		let id=crypto.randomUUID();
		this.map[id]=entry;
		parent.children[basename]=id;

		return entry;
	}

	unlink(name) {

	}

	link(oldName, newName) {

	}
}
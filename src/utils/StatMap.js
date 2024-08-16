import {splitPath, pathBasename} from "./js-util.js";
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

		let parent=this.getParent(split);
		if (!parent)
			return;

		let basename=split[split.length-1];
		let id=parent.children[basename];
		if (!id)
			return;

		return this.map[id];
	}

	getParent(name) {
		let split=splitPath(name);
		if (!split.length)
			return;

		let parentPath=split.slice(0,split.length-1);
		let parent=this.get(parentPath);
		if (!parent || parent.type!="dir")
			return;

		return parent;
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

		let entry={type: type, ctimeMs: Date.now(), mtimeMs: Date.now()};
		switch (type) {
			case "dir":
				entry.children={};
				break;

			case "file":
				entry.nlink=1;
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
		let parent=this.getParent(name);
		if (!parent)
			throw new FileError("ENOENT");

		let basename=pathBasename(name);
		if (!parent.children[basename])
			throw new FileError("ENOENT");

		let id=parent.children[basename];
		let entry=this.map[id];
		switch (entry.type) {
			case "file":
				entry.nlink--;
				if (!entry.nlink)
					delete this.map[id];

				break;

			case "dir":
				if (Object.keys(entry.children).length)
					throw new FileError("ENOTEMPTY");

				delete this.map[id];
				break;				

			default:
				throw new Error("unknown entry type: "+entry.type);
				break;
		}

		delete parent.children[basename];	

		return entry;
	}

	link(oldName, newName) {
		let old=this.get(oldName);
		if (!old)
			throw new FileError("ENOENT");

		if (old.type!="file")
			throw new FileError("EPERM");

		let oldParent=this.getParent(oldName);
		let newParent=this.getParent(newName);
		if (!oldParent || !newParent)
			throw new FileError("ENOENT");

		let oldBasename=pathBasename(oldName);
		let newBasename=pathBasename(newName);

		if (!oldParent.children[oldBasename])
			throw new FileError("ENOENT");

		if (newParent.children[newBasename])
			throw new FileError("EEXIST");

		let id=oldParent.children[oldBasename];
		this.map[id].nlink++;
		newParent.children[newBasename]=id;
	}
}
import {splitPath, arrayEq} from "../utils/js-util.js";

export default class Watcher extends EventTarget {
	constructor(watchName, options={}) {
		super();

		this.fs=options.fs;
		this.watchName=watchName;
		this.splitWatchName=splitPath(this.watchName);
		this.recursive=options.recursive;
	}

	match(fileName) {
		fileName=splitPath(fileName);
		if (arrayEq(this.splitWatchName,fileName))
			return true;

		if (this.recursive &&
				arrayEq(this.splitWatchName,fileName.slice(0,this.splitWatchName.length)))
			return true;

		return false;
	}

	dispatch(event, fileName) {
		fileName=splitPath(fileName);
		if (!this.match(fileName))
			throw new Error("something is wrong");

		fileName=fileName.slice(this.splitWatchName.length);
		fileName=fileName.join("/");

		let ev=new Event("change");
		ev.eventType="change";
		ev.filename=fileName;
		this.dispatchEvent(ev);
	}

	close() {
		if (!this.fs)
			return;

		let i=this.fs.watchers.indexOf(this);
		if (i<0)
			return;

		this.fs.watchers.splice(i,1);
		this.fs=null;
	}

	on(eventName, fn) {
		this.addEventListener(eventName,ev=>{
			fn(ev.eventType,ev.filename);
		});
	}
}
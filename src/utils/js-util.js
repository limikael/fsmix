export class ResolvablePromise extends Promise {
	constructor(cb = () => {}) {
        let resolveClosure = null;
        let rejectClosure = null;

		super((resolve,reject)=>{
            resolveClosure = resolve;
            rejectClosure = reject;

			return cb(resolve, reject);
		});

        this.resolveClosure = resolveClosure;
        this.rejectClosure = rejectClosure;
        this.settled=false;
 	}

	resolve=(result)=>{
		this.settled=true;
		this.resolveClosure(result);
	}

	reject=(reason)=>{
		this.settled=true;
		this.rejectClosure(reason);
	}

	isSettled() {
		return this.settled;
	}
}

export function splitPath(pathname) {
	if (Array.isArray(pathname))
		return pathname;

	if (pathname===undefined)
		throw new Error("Undefined pathname");

	return pathname.split("/").filter(s=>s.length>0);
}

export function pathBasename(pathname) {
	let split=splitPath(pathname);
	return split[split.length-1];
}

export function pathResolve(parent, child) {
	if (child.startsWith("/"))
		parent="";

	let path=splitPath(parent);
	let splitChild=splitPath(child);
	for (let part of splitChild) {
		if (part=="..") {
			path.pop();
		}

		else if (part==".") {
		}

		else
			path.push(part);
	}

	return path;
}

export function arrayUnique(a) {
	function onlyUnique(value, index, array) {
		return array.indexOf(value) === index;
	}

	return a.filter(onlyUnique);
}

export function callbackify(fn) {
	function callbackified(...args) {
		let cb=args.pop();
		fn(...args)
			.then(res=>{
				cb(null,res);
			})
			.catch(e=>{
				cb(e);
			})
	}

	return callbackified;
}
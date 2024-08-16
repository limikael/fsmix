export function requestPromise(idbReq) {
	return new Promise((resolve, reject)=>{
		idbReq.oncomplete=(ev)=>resolve();
		idbReq.onsuccess=(ev)=>resolve(ev.target.result);
		idbReq.onerror=(ev)=>reject(ev.target.error);
	});
}
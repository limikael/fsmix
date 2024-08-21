class LruCacheItem {
	constructor(key) {
		this.key=key;
		this.time=Date.now();
	}
}

export default class LruCache {
	constructor({maxItems}={}) {
		this.maxItems=maxItems;
		if (!this.maxItems)
			this.maxItems=10;

		//console.log("cache items: "+maxItems);

		this.items={};
	}

	sanitizeKey(key) {
		if (!key)
			throw new Error("Bad key: "+key);

		return String(key);
	}

	set(key, value) {
		key=this.sanitizeKey(key);

		if (value===undefined) {
			delete this.items[key]
			return;
		}

		let item=this.items[key];
		if (!item)
			item=new LruCacheItem(key);

		delete this.items[key];
		this.items[key]=item;

		item.value=value;
		item.time=Date.now();

		while (Object.keys(this.items).length>this.maxItems) {
			let k=Object.keys(this.items)[0];
			delete this.items[k];
		}
	}

	delete(key) {
		this.set(key,undefined);
	}

	get(key) {
		key=this.sanitizeKey(key);

		let item=this.items[key];
		if (!item)
			return;

		delete this.items[key];
		this.items[key]=item;

		item.time=Date.now();
		return item.value;
	}

	keys() {
		return Object.keys(this.items);
	}

	has(key) {
		key=this.sanitizeKey(key);

		return (Object.keys(this.items).includes(key))
	}
}
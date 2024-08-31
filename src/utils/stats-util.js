export function statsCount(stats, key) {
	if (!stats)
		return;

	if (!stats[key])
		stats[key]=0;

	stats[key]++;
}

export function statsDistinct(stats, key, val) {
	if (!stats)
		return;

	if (!stats[key])
		stats[key]=[];

	if (!stats[key].includes(val))
		stats[key].push(val);
}
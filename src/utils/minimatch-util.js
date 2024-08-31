import {minimatch} from "minimatch";
// todo TODO don't rely on path-browserify
import path from "path-browserify";

export function minimatchAny(name, patterns, options={}) {
	for (let pattern of patterns)
		if (minimatch(name,pattern,options))
			return true;

	return false;
}

export function findFiles({patterns, ignore, fs, pathname}) {
	if (!patterns)
		patterns=[];

	if (!ignore)
		ignore=[];

	if (!pathname)
		pathname="/";

	let res=[];
	let files=fs.readdirSync(pathname);
	for (let f of files) {
		f=fs.realpathSync(path.join(pathname,f));
		let stat=fs.statSync(f);
		if (stat.isFile() &&
				minimatchAny(f,patterns) &&
				!minimatchAny(f,ignore))
			res.push(f);

		if (stat.isDirectory() &&
				minimatchAny(f,patterns,{partial: true}) &&
				!minimatchAny(f,ignore))
			res.push(...findFiles({patterns,ignore,fs,pathname: f}));
	}

	return res;
}
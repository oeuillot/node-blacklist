import {default as fsWithCallbacks} from 'fs'
import Debug from "debug";

const fs = fsWithCallbacks.promises;

const debug = Debug('blacklist:utils');

export function normalizePath(path) {
	if (path[path.length - 1] === '/') {
		path = path.substring(0, path.length - 1);
	}

	return path;
}

export async function loadFile(path) {
	let stat;
	try {
		stat = await fs.stat(path);
	} catch (x) {
		if (x.code === 'ENOENT') {
			return;
		}
		console.error(x);
		return;
	}
	if (!stat.isFile()) {
		debug('loadFile', 'Ignore file path=%s stat=%o', path, stat);
		return;
	}

	const content = await fs.readFile(path, {encoding: 'utf8'});

	debug('loadFile', 'path=%s', path);

	return content;
}

export function splitLines(data, keepEmptyLine) {
	return data.split(/\r?\n/).filter((s) => ((s || keepEmptyLine) && s[0] !== '#'));
}

export function processGlobalLine(block, line) {
	const reg = /^([A-Z]+)\W*([A-Z]+)?:\W*(.*)$/.exec(line);
	if (!reg) {
		return block;
	}

	const [_, name, lang, value] = reg;

	const bname = block[name];

	if (!lang) {
		if (bname === undefined) {
			block[name] = value;

		} else if (typeof (bname) === 'object') {
			bname[''] = value;

		} else {
			bname[''] = value;
		}

	} else if (bname === undefined) {
		block[name] = {[lang]: value};

	} else if (typeof (bname) === 'string') {
		block[name] = {'': bname, [lang]: value};

	} else {
		bname[lang] = value;
	}

	return block;
}

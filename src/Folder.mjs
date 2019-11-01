import {default as fsWithCallbacks} from 'fs'
import Path from 'path'
import {FoldersSymbol, normalizePath, PathsSymbol} from "./Db";

import Debug from 'debug';

const fs = fsWithCallbacks.promises;

const debug = Debug('blacklist:Folder');

export default class Folder {
	constructor(name, path, options = {}) {
		this.name = name;
		this.path = path;
		this._options = options;
		this.usages = [];
	}

	async loadUsages() {
		const usageContent = await this.loadFile(Path.join(this.path, 'usage'));
		const usages = splitLines(usageContent);
		this.usages = usages;

		debug('loadUsages', 'usages=%o', usages);
	}

	addDomain(searchTreeNode, domainName, domainOnly) {
		let node = searchTreeNode;

		const reg = /^([\d]+)\.([\d]+)\.([\d]+)\.([\d]+)$/.exec(domainName);
		if (reg) {
			const ip = parseInt(reg[1]) + '.' + parseInt(reg[2]) + '.' + parseInt(reg[3]) + '.' + parseInt(reg[4]);
			let n = node[ip];
			if (!n) {
				if (domainOnly) {
					node[ip] = this.name;
					return;
				}

				n = {};
				node[ip] = n;

			} else if (typeof (n) === 'string') {
				n = {
					[FoldersSymbol]: [n]
				};
				node[ip] = n;
			}

			node = n;

		} else {
			const ls = domainName.split('.').reverse();
			ls.forEach((seg, index) => {
				let n = node[seg];
				if (!n) {
					if (domainOnly && index === ls.length - 1) {
						node[seg] = this.name;
						node = undefined;
						return;
					}
					n = {};
					node[seg] = n;

				} else if (typeof (n) === 'string') {
					n = {[FoldersSymbol]: n};
					node[seg] = n;
				}
				node = n;
			});
		}

		if (domainOnly) {
			if (!node) {
				return;
			}

			let folder = node[FoldersSymbol];
			if (!folder) {
				node[FoldersSymbol] = this.name;

			} else if (typeof (folder) === 'string') {
				node[FoldersSymbol] = [folder, this.name];

			} else {
				node[FoldersSymbol].push(this.name);
			}
		}

		return node;
	}

	async loadDomains(searchTreeNode) {

		const domains = await this.loadFile(Path.join(this.path, 'domains'));
		if (!domains) {
			return;
		}

		const ds = splitLines(domains);
		ds.forEach((d) => {
			this.addDomain(searchTreeNode, d, true);
		});
	}

	async loadUrls(searchTreeNode) {

		const urls = await this.loadFile(Path.join(this.path, 'urls'));
		if (!urls) {
			return;
		}

		const us = splitLines(urls);
		us.forEach((u) => {
			const idx = u.indexOf('/');
			if (idx < 0) {
				console.log('Can not support url=', u);
				return;
			}

			const d = this.addDomain(searchTreeNode, u.substring(0, idx));

			const p = {
				path: normalizePath(u.substring(idx)),
				name: this.name,
			};

			const paths = d[PathsSymbol];
			if (Array.isArray(paths)) {
				paths.push(p);
				return;
			}
			if (paths) {
				d[PathsSymbol] = [paths, p];
				return;
			}

			d[PathsSymbol] = p;
		});
	}

	/**
	 * Load expressions file type
	 *
	 * @param {object[]} expressionsList
	 * @param {string} filename
	 * @param {boolean} restrictive
	 * @returns {Promise<void>}
	 */
	async loadExpressions(expressionsList, filename, restrictive) {

		const expressions = await this.loadFile(Path.join(this.path, filename));
		if (!expressions) {
			return;
		}

		const exp = splitLines(expressions);
		exp.forEach((d) => {
			const regExp = new RegExp(d);
			expressionsList.push({
				name: this.name,
				restrictive,
				regExp,
			})
		});
	}

	/**
	 * Load and parse file associated to a folder
	 *
	 * @param {object} searchTreeNode
	 * @param {object[]} expressionsList
	 * @return {Promise<void>}
	 */
	async load(searchTreeNode, expressionsList) {
		await this.loadUsages();

		await this.loadDomains(searchTreeNode);

		await this.loadUrls(searchTreeNode);

		await this.loadExpressions(expressionsList, 'expressions', false);
		await this.loadExpressions(expressionsList, 'very_restrictive_expression', true);

		debug('load', 'searchTreeNode=%o', searchTreeNode);
	}

	async loadFile(path) {
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

		const content = fs.readFile(path, {encoding: 'latin1'});

		debug('loadFile', 'path=%s', path);

		return content;
	}
}

function splitLines(data) {
	return data.split(/\r?\n/).filter((s) => (s && s[0] !== '#'));
}

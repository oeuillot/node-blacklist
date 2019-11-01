import Events from 'events';
import URL from 'url';
import Path from 'path';
import NOW from 'performance-now';
import Debug from 'debug';
import {default as fsWithCallbacks} from 'fs'

const fs = fsWithCallbacks.promises;

export const FoldersSymbol = Symbol('folders');
export const PathsSymbol = Symbol('paths');

import Result from "./Result";
import Folder from "./Folder";

export const STATUS_EVENT = 'status';

export const LOADED_STATUS = 'loaded';
export const LOADING_STATUS = 'loading';
export const ERROR_STATUS = 'error';

const debug = Debug('blacklist:Db');

export default class Db extends Events {


	constructor(path, options = {}) {
		super();

		this._options = options;
		this._path = path;
		this._status = undefined;

		this._searchTreeNode = {};
		this._expressionsList = [];
		this._folders = {};

		this._changeStatus(LOADING_STATUS);

		const now = NOW();
		this._scanDb(path).then((result) => {
			const dt = NOW() - now;
			this._changeStatus(LOADED_STATUS);

			debug('constructor', 'Db path=%o loaded in %dms', path, dt);

		}, (error) => {
			this._changeStatus(ERROR_STATUS, error);
		});
	}

	_changeStatus(newStatus, error) {
		this._status = newStatus;

		this.emit(STATUS_EVENT, newStatus, error);
	}

	/**
	 * Returns db status
	 *
	 * @returns {string}
	 */
	get status() {
		return this._status;
	}

	/**
	 *
	 * @return {string}
	 */
	get path() {
		return this._path;
	}

	/**
	 *
	 * @param path
	 * @return {Promise<void>}
	 * @private
	 */
	async _scanDb(path) {
		debug('_scanDb', 'path=', path);
		const stat = await fs.stat(path);
		if (!stat.isDirectory()) {
			throw new Error('Db path is not a directory');
		}

		const files = await fs.readdir(path);

		const folders = [];
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const folderPath = Path.join(path, file);
			//console.log('>', folderPath);

			let stat2;
			try {
				stat2 = await fs.stat(folderPath);
			} catch (x) {
				continue;
			}
			if (!stat2.isDirectory()) {
				debug('_scanDb', 'Ignore file path=%s', folderPath);
				continue;
			}

			const folder = new Folder(file, folderPath, this._options);
			const p = folder.load(this._searchTreeNode, this._expressionsList);
			folders.push(p);

			this._folders[file] = folder;
		}

		return Promise.all(folders).then(() => {
			debug('_scanDb', 'Db loaded');
		});
	}

	/**
	 * @param {Result} result;
	 * @param {URL} url
	 */
	async process(url) {
		debug('process', 'Current status=', this.status);
		if (this.status === ERROR_STATUS) {
			const ex = new Error('Error status for db');
			ex.error = this.status;
			throw ex;
		}

		if (this.status === LOADING_STATUS) {
			const p = new Promise((resolved, rejected) => {
				const testStatus = (status, error) => {
					if (status === ERROR_STATUS) {
						return Promise.reject(error);
					}

					this.process(url).then(resolved, rejected);
				};

				this.once('status', testStatus);
			});

			return p;
		}

		const result = {
			domains: {},
			urls: {},
			expressions: {},
			restrictiveExpressions: {},
			found: 0,
		};

		const now = NOW();

		const {host, pathname} = url;

		const normalizedPathname = normalizePath(pathname);

		const node = this._searchTreeNode;
		const reg = /^([\d]+)\.([\d]+)\.([\d]+)\.([\d]+)$/.exec(host);
		if (reg) {
			const ip = parseInt(reg[1]) + '.' + parseInt(reg[2]) + '.' + parseInt(reg[3]) + '.' + parseInt(reg[4]);

			const n = node[ip];
			if (typeof (n) === 'string') {
				debug('process', 'ip found host=%s => node=%o', host, n);

				result.domains[n] = true;
				result.found++;

			} else if (n) {
				const nfs = n[FoldersSymbol];
				if (nfs) {
					debug('process', 'ip found host=%s => node=%o', host, nfs);

					result.domains[nfs] = true;
					result.found++;
				}

				const ps = n[PathsSymbol];
				if (Array.isArray(ps)) {
					const p = ps.find((p) => (normalizedPathname.indexOf(p.path) === 0));
					if (p) {
						debug('process', 'ip found host=%s => node=%o', host, p);

						result.urls[p.name] = true
						result.found++;
					}
				} else if (ps) {
					if (normalizedPathname.indexOf(ps.path) === 0) {
						debug('process', 'ip found host=%s => node=%o', host, ps);

						result.urls[ps.name] = true
						result.found++;
					}
				}
			}
		} else {
			const ls = host.split('.').reverse();
			let n = node;
			for (let i = 0; i < ls.length; i++) {
				const seg = ls[i];
				const tseg = n[seg];

				//console.log('seg=', seg, 'tseg=', tseg);
				if (!tseg) {
					break;
				}

				if (typeof (tseg) === 'string') {
					debug('process', 'host found host=%s => node=%o', host, tseg);

					result.domains[tseg] = true;
					result.found++;
					break;
				}

				n = tseg;

				const nfs = tseg[FoldersSymbol];
				if (Array.isArray(nfs)) {
					debug('process', 'host found host=%s => node=%o', host, nfs);

					nfs.forEach((n) => {
						result.domains[n] = true;
						result.found++;
					});
				} else if (nfs) {
					debug('process', 'host found host=%s => node=%o', host, nfs);

					result.domains[nfs] = true;
					result.found++;
				}

				const ps = tseg[PathsSymbol];
				if (Array.isArray(ps)) {
					const p = ps.find((p) => (normalizedPathname.indexOf(p.path) === 0));
					if (p) {
						debug('process', 'path found normalizedPathname=%s => ps=%o', normalizedPathname, ps);

						result.urls[p.name] = true;
						result.found++;
					}
				} else if (ps) {
					if (normalizedPathname.indexOf(ps.path) === 0) {
						debug('process', 'path found normalizedPathname=%s => ps=%o', normalizedPathname, ps);

						result.urls[ps.name] = true;
						result.found++;
					}
				}
			}
		}

		const expressions = this._expressionsList;

		const urlString = normalizePath(url.toString());
		//console.log('E=', expressions, urlString);
		expressions.forEach((expression) => {
			const regExp = expression.regExp;
			if (!regExp.exec(urlString)) {
				return;
			}

			debug('process', 'expression found regExp=%o url=%o', regExp, urlString);

			//console.log('EXP ', urlString, regExp);

			result.found++;

			if (expression.restrictive) {
				result.restrictiveExpressions[expression.name] = true;
				return;
			}
			result.expressions[expression.name] = true;
		});

		const dt = NOW() - now;

		debug('process', 'result=%o in %dms', result, dt);

		return new Result(result, this._folders, dt);
	}
}

export function normalizePath(path) {
	if (path[path.length - 1] === '/') {
		path = path.substring(0, path.length - 1);
	}

	return path;
}

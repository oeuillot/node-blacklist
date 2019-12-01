import Events from 'events';
import u from 'url';
import Path from 'path';
import Debug from 'debug';

import Result from './Result.mjs';
import Db, {STATUS_EVENT} from './Db';

export const DB_STATUS_EVENT = 'db-status';

const debug = Debug('blacklist:Blacklist');

/**
 * Blacklist object
 */
export default class Blacklist extends Events {
	constructor(options = {}) {
		super();
		this._options = options;

		debug('constructor', 'option=%o', options);
	}

	_handleStatusEvent(...args) {
		this.emit(DB_STATUS_EVENT, ...args);
	}

	/**
	 * Set db path to  <current process directory> + /blacklist
	 *
	 * @returns {string} New db path
	 * @see {process.cwd()}
	 */
	loadDbFromCwd() {
		const dbPath = Path.join(process.cwd(), 'blacklists');
		debug('setCwdDbPath', 'path=%o', dbPath);

		this.loadDb(dbPath);

		return dbPath;
	}

	/**
	 * Set the path of the Db
	 *
	 * @param {string} path
	 */
	loadDb(path) {
		debug('set dbPath', 'path=%o', path);

		if (typeof (path) !== 'string' || !path) {
			const e = new Error('Invalid path parameter');
			e.path = path;
			throw e;
		}

		const currentDb = this._db;
		if (currentDb) {
			currentDb.removeListener(STATUS_EVENT, this._handleStatusEvent);
		}

		const newDb = new Db(path, this._options.db || {});
		this._db = newDb;

		newDb.addListener(STATUS_EVENT, this._handleStatusEvent);
	}

	/**
	 *
	 * @returns {Db}
	 */
	getCurrentDb() {
		if (!this._db) {
			throw new Error('No db setted, you must set db path before.');
		}
		return this._db;
	}

	/**
	 * Process an URL and returns a result object
	 *
	 * @param {URL|string} url
	 * @return {Promise<Result>} result
	 */
	async process(url) {
		if (typeof (url) === 'string') {
			url = new u.URL(url);
		}

		debug('process', 'url=%o', url);
		const db = this.getCurrentDb();

		const result = await db.process(url);

		debug('process', 'url=%o result=%o', url, result);

		return result;
	}
}

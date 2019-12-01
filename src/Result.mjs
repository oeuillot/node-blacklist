import Debug from "debug";

const debug = Debug('blacklist:Result');

/**
 * Result of processing
 */
export default class Result {
	constructor(result, folders, cpuMs) {
		this._result = result;
		this._usages = {};
		this._domains = {};

		this._cpuMs = cpuMs;

		this._addUsages(result.domains, folders);
		this._addUsages(result.urls, folders);
		this._addUsages(result.expressions, folders);
		this._addUsages(result.restrictiveExpressions, folders);

		debug('constructor', 'result=%o usages=%o domains=%o', result, this._usages, this._domains);
	}

	_addUsages(fs, folders) {
		const usages = this._usages;
		const domains = this._domains;

		Object.keys(fs).forEach((name) => {
			const f = folders[name];

			domains[name] = true;

//			console.log("f=", f);
			f.usages.forEach((u) => {
				usages[u] = true;
			});
		});
	}

	/**
	 * List of usages
	 *
	 * @return {Array<string>}
	 */
	get usages() {
		return Object.keys(this._usages);
	}

	/**
	 * List of domains
	 *
	 * @return {Array<string>}
	 */
	get domains() {
		return Object.keys(this._domains);
	}

	/**
	 * Has a usage in the list
	 *
	 * @param {string} usage
	 * @return {boolean}
	 */
	hasUsage(usage) {
		return !!this._usages[usage];
	}

	/**
	 * Has a domain in the list
	 *
	 * @param {string} domain
	 * @return {boolean}
	 */
	hasDomain(domain) {
		return !!this._domains[domain];
	}

	/**
	 * Get CPU time in milliseconds
	 *
	 * @returns {number}
	 */
	get cpuMs() {
		return this._cpuMs;
	}

	/**
	 * Has black usage ?
	 *
	 * @returns {boolean}
	 */
	hasBlack() {
		return this.hasUsage('black');
	}

	/**
	 * Has white usage ?
	 *
	 * @returns {boolean}
	 */
	hasWhite() {
		return this.hasUsage('white');
	}
}

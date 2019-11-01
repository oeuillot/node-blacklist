import Debug from "debug";

const debug = Debug('blacklist:Result');

export default class Result {
	constructor(result, folders, cpuMs) {
		this._result = result;
		this._usages = {};

		this._cpuMs = cpuMs;

		this._addUsages(result.domains, folders);
		this._addUsages(result.urls, folders);
		this._addUsages(result.expressions, folders);
		this._addUsages(result.restrictiveExpressions, folders);
	}

	_addUsages(fs, folders) {
		const usages = this._usages;

		Object.keys(fs).forEach((name) => {
			const f = folders[name];

//			console.log("f=", f);
			f.usages.forEach((u) => {
				usages[u] = true;
			});
		});
	}

	/**
	 *
	 * @return {Array<string>}
	 */
	get usages() {
		return Object.keys(this._usages);
	}

	/**
	 *
	 * @param {string} usage
	 * @return {boolean}
	 */
	hasUsage(usage) {
		return this.usages[usage];
	}

	get cpuMs() {
		return this._cpuMs;
	}

	hasBlack() {
		return this.hasUsage('black');
	}

	hasWhite() {
		return this.hasUsage('white');
	}
}

import EpubCFI from "./epubcfi";
import {
	qs,
	qsa,
	querySelectorByType,
	indexOfSorted,
	locationOf
} from "./utils/core";

/**
 * Page List Parser
 * @param {document} [xml]
 */
class PageList {
	constructor(xml, path, canonical) {
		this.pages = [];
		this.locations = [];
		this.epubcfi = new EpubCFI();

		this.firstPage = 0;
		this.lastPage = 0;
		this.totalPages = 0;

		this.pagesByAbsolutePath = {};

		this.toc = undefined;
		this.ncx = undefined;

		this.path = path;
		this.canonical = canonical;

		if (xml) {
			this.pageList = this.parse(xml);
		}

		if(this.pageList && this.pageList.length) {
			this.process(this.pageList);
		}
	}

	/**
	 * Parse PageList Xml
	 * @param  {document} xml
	 */
	parse(xml) {
		var html = qs(xml, "html");
		var ncx = qs(xml, "ncx");

		if(html) {
			return this.parseNav(xml);
		} else if(ncx){ // Not supported
			// return this.parseNcx(xml);
			return;
		}

	}

	/**
	 * Parse a Nav PageList
	 * @private
	 * @param  {node} navHtml
	 * @return {PageList.item[]} list
	 */
	parseNav(navHtml){
		var navElement = querySelectorByType(navHtml, "nav", "page-list");
		var navItems = navElement ? qsa(navElement, "li") : [];
		var length = navItems.length;
		var i;
		var list = [];
		var item;

		if(!navItems || length === 0) return list;

		for (i = 0; i < length; ++i) {
			item = this.item(navItems[i], i);
			list.push(item);
		}

		return list;
	}

	/**
	 * Page List Item
	 * @private
	 * @param  {node} item
	 * @return {object} pageListItem
	 */
	item(item, i){
		var content = qs(item, "a"),
				href = content.getAttribute("href") || "",
				text = content.textContent || "",
				pageLabel = text,
				page = i + 1, 
				isCfi = href.indexOf("epubcfi"),
				split,
				packageUrl,
				cfi;

		if(isCfi != -1) {
			split = href.split("#");
			packageUrl = split[0];
			cfi = split.length > 1 ? split[1] : false;
			return {
				"cfi" : cfi,
				"href" : href,
				"packageUrl" : packageUrl,
				"page" : page,
				"pageLabel": pageLabel
			};
		} else {
			return {
				"href" : href,
				"page" : page,
				"pageLabel": pageLabel
			};
		}
	}

	/**
	 * Process pageList items
	 * @private
	 * @param  {array} pageList
	 */
	process(pageList){
		pageList.forEach(function(item){
			this.pages.push(item.page);
			if (item.cfi) {
				this.locations.push(item.cfi);
			}
			if ( item.href ) {
				var href = (item.href.split('#'))[0];
				var path = this.path.resolve(href);
				var absolute = this.canonical(path);
				if ( this.pagesByAbsolutePath[absolute] == null ) {
					this.pagesByAbsolutePath[absolute] = [];
				}
				this.pagesByAbsolutePath[absolute].push(item.page);
			}
		}, this);
		this.firstPage = parseInt(this.pages[0]);
		this.lastPage = parseInt(this.pages[this.pages.length-1]);
		this.totalPages = this.lastPage - this.firstPage;
	}

	/**
	 * Get a PageList result from a EpubCFI
	 * @param  {string} cfi EpubCFI String
	 * @return {number} page
	 */
	pageFromCfi(cfi){
		var pg = -1;

		// Check if the pageList has not been set yet
		if(this.locations.length === 0) {
			return -1;
		}

		// TODO: check if CFI is valid?

		// check if the cfi is in the location list
		// var index = this.locations.indexOf(cfi);
		var index = indexOfSorted(cfi, this.locations, this.epubcfi.compare);
		if(index != -1) {
			pg = this.pages[index];
		} else {
			// Otherwise add it to the list of locations
			// Insert it in the correct position in the locations page
			//index = EPUBJS.core.insert(cfi, this.locations, this.epubcfi.compare);
			index = locationOf(cfi, this.locations, this.epubcfi.compare);
			// Get the page at the location just before the new one, or return the first
			pg = index-1 >= 0 ? this.pages[index-1] : this.pages[0];
			if(pg !== undefined) {
				// Add the new page in so that the locations and page array match up
				//this.pages.splice(index, 0, pg);
			} else {
				pg = -1;
			}

		}
		return pg;
	}

	pagesFromLocation(location) {
		var pgs = [];

		// Check if the pageList has not been set yet
		if(this.locations.length === 0) {
			return [];
		}

		var pg = this.pageFromCfi(location.start.cfi);
		if ( pg == -1 ) {
			return [];
		}

		pgs.push(pg);
		pg = this.pageFromCfi(location.end.cfi);
		if ( pg != pgs[0] ) {
			pgs.push(pg);
		}

		return pgs;
	}

	pageLabel(page) {
		var item = this.pageList[page];
		if ( item ) {
			return item.pageLabel || `#${page}`;
		}
		return -1;
	}

	/**
	 * Get an EpubCFI from a Page List Item
	 * @param  {string | number} pg
	 * @return {string} cfi
	 */
	cfiFromPage(pg){
		var cfi = -1;
		// check that pg is an int
		if(typeof pg != "number"){
			pg = parseInt(pg);
		}

		// check if the cfi is in the page list
		// Pages could be unsorted.
		var index = this.pages.indexOf(pg);
		if(index != -1) {
			cfi = this.locations[index];
		}
		// TODO: handle pages not in the list
		return cfi;
	}

	cfiFromPageLabel(pageLabel) {
		var item = this.pageList.find(item => item.pageLabel == pageLabel);
		if ( item ) {
			return this.cfiFromPage(item.page);
		}
		return -1;
	}

	/**
	 * Get a Page from Book percentage
	 * @param  {number} percent
	 * @return {number} page
	 */
	pageFromPercentage(percent){
		var pg = Math.round(this.totalPages * percent);
		return pg;
	}

	itemFromPercentage(percent) {
		var pg = this.pageFromPercentage(percent);
		return this.pageList[pg - 1];
	}

	itemFromCfi(cfi) {
		var pg = this.pageFromCfi(cfi);
		return this.pageList[pg - 1];
	}

	/**
	 * Returns a value between 0 - 1 corresponding to the location of a page
	 * @param  {number} pg the page
	 * @return {number} percentage
	 */
	percentageFromPage(pg){
		var percentage = (pg - this.firstPage) / this.totalPages;
		return Math.round(percentage * 1000) / 1000;
	}

	/**
	 * Returns a value between 0 - 1 corresponding to the location of a cfi
	 * @param  {string} cfi EpubCFI String
	 * @return {number} percentage
	 */
	percentageFromCfi(cfi){
		var pg = this.pageFromCfi(cfi);
		var percentage = this.percentageFromPage(pg);
		return percentage;
	}

	/**
	 * Destroy
	 */
	destroy() {
		this.pages = undefined;
		this.locations = undefined;
		this.epubcfi = undefined;

		this.pageList = undefined;

		this.toc = undefined;
		this.ncx = undefined;
	}
}

export default PageList;

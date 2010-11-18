// Copyright Hiren Joshi - tobe LGPLed
/**
 * @fileoverview    Tag visualisation class
 * @author          hirenj
 */

if ( typeof(MASCP) == 'undefined' ) {
    MASCP = {};
}

/**

*/
if ( typeof(MASCP.TagVisualisation) == 'undefined' ) {
	MASCP.TagVisualisation = {};
}

/**
 * MASCP.TagVisualisation. Provides a set of visualisations which can be used
 * to render tables of tags.
 * e.g:
 *
 * <pre>
 * ***************************************
 * * Row *  Surname * Number of children *
 * ***************************************
 * *  1  *  Smith   *   25               *
 * *  2  *  Jones   *   12               *
 * *  3  *  Wesson  *   8                *
 * ***************************************
 * </pre>
 * 
 * This javascript will replace this table with a tag cloud, and set the sizes
 * of each of the tags (in this case Surname would be appropriate to use) to
 * correspond to the number of children.
 *
 * It is important the markup for the table contain thead and tbody elements, 
 * as these are required to distinguish between header and data sections within
 * the table.
 * 
 * <h3>Usage</h3>
 * <pre>
 * 	var tagvis;
 *	tagvis = new MASCP.TagVisualisation("table_identifier",[MASCP.TagVisualisation.TagCloud]);
 *
 *  // Set the tag column to 2
 *	tagvis.tagColumn = 2;
 *
 *  // Optionally set the tagFactory method to return A elements instead of SPANS
 *	foobar.visualisations[0].tagFactory = function(tagId,tag,row) {
 *		var md = MochiKit.DOM;
 *		var tagEl = md.A({ "id" : MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId
 *					}, tag);
 *		return tagEl;
 *	};
 *
 *  // Call an update on the visualisation, using data column 1
 *	foobar.visualisations[0].update(1);
 * </pre>
 *
 * @param {String} datasetName The id of the table containing the dataset.
 * @param {Class[]} visClasses The classes of the visualisations to be used in this visualiser
 * @constructor 
 */
MASCP.TagVisualisation = function(datasetName,visClasses) {
	this.datasetName = datasetName;
	this._buildRichTableView(visClasses);
	
};

MASCP.TagVisualisation.prototype = {
	__class__: MASCP.TagVisualisation,
	/** The visualisations
	 *  @type Visualisation[]
	 */
	visualisations: null,
	/** The id of the element used for data
	 * @type String
	 */
	datasetName: "",
	/** The column number in the data set for tag names
	 *  @type int
	 */
	tagColumn: ""
};

MASCP.TagVisualisation.prototype._buildRichTableView = function(visClasses) {
	var datasetName = this.datasetName;
	var dataTable = document.getElementById(datasetName);
	if (dataTable.getAttributeNS) {
		var newColumn = parseInt(dataTable.getAttributeNS("MASCP.TagVisualisation","tagcolumn"));
		this.tagColumn = newColumn ? newColumn : this._getTagColumn();
	} else {
		this.tagColumn = this._getTagColumn();
	}
	var dataTableContainer = dataTable.parentNode;
	var containingElement = null;

	// Place the Table element within a containing DIV
	// just in case it's not in one already
	// containingElement will then contain a sized div
	// which is the dataTableContainer. The dataTableContainer
	// contains the table itself.
	
	if (dataTableContainer.nodeName == "BODY") {
		containingElement = dataTableContainer;
		var container_div = document.createElement('div');
		dataTable.parentNode.replaceChild(container_div,dataTable);		
		container_div.appendChild(dataTable);
		dataTableContainer = dataTable.parentNode;
	} else {
		containingElement = dataTableContainer.parentNode;
	}

	this._dataTableContainer = dataTableContainer;

	var richDiv = this._buildRichTagInfoContainer(dataTableContainer);
	containingElement.insertBefore( richDiv, dataTableContainer);	
	this._displayElement = richDiv;

	for (var i = 0; i < visClasses.length; i++ ) {
		this.addVisualisation(new visClasses[i](this));
	}
	// Hide away the existing table
	dataTable.old_style = dataTable.style.display;
	dataTable.style.display = "none";
	
};

MASCP.TagVisualisation.prototype._getDisplayWidth = function(el) {
	var computedStyle;

	// If the default method of obtaining the
	// computed style works, use that
	if ( window.getComputedStyle != undefined ) {
		computedStyle = getComputedStyle(el,"");

	// We need to use a different method to get the computed style
	// from Safari
	} else if (document.defaultView.getComputedStyle != undefined) {
		computedStyle = document.defaultView.getComputedStyle(el,"");
	}

	// Use a default width just in case we can't find a computed style
	if (computedStyle != undefined) {
		return parseInt(computedStyle.getPropertyValue("width").replace(/px/, ""));	
	} else {
		return undefined;
	}
};

MASCP.TagVisualisation.prototype._buildRichTagInfoContainer = function(currentElement) {
    var a_div = document.createElement('div');
    a_div.setAttribute('id', "rich_"+this.datasetName );
    a_div.setAttribute('class', "rich_as_data "+currentElement.className );
    a_div.style.width = currentElement.style.width;
    a_div.style.height = currentElement.style.height;
    a_div.style.display = currentElement.style.display;
    a_div.style.position = currentElement.style.position;
    return a_div;
};

/**
 * Toggle the usage of this visualisation. Returns the original 
 * table to the data flow if has been hidden.
 */
MASCP.TagVisualisation.prototype.toggleTagView = function() {
	var dataTable = document.getElementById(this.datasetName);
	if ( dataTable.style.display == "none" ) {
		dataTable.style.display = dataTable.old_style;
		this.getDisplayElement().style.display = "none";
	} else {
		dataTable.style.display = "none";
		this.getDisplayElement().style.display = "block";		
	}
}

/**
 * Returns the element in the document which act as the container to the visualisation
 * @return {HTMLElement} Container element
 */
MASCP.TagVisualisation.prototype.getDisplayElement = function() {
	return this._displayElement;
}

/**
 * Add a visualisation to the visualiser
 * @param Visualisation (such as instance of TagCloud)
 */
MASCP.TagVisualisation.prototype.addVisualisation = function(visObject) {
    if ( ! this.visualisations ) {
        this.visualisations = [];
    }
	this.getDisplayElement().appendChild(visObject.getDisplayElement());
	this.visualisations.push(visObject);
}
/**
 * Get all the tags found in this data set
 * @return {String[]} Array of tag names
 */
MASCP.TagVisualisation.prototype.getAllTags = function() {
	var dataTable = document.getElementById(this.datasetName);
	var tableRows = dataTable.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
	var maxValue = 0;

	var alltags = {};

	for ( var i = 0; i < tableRows.length ; i++ ) {
		tagname = tableRows[i].getElementsByTagName("td")[this.tagColumn].childNodes[0].data;
		alltags[tableRows[i].id] = tagname;
	}
	return alltags;
}

MASCP.TagVisualisation.prototype._getTagColumn = function() {
	var dataTable = document.getElementById(this.datasetName);
	var headers = dataTable.getElementsByTagName("thead")[0].getElementsByTagName("tr")[0].getElementsByTagName("th");
	for ( var i = 0; i < headers.length ; i++ ) {
		if ( headers[i].childNodes[0].data.toLowerCase() == "tag" ) {
			return i;
		}
	}
	return 1;
};
MASCP.TagVisualisation.prototype._getColumnCount = function() {
	var dataTable = document.getElementById(this.datasetName);
	var headers = dataTable.getElementsByTagName("thead")[0].getElementsByTagName("tr")[0].getElementsByTagName("th");
	return (headers.length - this._getTagColumn() - 1);
};

/**
 * MASCP.TagVisualisation::TagCloud class
 * @class
 */
if ( typeof(MASCP.TagVisualisation.TagCloud) == undefined ) {
	MASCP.TagVisualisation.TagCloud = {};
}

/**
 * Create a new TagCloud visualisation
 * @param {TagVisualiser} tagVisualiser The TagVisualiser object to attach this visualisation to
 * @constructor 
 */
MASCP.TagVisualisation.TagCloud = function(tagVisualiser) {
	this._tagVisualiser = tagVisualiser;
	this._initElements();
};

MASCP.TagVisualisation.TagCloud.prototype = {
	__class__: MASCP.TagVisualisation.TagCloud
};
/**
 * Class appended to the element which contains the tags. Defaults to "rich_tagcloud"
 */
MASCP.TagVisualisation.TagCloud.ELEMENT_CSS_CLASS = "rich_tagcloud";
/**
 * Prefix appended to the id of the element which contains the tags. Defaults to "rich_tagcloud_"
 */
MASCP.TagVisualisation.TagCloud.ELEMENT_ID_PREFIX = "rich_tagcloud_";
/**
 * Class appended to the tag element. Defaults to "rich_tagcloud_tag"
 */
MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_CSS_CLASS = "rich_tagcloud_tag";
/**
 * Prefix appended to the id of the tag element. Defaults to "rich_tagcloud_tag_"
 */
MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX = "rich_tagcloud_tag_";

MASCP.TagVisualisation.TagCloud.prototype._initElements = function() {
	this._displayElement = document.createElement('div');
	this._displayElement.setAttribute("id",MASCP.TagVisualisation.TagCloud.ELEMENT_ID_PREFIX+this._tagVisualiser.datasetName);
	this._displayElement.setAttribute("class",MASCP.TagVisualisation.TagCloud.ELEMENT_CSS_CLASS);
	return this._displayElement;
};

/**
 * Get the element used to contain the tags
 * @return {HTMLElement} Generated element acting as tag container
 */
MASCP.TagVisualisation.TagCloud.prototype.getDisplayElement = function() {
	return this._displayElement;
};

/**
 * Update this visualisation using the given data column number, which is an offset
 * from the base of the tag column number.
 * @param {int} dataColumn Data column offset (e.g. 1 for the next column after the tag column)
 */
MASCP.TagVisualisation.TagCloud.prototype.update = function(dataColumn) {
	var container = this.getDisplayElement();
	var dataTable = document.getElementById(this._tagVisualiser.datasetName);
	var values = {};
	var all_values = {};
	var tableRows = dataTable.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
	var maxValue = 0;

	var alltags = new Array();
	for (var i = 0; i < tableRows.length ; i++ ) {
		var row_values = tableRows[i].getElementsByTagName("td"); 
		var value = parseFloat(row_values[this._tagVisualiser.tagColumn+dataColumn].childNodes[0].data);
		if (row_values[this._tagVisualiser.tagColumn].childNodes.length == 0) {
		    continue;
	    }
		var tagname = row_values[this._tagVisualiser.tagColumn].childNodes[0].data;
		values[tagname]	= value;
		all_values[tagname] = row_values;
		maxValue = Math.max(maxValue,value);
		alltags[i] = tagname;
	}
	alltags.sort();
	for (var i = 0; i < alltags.length; i++ )  {
		var tag = alltags[i];
		if ( ! tag ) {
		    continue;
		}
		var tagId = tag.replace(/\s+/,"_");
		if ( document.getElementById(MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId) != null ) {
			var tagSpan = document.getElementById(MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId);
			tagSpan.parentNode.removeChild(tagSpan);
		}

		var tagSpan = this.tagFactory(tagId,tag,all_values[tag]);
		container.appendChild(tagSpan);

		var fontsize = Math.floor(30 * Math.log(1.5 + (values[tag] / maxValue)));
		tagSpan.style.fontSize = fontsize+"px";
		tagSpan.setAttribute('class',  MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_CSS_CLASS );
	}
	if ( ! container.hasSpacer ) {
	    var a_div = document.createElement('div');
	    a_div.setAttribute('class','spacer');
	    a_div.setAttribute('style','width: 100%; height: 0px; clear: both;');
	    container.appendChild(a_div);
		container.hasSpacer = true;
	}
};
/**
 * Factory method for creating tags. Override this method to specify your own tags
 * @param {String} 			tagId 		Identifier for the new element
 * @param {String} 			tag	 		The actual tag to be displayed
 * @param {HTMLElement[]} 	row			The full data row (from the table) for this tag  
 */
MASCP.TagVisualisation.TagCloud.prototype.tagFactory = function(tagId,tag,row) {
    var a_span = document.createElement('span');
    a_span.setAttribute('id', MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId );
    a_span.textContent = tag;
    return a_span;
};

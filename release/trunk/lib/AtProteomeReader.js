/**
 *  @fileOverview Classes for reading data from the AtProteome database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}


/*
 * @class   Service that will retrieve the AtProteome ID for this entry given an AGI.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
MASCP.AtProteomeIdReader = MASCP.buildService(function(data) {
                            this._raw_data = data;
                        });

MASCP.AtProteomeIdReader.prototype.requestData = function()
{
    var agi = (this.agi+"").replace(/\..*$/,'');
    return {
        type: "POST",
        dataType: "xml",
        data: { 'page'      : 'query_protein',
                'myassembly': '1#9',
                'queryf'    : agi,
                'service'   : 'atproteome' 
        }
    };    
};

/*
 * @class
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtProteomeIdReader.Result = MASCP.AtProteomeIdReader.Result;

/*
 * The retrieved ID from the AtProteome database
 */
MASCP.AtProteomeIdReader.Result.prototype.getId = function()
{
    var doc = this._raw_data;
    var trs = doc.getElementsByTagName('tr');
    for (var i = 0; i < trs.length; i++) {
        if (trs[i].getAttribute('onclick') != null) {
            if (trs[i].getAttribute('onclick').match(/protein_id=(\d+)/)) {
                return RegExp.$1;
            }
        }
    }
    var content = null;
    if (this._raw_data.getElementById) {
        content = this._raw_data.getElementById('contentArea');
    } else {
        content = this._raw_data.selectSingleNode("//*[@id = 'contentArea']");
    }
    return content || -1;
};

/*
 * @class   Service that will retrieve the AtProteome Tissue data for this entry given an AGI.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
MASCP.AtProteomeTissueReader = MASCP.buildService(function(data) {
                            this._raw_data = data;
                        });

MASCP.AtProteomeTissueReader.prototype.requestData = function()
{
    var agi = (this.agi+"").replace(/\..*$/,'');

    var protein_id = MASCP.AtProteomeReader.lookupAgi(agi,this);
        
    if ( ! protein_id ) {
        return null;
    }
    
    if ( protein_id < 0 ) {
        return null;
    }
    
    return {
        type: "POST",
        dataType: "xml",
        data: { 'myassembly'    : '1#9',
                'page'          : 'query_protein',
                'querystring'   : 'protein_id='+protein_id+'&tissue='+this.tissue,
                'service'       : 'atproteome' 
        }
    };    
};

/*
 * @class
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtProteomeTissueReader.Result = MASCP.AtProteomeTissueReader.Result;

/*
 * Get the total number of spectra defined in the AtProteome Database for a single tissue
 */
MASCP.AtProteomeTissueReader.Result.prototype.getTotalSpectra = function()
{
    if ( ! this._raw_data ) {
        return null;
    }
    var doc = this._raw_data;
    var headings = doc.getElementsByTagName('h1');
    var peptide_table = null;
    for (var i = 0; i < headings.length; i++) {
        if (jQuery(headings[i]).text() == 'Peptides') {
            peptide_table = headings[i].parentNode.getElementsByTagName('table')[1];
        }
    }
    if ( ! peptide_table ) {
        return null;
    }
    var trs = peptide_table.getElementsByTagName('tr');
    
    var tds = trs[trs.length-1].getElementsByTagName('td');
    if (tds.length > 0) {
        return parseInt(jQuery(tds[1]).text());
    } else{
        return null;
    }
};


/*
 * Get the spectral counts for every peptide in this tissue
 * @returns Hash mapping peptide position (start-end) to spectra count
 * @type Hash
 */
MASCP.AtProteomeTissueReader.Result.prototype.getPeptideCounts = function()
{
    if ( ! this._raw_data ) {
        return null;
    }
    var doc = this._raw_data;
    var headings = doc.getElementsByTagName('h1');
    var peptide_table = null;
    for (var i = 0; i < headings.length; i++) {
        if (jQuery(headings[i]).text() == 'Peptides') {
            peptide_table = headings[i].parentNode.getElementsByTagName('table')[1];
        }
    }
    if ( ! peptide_table ) {
        return null;
    }
    var trs = peptide_table.getElementsByTagName('tr');    
    var pep_counts = {};
    for (var i = 1; i < trs.length - 1; i++) {
        var tds = trs[i].getElementsByTagName('td');
        var pep_seq = jQuery(tds[0]).text().replace(/\s/g,'');
        var spectra_count = parseInt(jQuery(tds[1]).text());
        var start = parseInt(jQuery(tds[2]).text());
        var end = start + pep_seq.length;
        pep_counts[start+"-"+end] = spectra_count;
    }
    return pep_counts;
}

/**
 * @class   Service class that will retrieve AtProteome data for this entry given an AGI.
 *          To retrieve data from AtProteome, two requests need to be made to the remote
 *          server. The first request ascertains the internal ID used by AtProteome for
 *          the given AGI. A second request then retrieves the data from AtProteome.
 *          Data is received in XML format, and will need to go through a tidying proxy
 *          if retrieving data directly from AtProteome.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
MASCP.AtProteomeReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });


/**
 * Retrieve the protein ID for a given AGI
 */
MASCP.AtProteomeReader.lookupAgi = function(agi,reader)
{
    if (! this.agi_cache || ! this.agi_cache[agi]) {
        new MASCP.AtProteomeIdReader(agi,reader._endpointURL).bind("resultReceived", function (e) {
            if ( ! MASCP.AtProteomeReader.agi_cache ) {
                MASCP.AtProteomeReader.agi_cache = [];
            }
            MASCP.AtProteomeReader.agi_cache[this.agi] = this.result.getId();
            if (this.result.getId()) {
                reader.retrieve();
            }
        }).setAsync(reader.async).retrieve();
        return null;
    }
    return this.agi_cache[agi];
};


MASCP.AtProteomeReader.prototype.requestData = function()
{
    var agi = (this.agi+"").replace(/\..*$/,'');
    
    var protein_id = MASCP.AtProteomeReader.lookupAgi(agi,this);
    
    if ( ! protein_id ) {
        return null;
    }
    if ( protein_id < 0 ) {
        jQuery(this).trigger('resultReceived');        
    }
    
    var self = this;
    
    return {
        type: "POST",
        dataType: "xml",
        data: { 'myassembly': '1#9',
                'page'      : 'query_protein',
                'queryf'    : agi,
                'querystring' : 'protein_id='+protein_id,
                'service'   : 'atproteome' 
        },
        success: function(data,status) {
            self._dataReceived(data,status);
            if (self.result) {
                jQuery(self.result).bind('spectrareceived',function() {
                   jQuery(self).trigger('resultReceived'); 
                });
                self.result.retrieveSpectraByTissue();
            }
        }
    };
};


/**
 * @class   Container class for results from the AtProteome service
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtProteomeReader.Result = MASCP.AtProteomeReader.Result;

/**
 * The list of tissue names that are used by AtProteome. This list is
 * indepedent of spectral data
 *  @returns {[String]} Tissue names
 */
MASCP.AtProteomeReader.Result.prototype.tissues = function()
{
    if ( ! this._raw_data ) {
        return null;
    }
    var doc = this._raw_data;
    var headings = doc.getElementsByTagName('h1');
    var tissue_table = null;
    for (var i = 0; i < headings.length; i++) {
        if (jQuery(headings[i]).text() == 'Peptides') {
            tissue_table = headings[i].parentNode.getElementsByTagName('table')[0];
        }
    }
    if ( ! tissue_table ) {
        return null;
    }
    
    var table_headings = tissue_table.getElementsByTagName('tr')[0].getElementsByTagName('td');
    var tissue_names = []
    for (var i = 0; i < table_headings.length; i++) {
        if (jQuery(table_headings[i]).text() != "\nAll samples\n") {
            tissue_names.push(jQuery(table_headings[i]).text());
        }
    }
    return tissue_names;
}

/**
 * @name    MASCP.AtProteomeReader.Result#spectrareceived
 * @event
 * @param   {Object}    e
 */


MASCP.AtProteomeReader.Result.prototype = jQuery.extend(MASCP.AtProteomeReader.Result.prototype,
/** @lends MASCP.AtProteomeReader.Result.prototype */
{
    /** @field 
     *  @description Hash keyed by tissue name containing the number of spectra for each tissue for this AGI */
    spectra :   null,
    /** @field
     *  @description Hash keyed by tissue name containing the number of spectra for each peptide (keyed by "start-end" position) */
    peptide_counts_by_tissue : null
});


/**
 *  Retrieve the spectral data for this result. Fires a {@link MASCP.AtProteomeReader.Result#event:spectrareceived} when the spectra
 *  are fully populated into the spectra field.
 */
MASCP.AtProteomeReader.Result.prototype.retrieveSpectraByTissue = function()
{   
    var tissues = this.tissues();
    if ( ! tissues ) {
        return null;
    }
    
    var this_result = this;
    
    
    this.spectra = {};
    this.peptide_counts_by_tissue = {}
    var total_tissues = tissues.length;
    
    for (var i in tissues) {
        this.spectra[tissues[i]] = 0;
        var tissue_reader = new MASCP.AtProteomeTissueReader(this.agi,this.reader._endpointURL);
        tissue_reader.setAsync(this.reader.async);
        tissue_reader.tissue = tissues[i];
        var tissue_name = tissues[i];

        new function() { 
            var some_tissue = tissue_name;
        tissue_reader.bind("resultReceived",function() {
            total_tissues--;
            this_result.spectra[some_tissue] = this.result.getTotalSpectra();
            this_result.peptide_counts_by_tissue[some_tissue] = this.result.getPeptideCounts();
            if (total_tissues == 0)
            {
                jQuery(this_result).trigger('spectrareceived');
            }
        }).retrieve();
        }();
    }
    
    return null;
};

MASCP.AtProteomeReader.Result.prototype.render = function()
{
    var params = jQuery.param(this.reader.requestData()['data']);
    var total = 0;
    for (var i in this.spectra) {
        total += parseInt(this.spectra[i]);
    }
    var a_container = jQuery('<div>MS/MS spectra <input type="checkbox" class="group_toggle"/><a style="display: block; float: right;" href="http://fgcz-atproteome.unizh.ch/index.php?'+params+'">AtProteome</a></div>');
    jQuery(this.reader.renderers).each ( function(i){
        this.createGroupCheckbox('atproteome',jQuery('input.group_toggle',a_container));
    });
    return a_container;
};


MASCP.AtProteomeReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
	MASCP.registerGroup('atproteome',{ 'fullname' : 'AtProteome data','hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#000099' });

    this.bind('resultReceived', function() {
        var tissues = this.result? this.result.tissues() : [];
        for (var tiss in tissues) {
            var tissue = tissues[tiss];
            if (this.result.spectra[tissue] < 1) {
                continue;
            }
            var peptide_counts = this.result.peptide_counts_by_tissue[tissue];
            var simple_tissue = tissue.replace(/\s/g,'');
            var overlay_name = 'atproteome_by_tissue_'+simple_tissue;
        	
            // var css_block = ' .overlay { display: none; } .active .overlay { display: block; top: 0px; background: #000099; } ';
            
        	var css_block = ' .overlay { display: none; } .tracks .active { fill: #000099; } .inactive { display: none; } .active .overlay { display: block; top: 0px; background: none; border-bottom: solid #000000 1px; } ';
        	
        	MASCP.registerLayer(overlay_name,{ 'fullname' : tissue + ' ('+this.result.spectra[tissue]+' spectra)', 'group' : 'atproteome', 'color' : '#000099', 'css' : css_block });

            var do_diagrams = (window.location.search.replace(/^\?/, '').indexOf('drawMap') >= 0);

            if (typeof GOMap != 'undefined' && do_diagrams) {
                var map = this._map;
                if ( ! map ) {
                    var map_container = jQuery('<div style="position: relative; height: 0px; width: 100%; margin-bottom: 2px; overflow: hidden;"></div>');

                    map = new GOMap.Diagram('mature_flower_diagram.svg', { 'load' : (function() {
                        map_container.css({'height': '100%','overflow':'visible'});
                    })});

                    this._map = map;
                    this._map_container = map_container[0];
                    map.appendTo(map_container[0]);
                    
                }
                
                // FIXME FOR MULTIPLE BINDINGS
                
                jQuery(MASCP.getLayer(overlay_name)).bind('mouseover',function() {
                    map.showKeyword(simple_tissue);
                });
            }
            
            
        	var positions = this._normalise(this._mergeCounts(peptide_counts));
        	var index = 0;
        	var last_start = null;
        	while (index <= positions.length) {
        	    if ((! (positions[index] > 0) || (index == positions.length) ) && last_start != null) {
        	        sequenceRenderer.getAminoAcidsByPosition([last_start])[0].addBoxOverlay(overlay_name,1,index-1-last_start);
        	        last_start = null;
        	    }
        	    if (positions[index] > 0 && last_start == null) {
        	        last_start = index;
        	    }
        	    index += 1;
        	}
        }
    });

    return this;
};

MASCP.AtProteomeReader.prototype._normalise = function(array)
{
    var max_val = 0;
    for (var i = 0; i < array.length; i++)
    {
        if (array[i] && array[i] > max_val) {
            max_val = array[i];
        }
    }
    for (var i = 0; i < array.length; i++)
    {
        if (array[i] && array[i] > 0) {
            array[i] = (array[i] * 1.0) / max_val;
        }
    }
    return array;
};

MASCP.AtProteomeReader.prototype._mergeCounts = function(hash)
{
    var counts = [];
    for (var position in hash) {
        var ends = position.split('-');
        var start = parseInt(ends[0]);
        var end = parseInt(ends[1]);
        for (var i = start; i <= end; i++) {
            if ( ! counts[i] ) {
                counts[i] = 0;
            }
            counts[i] += hash[position];
        }
    }
    return counts;
};

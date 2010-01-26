/**
 *  @fileOverview Classes for reading data from the AtProteome database using JSON data
 */

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
MASCP.AtProteomeReaderJson = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (data) {
                            this._populate_spectra(data);
                            this._populate_peptides(data);
                        }
                        return this;
                    });

MASCP.AtProteomeReaderJson.prototype.requestData = function()
{
    var self = this;
    var agi = this.agi;
    return {
        type: "POST",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'atproteome-json' 
        }
    };
};


MASCP.AtProteomeReaderJson.SERVICE_URL = 'http://fgcz-atproteome.unizh.ch/mascpv2.php';

/**
 * @class   Container class for results from the AtProteome service
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtProteomeReaderJson.Result = MASCP.AtProteomeReaderJson.Result;

/**
 * The list of tissue names that are used by AtProteome for this particular AGI
 *  @returns {[String]} Tissue names
 */
MASCP.AtProteomeReaderJson.Result.prototype.tissues = function()
{
    return this._tissues;
};

MASCP.AtProteomeReaderJson.Result.prototype = jQuery.extend(MASCP.AtProteomeReaderJson.Result.prototype,
/** @lends MASCP.AtProteomeReaderJson.Result.prototype */
{
    /** @field 
     *  @description Hash keyed by tissue name containing the number of spectra for each tissue for this AGI */
    spectra :   null,
    /** @field
     *  @description Hash keyed by tissue name containing the number of spectra for each peptide (keyed by "start-end" position) */
    peptide_counts_by_tissue : null
});

MASCP.AtProteomeReaderJson.Result.prototype._populate_spectra = function(data)
{
    this.spectra = {};
    this._tissues = [];
    if ( ! data || ! data.tissues ) {
        return;
    }
    for (var i = 0; i < data.tissues.length; i++ ) {
        this._tissues[i] = data.tissues[i].tissue;
        this.spectra[data.tissues[i].tissue] = parseInt(data.tissues[i].qty_spectra);
    }
};

MASCP.AtProteomeReaderJson.Result.prototype._populate_peptides = function(data)
{
    this.peptide_counts_by_tissue = {};
    if ( ! data || ! data.peptides ) {
        return;
    }
    for (var i = 0; i < data.peptides.length; i++ ) {
        var a_peptide = data.peptides[i];
        var peptide_position = a_peptide.position+'-'+(parseInt(a_peptide.position)+parseInt(a_peptide.sequence.length));
        for (var j = 0; j < a_peptide.tissues.length; j++ ) {
            var a_tissue = a_peptide.tissues[j];
            if (! this.peptide_counts_by_tissue[a_tissue.tissue]) {
                this.peptide_counts_by_tissue[a_tissue.tissue] = {};
            }
            this.peptide_counts_by_tissue[a_tissue.tissue][peptide_position] = parseInt(a_tissue.qty_spectra);
        }
    }
};

MASCP.AtProteomeReaderJson.Result.prototype.render = function()
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


MASCP.AtProteomeReaderJson.prototype.setupSequenceRenderer = function(sequenceRenderer)
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
                    map = new GOMap.Diagram('mature_flower_diagram.svg');
                    var map_container = jQuery('<div style="position: relative; height: 0px; width: 100%; margin-bottom: 2px; overflow: hidden;"></div>');
                    map_container.bind('load', function() {
                        map_container.css({'height': '100%','overflow':'visible'});
                    });
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

MASCP.AtProteomeReaderJson.prototype._normalise = function(array)
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

MASCP.AtProteomeReaderJson.prototype._mergeCounts = function(hash)
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


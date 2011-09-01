/**
 *  @fileOverview Classes for reading data from the AtProteome database using JSON data
 */

/**
 * @class   Service class that will retrieve AtProteome data for this entry given an AGI.
 *          Data is received in JSON format.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
 
/*
+------------+-----------------+
| poid       | pocv            |
+------------+-----------------+
| PO:0000005 | cell suspension |
| PO:0009046 | flower          |
| PO:0000056 | floral bud      |
| PO:0020030 | cotyledon       |
| PO:0006339 | juvenile leaf   |
| PO:0009010 | seed            |
| PO:0009005 | root            |
| PO:0009030 | carpel          |
| PO:0009001 | silique         |
| PO:0009006 | shoot           |
| PO:0020091 | pollen          |
| PO:0009025 | leaf            |
+------------+-----------------+
*/ 
MASCP.AtProteomeReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (data) {
                            this._populate_spectra(data);
                            this._populate_peptides(data);
                        }
                        return this;
                    });

MASCP.AtProteomeReader.prototype.requestData = function()
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


MASCP.AtProteomeReader.SERVICE_URL = 'http://fgcz-atproteome.unizh.ch/mascpv3.php';

/**
 * @class   Container class for results from the AtProteome service
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtProteomeReader.Result = MASCP.AtProteomeReader.Result;

/**
 * The list of tissue names that are used by AtProteome for this particular AGI
 *  @returns {[String]} Tissue names
 */
MASCP.AtProteomeReader.Result.prototype.tissues = function()
{
    return this._tissues;
};

MASCP.AtProteomeReader.Result.prototype.getPeptides = function()
{
    return this._peptides;
};


MASCP.AtProteomeReader.Result.prototype = MASCP.extend(MASCP.AtProteomeReader.Result.prototype,
/** @lends MASCP.AtProteomeReader.Result.prototype */
{
    /** @field 
     *  @description Hash keyed by tissue name containing the number of spectra for each tissue for this AGI */
    spectra :   null,
    /** @field
     *  @description Hash keyed by the Plant Ontology ID containing the number of spectra for each peptide (keyed by "start-end" position) */
    peptide_counts_by_tissue : null,
    /** @field
     *  @description String containing the sequence for the retrieved AGI */
    sequence : null
});

MASCP.AtProteomeReader.Result.prototype._populate_spectra = function(data)
{
    this.spectra = {};
    this._tissues = [];
    this._long_name_map = {};
    if ( ! data || ! data.tissues ) {
        return;
    }
    for (var i = 0; i < data.tissues.length; i++ ) {
        this._tissues[i] = data.tissues[i]['PO:tissue'] || {};
        this._tissues[i].long_name = data.tissues[i].tissue;
        this._long_name_map[this._tissues[i]] = data.tissues[i].tissue;
        
        this.spectra[data.tissues[i]['PO:tissue']] = parseInt(data.tissues[i].qty_spectra,10);
    }
};

MASCP.AtProteomeReader.Result.prototype._populate_peptides = function(data)
{
    this.peptide_counts_by_tissue = {};
    if ( ! data || ! data.peptides ) {
        return;
    }
        
    this.sequence = data.sequence;
    this._peptides = [];
    
    for (var i = 0; i < data.peptides.length; i++ ) {
        var a_peptide = data.peptides[i];
        this._peptides.push(a_peptide.sequence);
        var peptide_position = a_peptide.position+'-'+(parseInt(a_peptide.position,10)+parseInt(a_peptide.sequence.length,10));
        for (var j = 0; j < a_peptide.tissues.length; j++ ) {
            var a_tissue = a_peptide.tissues[j];
            if (! this.peptide_counts_by_tissue[a_tissue['PO:tissue']]) {
                this.peptide_counts_by_tissue[a_tissue['PO:tissue']] = {};
            }
            this.peptide_counts_by_tissue[a_tissue['PO:tissue']][peptide_position] = parseInt(a_tissue.qty_spectra,10);
        }
    }
};

MASCP.AtProteomeReader.Result.prototype.render = function()
{
    var params = jQuery.param(this.reader.requestData().data);
    var total = 0;
    for (var i in this.spectra) {
        if (this.spectra.hasOwnProperty(i)) {
            total += parseInt(this.spectra[i],10);
        }
    }
    var a_container = jQuery('<div>MS/MS spectra <input type="checkbox" class="group_toggle"/><a style="display: block; float: right;" href="http://fgcz-atproteome.unizh.ch/index.php?'+params+'">AtProteome</a></div>');
    jQuery(this.reader.renderers).each ( function(i){
        this.createGroupCheckbox('atproteome',jQuery('input.group_toggle',a_container));
    });
    return a_container;
};

MASCP.AtProteomeReader.prototype._rendererRunner = function(sequenceRenderer) {
    var tissues = this.result? this.result.tissues() : [];
        
    for (var tiss in tissues) {
        if (tissues.hasOwnProperty(tiss)) {        
            var tissue = tissues[tiss];
            if (this.result.spectra[tissue] < 1) {
                continue;
            }
            var peptide_counts = this.result.peptide_counts_by_tissue[tissue];

            var overlay_name = 'atproteome_by_tissue_'+tissue;
        
            // var css_block = ' .overlay { display: none; } .active .overlay { display: block; top: 0px; background: #000099; } ';
        
            var css_block = ' .overlay { display: none; } .tracks .active { fill: #000099; } .inactive { display: none; } .active .overlay { display: block; top: 0px; background: #000099; } ';
        
            MASCP.registerLayer(overlay_name,{ 'fullname' : this.result._long_name_map[tissue], 'group' : 'atproteome', 'color' : '#000099', 'css' : css_block, 'data' : { 'po' : tissue, 'count' : peptide_counts } });
                
            var positions = this._normalise(this._mergeCounts(peptide_counts));
            var index = 1;
            var last_start = null;
            while (index <= positions.length) {
                if ((typeof positions[index] === 'undefined') && (index != positions.length) && (last_start !== null)) {
                    sequenceRenderer.getAminoAcidsByPosition([last_start])[0].addBoxOverlay(overlay_name,index-1-last_start);
                    last_start = null;
                }
                if (positions[index] > 0 && last_start === null) {
                    last_start = index;
                }
                index += 1;
            }
        }
    }
};

MASCP.AtProteomeReader.prototype._groupSummary = function(sequenceRenderer)
{
    var tissues = this.result? this.result.tissues() : [];
    var positions = [];
    
    var tissue_func = function() {
        var tissues = [];
        for (var tiss in this) {
            if (this.hasOwnProperty(tiss)) {
                tissues.push(tiss);
            }
        }
        return tissues.sort().join(',');
    };
    
    for (var tiss in tissues) {
        if (tissues.hasOwnProperty(tiss)) {
            var tissue = tissues[tiss];
            if (this.result.spectra[tissue] < 1) {
                continue;
            }

            var peptide_counts = this._mergeCounts(this.result.peptide_counts_by_tissue[tissue]);

            for (var i = 0; i < peptide_counts.length; i++ ) {
                if ( peptide_counts[i] > 0 ) {
                    if (! positions[i]) {
                        positions[i] = {};
                        positions[i].tissue = tissue_func;
                    }
                    positions[i][tissue] = true;              
                }
            }
        }
    }    

    var index = 0;
    var last_start = null;
    var last_tissue = null;
    
    var overlay_name = 'atproteome_controller';

    var css_block = ' .overlay { display: none; } .tracks .active { fill: #000099; } .inactive { display: none; } .active .overlay { display: block; top: 0px; background: #000099; } ';
    
    MASCP.registerLayer(overlay_name,{ 'fullname' : 'AtProteome MS/MS', 'color' : '#000099', 'css' : css_block });


    var an_agi = this.result.agi;
    var a_locus = an_agi.replace(/\.\d/,'');

    MASCP.getLayer('atproteome_controller').href = 'http://fgcz-atproteome.unizh.ch/index.php?page=query_protein&myassembly=1%239&queryf='+a_locus;
    while (index <= positions.length) {
        if ( index <= 0 ) {
            index += 1;
            continue;
        }
        if ((! positions[index] || positions[index].tissue() != last_tissue || (index == positions.length) ) && last_start !== null) {
            var endpoint = index - last_start;
            if ( ! positions[index] ) {
                endpoint -= 1;
            }
            sequenceRenderer.getAminoAcidsByPosition([last_start])[0].addBoxOverlay(overlay_name,endpoint);
            last_start = null;
        }
        if (positions[index] && last_start === null) {
            last_tissue = positions[index].tissue();
            last_start = index;
        }
        index += 1;
    }
    
    if (sequenceRenderer.createGroupController) {
        sequenceRenderer.createGroupController('atproteome_controller','atproteome');
    }
};

MASCP.AtProteomeReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{

    var reader = this;

    this.bind('resultReceived', function() {
        MASCP.registerGroup('atproteome',{ 'fullname' : 'AtProteome data','hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#000099' });

        if ( sequenceRenderer.sequence != this.result.sequence && this.result.sequence != '' ) {
            jQuery(sequenceRenderer).bind('sequenceChange',function() {
                jQuery(sequenceRenderer).unbind('sequenceChange',arguments.callee);
                reader._groupSummary(sequenceRenderer);
                reader._rendererRunner(sequenceRenderer);
                jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);
            });
            sequenceRenderer.setSequence(this.result.sequence);
            return;
        } else {
            reader._groupSummary(sequenceRenderer);
            reader._rendererRunner(sequenceRenderer);
            jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);
        }
    });

    return this;
};

MASCP.AtProteomeReader.prototype._normalise = function(array)
{
    var max_val = 0, i = 0;
    for (i = 0; i < array.length; i++)
    {
        if (array[i] && array[i] > max_val) {
            max_val = array[i];
        }
    }
    for (i = 0; i < array.length; i++)
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
        if (hash.hasOwnProperty(position)) {        
            var ends = position.split('-');
            var start = parseInt(ends[0],10);
            var end = parseInt(ends[1],10);
            for (var i = start; i <= end; i++) {
                if ( ! counts[i] ) {
                    counts[i] = 0;
                }
                counts[i] += hash[position];
            }
        }
    }
    return counts;
};
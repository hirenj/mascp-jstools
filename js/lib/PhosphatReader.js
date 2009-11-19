/** @fileOverview   Classes for reading data from the Phosphat database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Phosphat for a given AGI.
 *              Data is transferred using the JSON format.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.PhosphatReader =  MASCP.buildService(function(data) {
                            if (data && data.request_method == 'getPredictedAa') {
                                this._raw_data = data;
                            }
                            if (data && data.request_method == 'getExperimentsModAa') {
                                this._raw_experimental_data = data;
                            }
                            return this;
                        });

MASCP.PhosphatReader.prototype.requestData = function()
{
    var data = [null,this.agi];
    
    var method = this._method ? this._method : 'getPredictedAa';

    var self = this;
    
    return {
        type: "POST",
        dataType: "json",
        data: { 'id'        : 1,
                'method'    : method,
                'params'    : data.toJSON ? data.toJSON() : JSON.stringify(data),
                'service'   : 'phosphat' 
        },
        success: function(data,status) {
            data.request_method = method;
            self._dataReceived(data,status);
            if (self.result && self.result._raw_data && self.result._raw_experimental_data) {
               jQuery(self).trigger('resultreceived'); 
            }
        }
    };
};

MASCP.PhosphatReader.prototype._single_retrieve = MASCP.PhosphatReader.prototype.retrieve;

MASCP.PhosphatReader.prototype.retrieve = function()
{
    this._single_retrieve();
    this._method = 'getExperimentsModAa';
    this._single_retrieve();
};

/**
 *  @class   Container class for results from the AtProteome service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.PhosphatReader.Result = MASCP.PhosphatReader.Result;


/** Retrieve an array of positions that phosphorylation has been predicted to occur upon
 *  @returns {Array}    Phosphorylation positions upon the full protein
 */
MASCP.PhosphatReader.Result.prototype.getAllPredictedPositions = function()
{
    var positions = []; 
    for ( var prediction_idx in this._raw_data.result ) {
        var prediction = this._raw_data.result[prediction_idx];
        if (prediction.prd_score > 0) {
            positions.push(prediction.prd_position);
        }
    }
    return positions;
};

/** Retrieve an array of positions that phosphorylation has been experimentally verified to occur upon
 *  @returns {Array}    Phosphorylation positions upon the full protein
 */
MASCP.PhosphatReader.Result.prototype.getAllExperimentalPositions = function()
{
    var exp_sites = {};
    for ( var site_idx in this._raw_experimental_data.result ) {
        var site = this._raw_experimental_data.result[site_idx];
        if (site['modificationType'] != 'phos' && site['modificationType'] != 'phos_amb') {
            continue;
        }
        var site_id = site['prot_sequence'].indexOf(site['pep_sequence']);
        if (site_id < 0) {
            continue;
        }
        site_id += site['position'];
        exp_sites[site_id] = 1;
    }
    var positions = [];
    for ( var i in exp_sites ) {
        positions.push(parseInt(i));
    }
    return positions;
};


MASCP.PhosphatReader.Result.prototype.render = function()
{
    var result_block;
    
    if (this.getAllExperimentalPositions().length > 0) {
        result_block = jQuery(' <div>Phosphorylation (STY) \
                                    <input type="checkbox" class="exp_toggle"/> <a style="display: block; float: right;" href="http://phosphat.mpimp-golm.mpg.de/app.html?agi='+this.reader.agi+'">PhosPhAt</a> \
                                </div>');
    } else if (this.getAllPredictedPositions().length > 0) {
        result_block = jQuery(' <div>Theoretical phosphorylaytion <input type="checkbox" class="theoretical_toggle"/> \
                                    <a style="display: block; float: right;" href="http://phosphat.mpimp-golm.mpg.de/app.html?agi='+this.reader.agi+'">PhosPhAt</a> \
                                </div>');
    } else {
        result_block = jQuery(' <div>No phosphorylation \
                                    <a style="display: block; float: right;" href="http://phosphat.mpimp-golm.mpg.de/app.html?agi='+this.reader.agi+'">PhosPhAt</a> \
                                </div>');
    }
    
    jQuery( this.reader.renderers ).each( function(i){
        this.createLayerCheckbox('phosphat_experimental',jQuery('input.exp_toggle',result_block)[0]);
        this.createLayerCheckbox('phosphat_theoretical',jQuery('input.theoretical_toggle',result_block)[0]);
    });
    return result_block;
};

MASCP.PhosphatReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    MASCP.SequenceRenderer.registerGroup('phosphat', {'fullname' : 'PhosPhAt data', 'hide_member_controllers' : true, 'hide_group_controller': true });
	MASCP.SequenceRenderer.registerLayer('phosphat_theoretical', { 'fullname': 'PhosPhAt theoretical data', 'group': 'phosphat', 'color' : '#3D907B', 'css' : '.active { background: #3D907B; color: #ffffff; } .tracks .active { background: #3D907B; fill: #3D907B; } .inactive { display: none; }' });
	MASCP.SequenceRenderer.registerLayer('phosphat_experimental', { 'fullname': 'PhosPhAt experimental data', 'group':'phosphat', 'color' : '#000000', 'css' : '.active { color: #000000; font-weight: bolder; } .tracks .active { background: #000000; fill: #000000; } .inactive { display: none; }' });

    this.bind('resultreceived', function() {
        jQuery(sequenceRenderer.getAminoAcidsByPosition(this.result.getAllPredictedPositions())).each(function(i) {
            MASCP.SequenceRenderer.registerGroup('phosphat', {'fullname' : 'PhosPhAt data', 'hide_member_controllers' : false });
        	MASCP.SequenceRenderer.registerLayer('phosphat_theoretical', { 'fullname': 'PhosPhAt theoretical data', 'group': 'phosphat', 'color' : '#3D907B', 'css' : '.active { background: #3D907B; color: #ffffff; } .tracks .active { background: #3D907B; fill: #3D907B; } .inactive { display: none; }' });
            this.addToLayer('phosphat_theoretical');
        });
        jQuery(sequenceRenderer.getAminoAcidsByPosition(this.result.getAllExperimentalPositions())).each(function(i) {
            MASCP.SequenceRenderer.registerGroup('phosphat', {'fullname' : 'PhosPhAt data', 'hide_member_controllers' : false });
        	MASCP.SequenceRenderer.registerLayer('phosphat_experimental', { 'fullname': 'PhosPhAt experimental data', 'group':'phosphat', 'color' : '#000000', 'css' : '.active { color: #000000; font-weight: bolder; } .tracks .active { background: #000000; fill: #000000; } .inactive { display: none; }' });
            this.addToLayer('phosphat_experimental');
        });
    })
    return this;
};
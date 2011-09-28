/**
 *  @fileOverview Classes for reading data from the PlantsP database using XML data
 */

/**
 * @class   Service class that will retrieve PlantsP data for this entry given an AGI.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
 
MASCP.PpdbReader = MASCP.buildService(function(data) {
                        if (! data ) {
                            return this;
                        }
                        var extractData = function()
                        {
                            var features = this._raw_data.getElementsByTagName('FEATURE');

                            var peptides = [];

                            var peps_by_seq = {};
                            var all_experiments = {};
                            for (var i = 0 ; i < features.length; i++ ) {
                                var type = features[i].getElementsByTagName('TYPE')[0];
                                var textcontent = type.textContent || type.text || type.nodeValue;
                                if ( textcontent == 'Peptide') {
                                    var seq = features[i].getAttribute('label');
                                    if ( ! peps_by_seq[seq] ) {
                                        peps_by_seq[seq] = { 'experiments' : [] };
                                    }
                                    var exp_id = parseInt(features[i].getElementsByTagName('GROUP')[0].getAttribute('id'),10);
                                    peps_by_seq[seq].experiments.push(exp_id);
                                    all_experiments[exp_id] = true;            
                                }
                            }
                            for (var pep in peps_by_seq) {
                                if (peps_by_seq.hasOwnProperty(pep)) {
                                    var pep_obj =  { 'sequence' : pep , 'experiments' : peps_by_seq[pep].experiments };
                                    peptides.push(pep_obj);
                                }
                            }

                            this._experiments = [];
                            for (var expid in all_experiments) {
                                if (all_experiments.hasOwnProperty(expid)) {
                                    this._experiments.push(parseInt(expid,10));
                                }
                            }

                            return peptides;
                        };
                        this._raw_data = data;
                        if (data.getElementsByTagName) {
                            var peps = extractData.call(this);
                            this._raw_data = {
                                'experiments' : this._experiments,
                                'peptides'    : peps
                            };
                        }
                        this._experiments = this._raw_data.experiments;
                        this._peptides    = this._raw_data.peptides;
                        return this;
                    });

MASCP.PpdbReader.prototype.requestData = function()
{
    var self = this;
    var agi = (this.agi+"").replace(/\..*$/,'');
    var dataType = 'json';
    if (this._endpointURL.indexOf('xml') >= 0) {
        dataType = 'xml';
    }
    return {
        type: "GET",
        dataType: dataType,
        data: { 'segment'   : agi,
                'agi'       : this.agi,
                'service'   : 'ppdb'
        }
    };
};


MASCP.PpdbReader.SERVICE_URL = 'http://ppdb.tc.cornell.edu/das/arabidopsis/features/?output=xml'; /* ?segment=locusnumber */

/**
 * @class   Container class for results from the Ppdb service
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.PpdbReader.Result = MASCP.PpdbReader.Result;

MASCP.PpdbReader.Result.prototype = MASCP.extend(MASCP.PpdbReader.Result.prototype,
/** @lends MASCP.PpdbReader.Result.prototype */
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

MASCP.PpdbReader.Result.prototype.render = function()
{
    return null;
};

MASCP.PpdbReader.Result.prototype.getExperiments = function()
{
    return this._experiments || [];
};

MASCP.PpdbReader.Result.prototype.getPeptides = function()
{
    var peps = this._peptides || [];
    peps.forEach(function(pep_obj) {
        pep_obj.toString = function(p) {
            return function() {
                return p.sequence;
            };
        }(pep_obj);
    });
    return peps;
};


MASCP.PpdbReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    
    this.bind('resultReceived', function() {
        
//        
        MASCP.registerGroup('ppdb', {'fullname' : 'PPDB spectra data', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#aa9900' });

        var overlay_name = 'ppdb_controller';

        var css_block = '.active .overlay { background: #aa9900; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';

        MASCP.registerLayer(overlay_name,{ 'fullname' : 'PPDB MS/MS', 'color' : '#aa9900', 'css' : css_block });

        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('ppdb_controller','ppdb');
        }
        
        var peps = this.result.getPeptides();
        var experiments = this.result.getExperiments();
        for(var i = 0; i < experiments.length; i++) {
            var layer_name = 'ppdb_experiment'+experiments[i];
            MASCP.registerLayer(layer_name, { 'fullname': 'Experiment '+experiments[i], 'group' : 'ppdb', 'color' : '#aa9900', 'css' : css_block });
            MASCP.getLayer(layer_name).href = 'http://ppdb.tc.cornell.edu/dbsearch/searchsample.aspx?exprid='+experiments[i];
            for (var j = 0 ; j < peps.length; j++) {
                var peptide = peps[j];
                if (peps[j].experiments.indexOf(experiments[i]) < 0) {
                    continue;
                }
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide.sequence);
                peptide_bits.addToLayer(layer_name);
                peptide_bits.addToLayer(overlay_name);
            }
        }
        jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);        



    });
    return this;
};

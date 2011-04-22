/** @fileOverview   Classes for reading domains from Interpro 
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Interpro for a given AGI.
 *              Data is transferred using XML.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.InterproReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.InterproReader.SERVICE_URL = 'http://gator.masc-proteomics.org/interpro.pl';

MASCP.InterproReader.prototype.requestData = function()
{    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : this.agi,
                'service'   : 'interpro' 
        }
    };
};

/* We need to ensure that the sequence is populated before the retrieve */

(function() {
var old_retrieve = MASCP.InterproReader.prototype.retrieve;
MASCP.InterproReader.prototype.retrieve = function(agi,func) {
    var self = this;
    if ( ! this.agi ) {
        this.agi = agi;
    }
    var self_func = arguments.callee;
    var old_args = arguments;
    if ( ! this.sequence ) {
        (new MASCP.TairReader(self.agi)).bind('resultReceived',function() {
            self.sequence = this.result.getSequence();
            self_func.apply(self,old_args);
        }).retrieve();
        return this;
    }
    old_retrieve.apply(self,arguments);
    return this;
}
})();

/**
 *  @class   Container class for results from the Interpro service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.InterproReader.Result = MASCP.InterproReader.Result;


/** Retrieve the peptides for this particular entry from the Interpro service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.InterproReader.Result.prototype.getDomains = function()
{
    var content = null;
    
    if (! this._raw_data || this._raw_data.length == 0 ) {
        return [];
    }    
    
    if (this._peptides_by_domain) {
        return this._peptides_by_domain;
    }
    
    var peptides_by_domain = {};
    var domain_descriptions = {};
    
    for (var i = 0; i < this._raw_data.length; i++ ) {
        var peptides = peptides_by_domain[this._raw_data[i].interpro] || [];
        peptides.push(this.reader.sequence.substring(this._raw_data[i].start, this._raw_data[i].end));
        domain_descriptions[this._raw_data[i].interpro] = this._raw_data[i].description;
        peptides_by_domain[this._raw_data[i].interpro] = peptides;
    }
    
    this._peptides_by_domain = peptides_by_domain;
    return peptides_by_domain;
};

MASCP.InterproReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    MASCP.registerGroup('interpro_domains', {'fullname' : 'Interpro domains', 'color' : '#000000' });

    var overlay_name = 'interpro_controller';

    var css_block = '.active .overlay { background: #000000; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    MASCP.registerLayer(overlay_name,{ 'fullname' : 'Interpro domains', 'color' : '#000000', 'css' : css_block });

    this.bind('resultReceived', function() {
        var agi = this.agi;
        
        MASCP.getLayer('interpro_controller').href = '';
        
        var domains = this.result.getDomains();
        for(domain in domains) {
            var lay = MASCP.registerLayer('interpro_domain_'+domain, { 'fullname': domain, 'group' : 'interpro_domains', 'color' : '#000000', 'css' : css_block });
            lay.href = "http://www.ebi.ac.uk/interpro/IEntry?ac="+domain;
            var peptides = domains[domain];
            for(var i = 0; i < peptides.length; i++ ) {
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptides[i]);
                var layer_name = 'interpro_domain_'+domain;
                peptide_bits.addToLayer(layer_name);
                peptide_bits.addToLayer(overlay_name);
            }
        }
        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('interpro_controller','interpro_domains');
        }

        jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);        

    })
    return this;
};

MASCP.InterproReader.Result.prototype.render = function()
{
};
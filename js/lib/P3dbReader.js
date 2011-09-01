/** @fileOverview   Classes for reading data from the P3db database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from P3DB for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.P3dbReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.P3dbReader.SERVICE_URL = 'http://p3db.org/gator.php';

MASCP.P3dbReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi.toLowerCase(),
                'service'   : 'p3db' 
        }
    };
};


/**
 *  @class   Container class for results from the P3DB service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.P3dbReader.Result = MASCP.P3dbReader.Result;

/** Retrieve the peptides for this particular entry from the P3db service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.P3dbReader.Result.prototype.getPeptides = function()
{
    if (this._peptides) {
        return this._peptides;
    }

    this._long_name_map = {};
    
    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }

        
    var peptides = [];
    
    for (var i = 0; i < this._raw_data.peptides.length; i++ ) {
        var a_peptide = this._raw_data.peptides[i];
        var the_pep = { 'sequence' : this._cleanSequence(a_peptide) };
        peptides.push(the_pep);
    }
    this._peptides = peptides;
    return peptides;
};

MASCP.P3dbReader.Result.prototype.getOrthologousPeptides = function(organism)
{
    var self = this;
    if ( ! this._raw_data.orthologs) {
        return [];
    }
    var peptides = [];
    this._raw_data.orthologs.forEach(function(orth) {
        if (orth.organism === organism && orth.peptides) {
            for (var i = 0; i < orth.peptides.length; i++ ) {
                var a_peptide = orth.peptides[i];
                var the_pep = { 'sequence' : self._cleanSequence(a_peptide) };
                peptides.push(the_pep);
            }
        }
    });
    return peptides;
};

MASCP.P3dbReader.Result.prototype.getOrganisms = function()
{
    var self = this;
    if ( ! this._raw_data.orthologs) {
        return [];
    }
    var organisms = [];
    this._raw_data.orthologs.forEach(function(orth) {
        organisms.push({ 'id' : orth.organism, 'name' : orth.name });
    });
    return organisms;
};


MASCP.P3dbReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.P3dbReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;

    var color = '#5533ff';
    
    MASCP.registerGroup('p3db_experimental', {'fullname' : 'P3DB MS/MS', 'color' : color });

    this.bind('resultReceived', function() {
        var peps = this.result.getPeptides();
        if (peps.length > 0) {
            MASCP.registerLayer('p3db_controller',{ 'fullname' : 'P3DB MS/MS', 'color' : color });
        }
        for(var i = 0; i < peps.length; i++) {
            var peptide = peps[i].sequence;
            var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
            peptide_bits.addToLayer('p3db_controller');
        }
        this.result.getOrganisms().forEach(function(organism) {
            if (organism.id === 3702) {
                return;
            }
            var layer_name = 'p3db_tax_'+organism.id;
            var peps = this.result.getOrthologousPeptides(organism.id);
            if (peps.length > 0) {
                MASCP.registerLayer(layer_name,{ 'fullname' : organism.name, 'group' : 'p3db_experimental', 'color' : color });
            }
            for(var i = 0; i < peps.length; i++) {
                var peptide = peps[i].sequence;
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
                peptide_bits.addToLayer(layer_name);
            }
        });
        
        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('p3db_controller','p3db_experimental');
        }        
        
        jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);
    });
    return this;
};

MASCP.P3dbReader.Result.prototype.render = function()
{
    if (this.getPeptides().length > 0) {
        var a_container = jQuery('<div>MS/MS spectra <input class="group_toggle" type="checkbox"/>P3db</div>');
        jQuery(this.reader.renderers).each(function(i){
            this.createGroupCheckbox('P3db_experimental',jQuery('input.group_toggle',a_container));
        });
        return a_container;
    } else {
        return null;
    }
};
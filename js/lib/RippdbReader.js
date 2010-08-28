/** @fileOverview   Classes for reading data from the Rippdb database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Rippdb for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.RippdbReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.RippdbReader.SERVICE_URL = 'http://jbei-exwebapp.lbl.gov/maschup/rippdb.pl';

MASCP.RippdbReader.prototype.requestData = function()
{
    var agi = this.agi;
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'rippdb' 
        }
    };
};

/**
 *  @class   Container class for results from the Rippdb service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.RippdbReader.Result = MASCP.RippdbReader.Result;

/** Retrieve the peptides for this particular entry from the Rippdb service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.RippdbReader.Result.prototype.getSpectra = function()
{
    var content = null;

    if (this._spectra) {
        return this._spectra;
    }

    if (! this._raw_data || ! this._raw_data.spectra ) {
        return [];
    }


    this._spectra = this._raw_data.spectra;
    
    return this._spectra;
};

MASCP.RippdbReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.RippdbReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    MASCP.registerGroup('prippdb_peptides', {'fullname' : 'Phosphorylation Rippdb', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#666666' });

    var overlay_name = 'prippdb_experimental';

    var css_block = '.active .overlay { background: #666666; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    MASCP.registerLayer(overlay_name,{ 'fullname' : 'Phosphorylation Rippdb', 'color' : '#666666', 'css' : css_block });

    if (sequenceRenderer.createGroupController) {
        sequenceRenderer.createGroupController('prippdb_experimental','prippdb_peptides');
    }

    this.bind('resultReceived', function() {
                
        var specs = this.result.getSpectra();
        for (var j = 0; j < specs.length; j++ ) {
            var spec = specs[j];
            MASCP.registerLayer('rippdb_spectrum_'+spec.spectrum_id, { 'fullname': 'Spectrum '+spec.spectrum_id, 'group' : 'prippdb_peptides', 'color' : '#666666', 'css' : css_block });
            
            var peps = spec.peptides;
            for(var i = 0; i < peps.length; i++) {
                var peptide = peps[i].sequence;
                var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
                
                for (var k = 0; k < peps[i].positions.length; k++ ) {
                    peptide_bits[peps[i].positions[k] - 1].addToLayer('prippdb_experimental');
                }
                
                var layer_name = 'rippdb_spectrum_'+spec.spectrum_id;
                peptide_bits[0].addBoxOverlay(layer_name,1,peptide_bits.length);
            }
        }
        jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);
    })
    return this;
};

MASCP.RippdbReader.Result.prototype.render = function()
{
    if (this.getPeptides().length > 0) {
        var a_container = jQuery('<div>MS/MS spectra <input class="group_toggle" type="checkbox"/>Rippdb</div>');
        jQuery(this.reader.renderers).each(function(i){
            this.createGroupCheckbox('prippdb_experimental',jQuery('input.group_toggle',a_container));
        });
        return a_container;
    } else {
        return null;
    }
};
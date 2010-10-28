/** @fileOverview   Classes for reading data from the Promex database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Promex for a given AGI.
 *              Data is transferred using XML.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.PromexReader = MASCP.buildService(function(data) {
                        this._raw_data = data;                        
                        return this;
                    });

MASCP.PromexReader.SERVICE_URL = 'http://131.130.57.242/json/';

MASCP.PromexReader.prototype.requestData = function()
{
    var agi = (this.agi+"").replace(/\..*$/,'');
    
    return {
        type: "GET",
        dataType: "json",
        data: { 'ac'        : agi,
                'service'   : 'promex' 
        }
    };
};

/**
 *  @class   Container class for results from the Promex service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.PromexReader.Result = MASCP.PromexReader.Result;

/* Retrieve the URLS for the spectra from the Promex service
 *  @returns    Array of urls for the spectra for this entry
 *  @type [String]
MASCP.PromexReader.Result.prototype.getSpectraURLs = function()
{
    var bleh = this._raw_data;
    var content = null;
    if (this._raw_data.getElementById) {
        content = this._raw_data.getElementById('contentArea');
    } else {
        content = this._raw_data.selectSingleNode("//*[@id = 'contentArea']");
    }
    if ( ! content ) {
        return [];
    }
    var imgs = content.getElementsByTagName('img');
    var urls  = [];
    for (var i = 0; i < imgs.length; i++) {
        urls.push(imgs[i].getAttribute('src'));
    }
    return urls;
};
*/

/** Retrieve the peptides for this particular entry from the Promex service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.PromexReader.Result.prototype.getPeptides = function()
{
    var content = null;
    
    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }    
    var peptides = [];
    for (var i = 0; i < this._raw_data.peptides.length; i++ ) {
        peptides.push(this._cleanSequence(this._raw_data.peptides[i].sequence));
    }
    return peptides;
};

MASCP.PromexReader.Result.prototype._cleanSequence = function(sequence)
{
    return sequence.replace(/[^A-Z]/g,'');
};

MASCP.PromexReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;
    MASCP.registerGroup('promex_experimental', {'fullname' : 'ProMex spectra data', 'hide_member_controllers' : true, 'hide_group_controller' : true, 'color' : '#ff9900' });

    var overlay_name = 'promex_controller';

    var css_block = '.active .overlay { background: #ff9900; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    
    MASCP.registerLayer(overlay_name,{ 'fullname' : 'ProMEX MS/MS', 'color' : '#ff9900', 'css' : css_block });


    this.bind('resultReceived', function() {
        var agi = (this.result.agi+"").replace(/\..*$/,'');
        
        MASCP.getLayer('promex_controller').href = 'http://promex.pph.univie.ac.at/promex/index.php?subjob=Submit&subtext='+agi;
        
        // var css_block = '.active { background: #ff9900; color: #ffffff;} :indeterminate { background: #ff0000; } .active a:hover { background: transparent !important; } .inactive { }';
        var peps = this.result.getPeptides();
        for(var i = 0; i < peps.length; i++) {
            MASCP.registerLayer('promex_experimental_spectrum_'+i, { 'fullname': 'Spectrum', 'group' : 'promex_experimental', 'color' : '#ff9900', 'css' : css_block });
            var peptide = peps[i];
            var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
            if ( ! peptide_bits || peptide_bits.length == 0 ) {
                continue;
            }
            var layer_name = 'promex_experimental_spectrum_'+i;
            peptide_bits.addToLayer(layer_name);
            peptide_bits.addToLayer(overlay_name);
            // jQuery(MASCP.getLayer('promex_experimental_spectrum_'+i)).bind('click',function() {
            //     window.open(a_spectra);
            // });
        }
        jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);        

        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('promex_controller','promex_experimental');
        }


    })
    return this;
};

MASCP.PromexReader.Result.prototype.render = function()
{
    if (this.getPeptides().length > 0) {
        var a_container = jQuery('<div>MS/MS spectra <input class="group_toggle" type="checkbox"/><a style="display: block; float: right;" href="http://www.promexdb.org/">ProMEX</a></div>');
        jQuery(this.reader.renderers).each(function(i){
            this.createGroupCheckbox('promex_experimental',jQuery('input.group_toggle',a_container));
        });
        return a_container;
    } else {
        return null;
    }
};
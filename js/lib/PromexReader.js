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

MASCP.PromexReader.prototype.requestData = function()
{
    var agi = (this.agi+"").replace(/\..*$/,'');
    
    return {
        type: "POST",
        dataType: "xml",
        data: { 'action'    : 11,
                'txt_query' : agi,
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

/** Retrieve the URLS for the spectra from the Promex service
 *  @returns    Array of urls for the spectra for this entry
 *  @type [String]
 */
MASCP.PromexReader.Result.prototype.getSpectraURLs = function()
{
    var bleh = this._raw_data;
    var content = null;
    if (this._raw_data.getElementById) {
        content = this._raw_data.getElementById('contentArea');
    } else {
        content = this._raw_data.selectSingleNode("//*[@id = 'contentArea']");
    }
    var imgs = content.getElementsByTagName('img');
    var urls  = [];
    for (var i = 0; i < imgs.length; i++) {
        urls.push(imgs[i].getAttribute('src'));
    }
    return urls;
};


/** Retrieve the peptides for this particular entry from the Promex service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.PromexReader.Result.prototype.getPeptides = function()
{
    var content = null;
    
    if (this._raw_data.getElementById) {
        content = this._raw_data.getElementById('contentArea');
    } else {
        content = this._raw_data.selectSingleNode("//*[@id = 'contentArea']");
    }
    var tds = jQuery(content.getElementsByTagName('td'));
    var peptides = [];
    var result = this;
    tds.each(function(i) {
        if (jQuery(this).text() == 'peptide sequence') {
            peptides.push(result._cleanSequence(jQuery(tds[i+1]).text()));            
        }
    });
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

    this.bind('resultReceived', function() {
        var spectra = this.result.getSpectraURLs();
        // var css_block = '.active { background: #ff9900; color: #ffffff;} :indeterminate { background: #ff0000; } .active a:hover { background: transparent !important; } .inactive { }';
        var css_block = '.active .overlay { background: #ff9900; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';
    	jQuery(this.result.getPeptides()).each(function(i) {
            
        	MASCP.registerLayer('promex_experimental_spectrum_'+i, { 'fullname': 'ProMex spectrum', 'group' : 'promex_experimental', 'color' : '#ff9900', 'css' : css_block });
    	    var a_spectra = spectra[i];
    	    var peptide = this;
    	    var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
    	    var layer_name = 'promex_experimental_spectrum_'+i;
    	    peptide_bits[0].addToLayerWithLink(layer_name,a_spectra,peptide_bits.length);
    	    jQuery(MASCP.getLayer('promex_experimental_spectrum_'+i)).bind('click',function() {
    	        window.open(a_spectra);
    	    });
    	});
    	jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);        
    })
    return this;
};

MASCP.PromexReader.Result.prototype.render = function()
{
    if (this.getSpectraURLs().length > 0) {
        var params = jQuery.param(this.reader.requestData()['data']);
        var a_container = jQuery('<div>MS/MS spectra <input class="group_toggle" type="checkbox"/><a style="display: block; float: right;" href="http://www.promexdb.org/cgi-bin/peplib.pl?'+params+'">ProMEX</a></div>');
        jQuery(this.reader.renderers).each(function(i){
            this.createGroupCheckbox('promex_experimental',jQuery('input.group_toggle',a_container));
        });
        return a_container;
    } else {
        return null;
    }
};
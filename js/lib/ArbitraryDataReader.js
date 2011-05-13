/** @fileOverview   Classes for reading data from the ArbitraryData database
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from ArbitraryData for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ArbitraryDataReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.ArbitraryDataReader.SERVICE_URL = 'http://gator.masc-proteomics.org/datasets.pl';

MASCP.ArbitraryDataReader.prototype.requestData = function()
{
    var agi = this.agi;
    var dataset = this._dataset();
    if (dataset) {
        return {
            type: "GET",
            dataType: "json",
            data: { 'agi'       : agi,
                    'dataset'   : dataset,
                    'service'   : 'ArbitraryData' 
            }
        };
    } else {
        return {
            type: "GET",
            dataType: "json",
            data: {'service' : 'ArbitraryData'},
        }
    }
};

MASCP.ArbitraryDataReader.prototype._extend = function(setName)
{
    if(this == null || typeof(this) != 'object')
        return this;

    var temp = new MASCP.ArbitraryDataReader(); // changed

    temp._endpointURL = this._endpointURL;
    temp.agi = this.agi;
    
    temp.toString = function() {
        return setName+"Reader";
    };
    
    temp._dataset = function() {
        return setName;
    }
    temp.layer = function() {
        return "arbitrary_"+setName;
    }
    
    return temp;
}

MASCP.ArbitraryDataReader.prototype._dataset = function()
{
    return null;
};

MASCP.ArbitraryDataReader.prototype.retrieve = function(in_agi,cback)
{
    var self = this;
    var agi = this.agi || in_agi;
    
    if (agi && this._dataset()) {
        MASCP.Service.prototype.retrieve.call(self,in_agi,cback);
        return;        
    }
    
    if ((! this._SERVER_DATASETS) && agi) {
        var read = new MASCP.ArbitraryDataReader("",self._endpointURL);
        read.bind("resultReceived",function() {
            self._SERVER_DATASETS = this.result._raw_data;
            self.retrieve(in_agi,cback);
        });
        read.retrieve();
        return;
    }
    if ( ! this._SERVER_DATASETS ) {
        MASCP.Service.prototype.retrieve.call(self,in_agi,cback);
        return;
    }
    this._SERVER_DATASETS.forEach(function(set) {
        var reader = self._extend(set);
        (self.renderers || []).forEach(function(rrend) {
            reader.setupSequenceRenderer(rrend);
        });
        reader.retrieve(agi,cback);
    });
};

/**
 *  @class   Container class for results from the ArbitraryData service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.ArbitraryDataReader.Result = MASCP.ArbitraryDataReader.Result;

/** Retrieve the peptides for this particular entry from the ArbitraryData service
 *  @returns Array of peptide strings
 *  @type [String]
 */
MASCP.ArbitraryDataReader.Result.prototype.getPeptides = function()
{
    var content = null;

    if (this._peptides) {
        return this._peptides;
    }

    if (! this._raw_data || ! this._raw_data.peptides ) {
        return [];
    }

        
    var peptides = [];
    
    return this._raw_data.peptides;
};

MASCP.ArbitraryDataReader.prototype.setupSequenceRenderer = function(sequenceRenderer)
{
    var reader = this;


    if (! this._dataset()) {
        return;
    }

    var css_block = '.active .overlay { background: #ff5533; } .active a { color: #000000; text-decoration: none !important; }  :indeterminate { background: #ff0000; } .tracks .active { background: #0000ff; } .inactive a { text-decoration: none; } .inactive { display: none; }';


    this.bind('resultReceived', function() {
                
        var peps = this.result.getPeptides();
        if (peps.length <= 0) {
            return;
        }
        MASCP.registerGroup('arbitrary_datasets', {'fullname' : 'Misc data', 'color' : '#ff5533' });
        MASCP.registerLayer('arbitrary_controller',{ 'fullname' : 'Misc data', 'color' : '#ff5533', 'css' : css_block });

        var overlay_name = this.layer();
        MASCP.registerLayer(overlay_name,{ 'group' : 'arbitrary_datasets', 'fullname' : this._dataset(), 'color' : '#ff5533', 'css' : css_block });
        
        for(var i = 0; i < peps.length; i++) {
            var peptide = peps[i];
            var peptide_bits = sequenceRenderer.getAminoAcidsByPeptide(peptide);
            peptide_bits.addToLayer(overlay_name);
        }
        
        if (sequenceRenderer.createGroupController) {
            sequenceRenderer.createGroupController('arbitrary_controller','arbitrary_datasets');
        }
        
        jQuery(sequenceRenderer).trigger('resultsRendered',[reader]);
    })
    return this;
};

MASCP.ArbitraryDataReader.Result.prototype.render = function()
{
};
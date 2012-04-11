/**
 * @fileOverview    Classes for reading data from Uniprot database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve data from Uniprot for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UniprotReader = MASCP.buildService(function(data) {
                        this._data = data || {};
                        if ( ! this._data.data ) {
                            this._data = { 'data' : ['',''] };
                        }
                        return this;
                    });

MASCP.UniprotReader.SERVICE_URL = 'http://gator.masc-proteomics.org/uniprot.pl?';

MASCP.UniprotReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "json",
        data: { 'acc'   : this.agi,
                'service' : 'uniprot' 
        }
    };
};

MASCP.UniprotReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.UniprotReader.Result.prototype.getSequence = function() {
    return this._data.data[0];
};

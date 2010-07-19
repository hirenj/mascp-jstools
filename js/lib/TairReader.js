/**
 * @fileOverview    Classes for reading data from TAIR database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve data from TAIR for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.TairReader = MASCP.buildService(function(data) {
                        this._data = data || { 'data' : ['',''] };
                        return this;
                    });

MASCP.TairReader.SERVICE_URL = 'http://jbei-exwebapp.lbl.gov/maschup/tair.pl';

MASCP.TairReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "POST",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'service' : 'tair' 
        }
    };
};

MASCP.TairReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.TairReader.Result.prototype.getSequence = function() {
    return this._data.data[2];
};
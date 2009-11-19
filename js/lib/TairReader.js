/**
 * @fileOverview    Classes for reading data from TAIR database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}


/** Default class constructor
 *  @class      Service class that will retrieve data from TAIR for a given AGI.
 *              Data is transferred using XML.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.TairReader = MASCP.buildService(function(data) {
                        this._data = data;
                        return this;
                    });

MASCP.TairReader.prototype.requestData = function()
{
    return {
        type: "POST",
        dataType: "xml",
        data: { 'name'  : this.agi,
                'type'  : 'aa_sequence',
                'service' : 'tair' 
        }
    };
};


MASCP.TairReader.Result.prototype.getSequence = function() {
	var inputs = this._data.getElementsByTagName('input');
	for (var i = 0; i < inputs.length; i++ ) {
		if (inputs[i].name == 'sequence') {
			return inputs[i].value;
		}
	}
	return '';
};
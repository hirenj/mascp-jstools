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
    var self = this;
    if ( ! this._description ) {
        return {
            type: "POST",
            dataType: "xml",
            data: { 'name'  : this.agi,
                    'type'  : 'gene',
                    'service' : 'tair'
                  },
              success: function(data,status) {
                  self._description = self._getDescription(data);
                  self.retrieve();
              },
              error: function(resp,req,settings) {
                  console.log(resp);
                  console.log("Errred");
              }
        };
    };
    
    return {
        type: "POST",
        dataType: "xml",
        data: { 'name'  : this.agi,
                'type'  : 'aa_sequence',
                'service' : 'tair' 
        }
    };
};

MASCP.TairReader.prototype._getDescription = function(data)
{
    var rows = data.getElementsByTagName('tr');
    for (var i = 0; i < rows.length; i++ ) {
        if ( ! rows[i].getElementsByTagName('th').length > 0 ) {
            continue;
        }
        if (rows[i].getElementsByTagName('th')[0].textContent == 'Description') {
            return rows[i].getElementsByTagName('td')[1].textContent;
        }
    }
    
};

MASCP.TairReader.Result.prototype.getDescription = function() {
    return this.reader._description;
};

MASCP.TairReader.Result.prototype.getSequence = function() {
	var inputs = this._data.getElementsByTagName('input');
	for (var i = 0; i < inputs.length; i++ ) {
		if (inputs[i].getAttribute('name') == 'sequence') {
			return inputs[i].getAttribute('value');
		}
	}
	return null;
};
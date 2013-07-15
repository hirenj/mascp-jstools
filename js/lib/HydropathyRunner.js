/** @fileOverview   Classes for reading data from PRIDE */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.HydropathyRunner = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.HydropathyRunner.prototype.retrieve = function()
{
    bean.fire(this,'resultReceived');
};

MASCP.HydropathyRunner.prototype.setupSequenceRenderer = function(renderer,options) {
    this.bind('resultReceived',function() {
        var windowSize = 5;
        options = options || {};
        var kd = { 'A': 1.8,'R':-4.5,'N':-3.5,'D':-3.5,'C': 2.5,
               'Q':-3.5,'E':-3.5,'G':-0.4,'H':-3.2,'I': 4.5,
               'L': 3.8,'K':-3.9,'M': 1.9,'F': 2.8,'P':-1.6,
               'S':-0.8,'T':-0.7,'W':-0.9,'Y':-1.3,'V': 4.2 };
        var values = [];
        for (var i = 0; i < windowSize; i++) {
            values[i] = 0;
        }
        for (var i = windowSize; i < (renderer._sequence_els.length - windowSize); i++ ) {
            var value = 0;
            for (var j = -1*windowSize; j <= windowSize; j++) {
                value += kd[renderer._sequence_els[i+j].amino_acid[0]] / (windowSize * 2 + 1);
            }
            values.push(value);
        }
        if ( ! options.track ) {
            MASCP.registerLayer('hydropathy',{ 'fullname' : 'Hydropathy plot', 'color' : '#f00' });
        }
        renderer.addValuesToLayer(options.track || 'hydropathy',values,options);
        renderer.trigger('resultsRendered',[this]);
    });
};



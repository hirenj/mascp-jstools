/** @fileOverview   Classes for reading data from the Cdd tool
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Cdd for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UnionDomainReader = MASCP.buildService(function(data) {
    if (data) {
        if ( ! this._raw_data ) {
            this._raw_data = {'data' : {}};
        }
        for (var key in data.data) {
            this._raw_data.data[key] = data.data[key];
        }
    }
    return this;
});

MASCP.UnionDomainReader.prototype.requestData = function() {
    var self = this;
    var uprot = new MASCP.UniprotDomainReader();
    var cdd = new MASCP.CddRunner();
    var uprot_result;
    var cdd_result;
    cdd.bind('running',function() {
        bean.fire(self,'running');
    });
    var check_result = function(err) {
        if (err) {
            bean.fire(self,"error",[err]);
            bean.fire(MASCP.Service,'requestComplete');
            self.requestComplete();
            check_result = function() {};
            return;
        }
        if (uprot_result && cdd_result) {
            self._dataReceived(uprot_result);
            self._dataReceived(cdd_result);
            self.gotResult();
            self.requestComplete();
        }
    };
    uprot.retrieve(this.agi,function(err) {
        if ( ! err ) {
            uprot_result = this.result._raw_data;
        }
        check_result(err);
    });
    cdd.retrieve(this.agi,function(err) {
        if ( ! err ) {
            cdd_result = this.result._raw_data;
        }
        check_result(err);
    });
    return;
};

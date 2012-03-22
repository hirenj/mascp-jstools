/** @fileOverview   Classes for reading data from the Clustal tool
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ClustalRunner = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (data && typeof data == 'string') {
                            this._raw_data = { 'data' : { 'sequences' : this.getSequences() } };
                        }
                        return this;
                    });

MASCP.ClustalRunner.SERVICE_URL = 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/run/';

MASCP.ClustalRunner.hash = function(str){
    var hash = 0;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = char + (hash << 6) + (hash << 16) - hash;
    }
    return hash;
};

MASCP.ClustalRunner.prototype.requestData = function()
{   
    var sequences = [].concat(this.sequences || []);
    this.agi = MASCP.ClustalRunner.hash(this.sequences.join(','))+'';
    if (this.job_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/status/'+this.job_id
        };
    }
    if (this.result_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/result/'+this.result_id+'/aln-clustalw'
        };        
    }
    
    for (var i = 0; i < sequences.length; i++ ) {
        sequences[i] = ">seq"+i+"\n"+sequences[i];
    }
    return {
        type: "POST",
        dataType: "txt",
        data: { 'sequence' : escape(sequences.join("\n")+"\n"),
                'email'    : 'joshi%40sund.ku.dk'
        }
    };
};

(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        if (data === null) {
            return defaultDataReceived.call(this,null,status);
        }
        if (typeof data == "object") {
            return defaultDataReceived.call(this,data,status);
        }
        
        if (typeof data == "string" && data.match(/^clustalw/)) {
            this.job_id = data;
            this.retrieve(this.agi);
            return;
        }
        if (data.match(/FINISHED/)) {
            this.result_id = this.job_id;
            this.job_id = null;
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },500);
            return;
        }
        if (data.match(/RUNNING/)) {
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },500);
            return;
        }
        
        return defaultDataReceived.call(this,data,status);
    };
    
})(MASCP.ClustalRunner);

MASCP.ClustalRunner.Result.prototype.getSequences = function() {
    
    var bits = this._raw_data.match(/seq\d+(.*)/g);
    var results = [];
    for (var i = 0; i < bits.length; i++) {
        var seqbits = bits[i].match(/seq(\d+)\s+(.*)/);
        if (! results[seqbits[1]]) {
            results[seqbits[1]] = '';
        }
        results[seqbits[1]] += seqbits[2];
    }
    return results;
};

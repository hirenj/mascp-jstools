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
                            this._raw_data = { 'data' : { 'sequences' : this.getSequences(), 'alignment' : this.getAlignment() } };
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
    if (! MASCP.ClustalRunner.SERVICE_URL.match(/ebi/)) {
        return {
            type: "POST",
            dataType: "json",
            data : {
                'sequences' : sequences.join(",")
            }
        };
    }
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

(function() {
var normalise_insertions = function(inserts) {
    var pos;
    var positions = [];
    var result_data = {};
    for (pos in inserts) {
        if (inserts.hasOwnProperty(pos) && parseInt(pos) >= 0) {
            positions.push(parseInt(pos));
        }
    }
    positions = positions.sort(function sortfunction(a, b){
        return (a - b);
    });
    
    // From highest to lowest position, loop through and 
    // subtract the lengths of previous subtratctions from
    // the final position value.

    for (var i = positions.length - 1; i >= 0; i--) {
        var j = i - 1;
        pos = parseInt(positions[i]);
        var value = inserts[pos];
        while (j >= 0) {
            pos -= inserts[positions[j]].length;
            j--;
        }
        if (! value.match(/^\s+$/)) {
            result_data[pos+1] = value + (result_data[pos+1] || '');
        }
    }
    delete result_data[0];
    return result_data;
};

var splice_char = function(seqs,index,insertions) {
    for (var i = 0; i < seqs.length; i++) {
        var seq = seqs[i];
        if (seq.charAt(index) != '-') {
            if ( ! insertions[i] ) {
                insertions[i] = {};
                insertions[i][-1] = '';
            }
            insertions[i][index - 1] = seq.charAt(index);
            if (insertions[i][index] && insertions[i][index].match(/\w/)) {
                insertions[i][index-1] += insertions[i][index];
                delete insertions[i][index];
            }
        } else {
            if ( insertions[i] ) {
                insertions[i][index - 1] = ' ';
                if ((insertions[i][index] || '').match(/^\s+$/)) {
                    insertions[i][index-1] += insertions[i][index];
                    delete insertions[i][index];
                }
            }
        }
        seqs[i] = seq.slice(0,index) + seq.slice(index+1);
    }
}

MASCP.ClustalRunner.Result.prototype.alignToSequence = function(seq_index) {
    var seqs = this._raw_data.data.sequences.concat([this._raw_data.data.alignment]);
    var insertions = [];
    var aligning_seq = seqs[seq_index], i = aligning_seq.length - 1;
    for (i; i >= 0; i--) {
        if (aligning_seq.charAt(i) == '-') {
            splice_char(seqs,i,insertions);
        }
    }
    for (i = 0; i < seqs.length; i++) {
        if (insertions[i] && i != seq_index) {
            insertions[i] = normalise_insertions(insertions[i]);
            var seq = seqs[i];
            seqs[i] = { 'sequence' : seq, 'insertions' : insertions[i] };
            seqs[i].toString = function() {
                return this.sequence;
            };
        }
    }
    this._raw_data.data.alignment = seqs.pop();
    this._raw_data.data.sequences = seqs;
};

})();

MASCP.ClustalRunner.Result.prototype.getSequences = function() {
    if (this._raw_data && this._raw_data.data && this._raw_data.data.sequences) {
        return [].concat(this._raw_data.data.sequences);
    }
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

MASCP.ClustalRunner.Result.prototype.getAlignment = function() {
    if (this._raw_data && this._raw_data.data && this._raw_data.data.alignment) {
        return this._raw_data.data.alignment.toString();
    }
    this._text_data = this._raw_data;
    var re = / {16}(.*)/g;
    var result = "";
    var match = re.exec(this._raw_data);
    while (match !== null) {
        result += match[1];
        match = re.exec(this._raw_data);
    }

    return result;
};

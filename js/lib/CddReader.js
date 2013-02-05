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

(function() {
    var read_csv = function(text_data) {
            var lines = text_data.split("\n");
            var data = [];
            for (var i = lines.length - 1; i >= 0; i-- ) {
                data.push(lines[i].replace(/"/g,'').split(/\t/));
            }
            return data.reverse();
    };

    MASCP.CddRunner = MASCP.buildService(function(data) {
                            this._raw_data = data;
                            if (data && typeof data == 'string') {
                                var self = this;
                                var rows = read_csv(data);
                                rows.shift();
                                self._raw_data = { 'data' : {} };
                                rows.forEach(function(row) {
                                    if (row.length != 12) {
                                        return;
                                    }
                                    if ( ! self._raw_data.data[row[7]]) {
                                        self._raw_data.data[row[7]] = { 'peptides' : [] };
                                    }
                                    var domain = self._raw_data.data[row[7]];
                                    domain.peptides.push([row[3],row[4]]);
                                    domain.name = row[8];
                                    domain.description = row[11];
                                });
                            }
                            return this;
                        });
})();
MASCP.CddRunner.SERVICE_URL = 'http://www.ncbi.nlm.nih.gov/Structure/bwrpsb/bwrpsb.cgi?';

MASCP.CddRunner.hash = function(str){
    var hash = 0;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = char + (hash << 6) + (hash << 16) - hash;
    }
    return hash;
};

MASCP.CddRunner.prototype.requestData = function()
{   
    var self = this;
    // var sequences = [].concat(self.sequences || []);

    if (! MASCP.CddRunner.SERVICE_URL.match(/ncbi/)) {
        return {
            // type: "POST",
            // dataType: "json",
            // data : {
            //     'sequences' : sequences.join(",")
            // }
        };
    }
    bean.fire(self,'running');
    if (this.job_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ncbi.nlm.nih.gov/Structure/bwrpsb/bwrpsb.cgi?cddefl=true&dmode=all&tdata=hits&cdsid='+this.job_id
        };
    }
    
    // for (var i = 0; i < sequences.length; i++ ) {
    //     sequences[i] = ">seq"+i+"\n"+sequences[i];
    // }
    // console.log(sequences);
    sequences  = [ self.agi ];
    return {
        type: "POST",
        dataType: "txt",
        data: { 'queries'   : escape(sequences.join("\n")+"\n\n"),
                'db'        : 'cdd',
                'smode'     : 'live',
                'tdata'     : 'hits',
                'dmode'     : 'all',
                'cddefl'    : 'true'
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
            if (data.status && data.status == "RUNNING") {
                var self = this;
                bean.fire(self,"running");
                setTimeout(function() {
                    self.retrieve(self.agi);
                },5000);
                console.log("Got back running status");
                return;
            }
            return defaultDataReceived.call(this,data,status);
        }
        var re = /^#cdsid\t([a-zA-Z0-9-]+)/m;
        var match;
        if (typeof data == "string" && ! this.job_id ) {
            match = re.exec(data);
            if (match) {
                this.job_id = match[1];
                this.retrieve(this.agi);
                return;
            }
        }
        re = /^#status\tsuccess/m;
        if (re.exec(data)) {
            this.job_id = null;
            return defaultDataReceived.call(this,data,status);
        }
        re = /#status\t3/m;
        if (re.exec(data)) {
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },1000);
            return;
        }
        
        return defaultDataReceived.call(this,data,status);
    };
    
})(MASCP.CddRunner);

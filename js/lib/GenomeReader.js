/** @fileOverview   Classes for reading data from MyGene.info */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Mygene.info for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.GenomeReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.GenomeReader.SERVICE_URL = 'http://mygene.info/v2/query';
MASCP.GenomeReader.prototype.requestData = function()
{
    this.acc = this.agi;

    if (! this.geneid ) {
        return {
            type: "GET",
            dataType: "json",
            url : 'http://mygene.info/v2/query',
            data: { 'q' : 'uniprot:'+this.acc.toUpperCase(),
                    'fields'   : 'entrezgene',
                    'email'    : 'joshi%40sund.ku.dk'
            }
        };
    }

    if (! this.exons ) {
        return {
            type: "GET",
            url : 'http://mygene.info/v2/gene/'+this.geneid,
            dataType: "json",
            data: {
                'fields' : 'exons'
            }
        };
    }

    return {
        type: "GET",
        dataType: "txt",
        url: "http://www.uniprot.org/mapping/",
        data : {
            "from" : "REFSEQ_NT_ID",
            "to" : "ACC",
            "format" : "tab",
            "query" : Object.keys(this.exons).join(' ')
        }
    };
};

(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        var self = this;
        if (data.data && status === "db") {
            return defaultDataReceived.call(this,data,status);
        }
        if (status < 200 || status >= 400) {
            return defaultDataReceived.call(this,null,status);
        }

        if ( ! this.geneid) {
            this.geneid = data.hits[0].entrezgene;
            this.retrieve(this.acc);
            return;
        }
        if ( ! this.exons ) {
            this.exons = data.exons;
            this.retrieve(this.acc);
            return;
        }
        var mapped = {};
        (data || "").split('\n').forEach(function(row) {
            var bits = row.split('\t');
            var uniprot = bits[1];
            var nuc = bits[0];
            if (! self.exons[nuc]) {
                return;
            }
            if ( ! mapped[uniprot] ) {
                mapped[uniprot] = [];
            }
            self.exons[nuc]._id = nuc;
            mapped[uniprot].push(self.exons[nuc]);
        });
        return defaultDataReceived.call(this,{"data":mapped},status);
    };
})(MASCP.GenomeReader);

// MASCP.GenomeReader.prototype.retrieve = function()
// {

//     // bean.fire(this,'resultReceived');
// };

MASCP.GenomeReader.prototype.setupSequenceRenderer = function(renderer,options) {
    this.bind('resultReceived',function() {
    });
};



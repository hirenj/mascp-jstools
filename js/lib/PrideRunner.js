/** @fileOverview   Classes for reading data from PRIDE */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.PrideRunner = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.PrideRunner.SERVICE_URL = 'http://www.ebi.ac.uk/pride/biomart/martservice';

MASCP.PrideRunner.prototype.requestData = function()
{
    var identifiers = [].concat(this.identifiers || []);
    var self = this;
    if (! this._endpointURL.match(/ebi\.ac/)) {
        return {
            type: "GET",
            dataType: "json",
            data : {
                'agi' : self.agi,
                'service' : 'pride'
            }
        };
    }
    var nl = "\n";
    bean.fire(self,'running');
    return {
        type: "GET",
        dataType: "txt",
        data : {
            "query" :   encodeURIComponent('<?xml version="1.0" encoding="UTF-8"?>' +
                        '<!DOCTYPE Query>' +
                        '<Query  virtualSchemaName = "default" formatter = "CSV" header = "0" uniqueRows = "0" count = "" datasetConfigVersion = "0.6" >'+
                        '<Dataset name = "pride" interface = "default" ><Filter name = "submitted_accession_option" value = "'+self.agi+'"/>'+
                        '<Attribute name = "peptide_sequence" /><Attribute name = "start_coord" /><Attribute name = "end_coord" />'+
                        '</Dataset>'+
                        '</Query>')
        }
    }
};

MASCP.PrideRunner.prototype.setupSequenceRenderer = function(renderer) {
    this.bind('resultReceived',function() {
      var raw_values = [];
      var max_val = 0;
      this.result._raw_data.data.forEach(function(pep) {
        if (pep.peptide.length < 1) {
          return;
        }
        var aas = renderer.getAminoAcidsByPeptide(pep.peptide);
        if (! aas || aas.length < pep.peptide.length ) {
          return;
        }
        renderer.getAminoAcidsByPeptide(pep.peptide).forEach(function(aa) {
          raw_values[aa._index] = raw_values[aa._index] || 0;
          raw_values[aa._index] += pep.count;
          if (raw_values[aa._index] > max_val) {
            max_val = raw_values[aa._index];
          }
        });
      });
      var values = [];
      for (var i = 0; i < renderer.sequence.length; i++ ) {
        if (raw_values[i]) {
          values.push(raw_values[i]/max_val);
        } else {
          values.push(0);
        }
      }
      var plot = renderer.addValuesToLayer(this.agi,values,{'height' : 12, 'offset' : 32, 'label' : { 'max' : max_val+' PRIDE peptides' } });
      plot.setAttribute('stroke','#00f');
      renderer.trigger('resultsRendered',[this]);
    });
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
        }
        if (typeof data == "string") {
            var results = [];
            var peptide_hash = {};
            data.split('\n').forEach(function(row) {
                var bits = row.split(',');
                if (bits.length < 1) {
                    return;
                }
                if ( peptide_hash[ bits[0] ]) {
                    peptide_hash[ bits[0] ].count++;
                    if (bits[1]) {
                        peptide_hash[ bits[0] ].start = bits[1];
                        peptide_hash[ bits[0] ].end = bits[2];
                    }
                } else {
                    peptide_hash[ bits[0] ] = { "peptide" : bits[0], "start" : bits[1], "end" : bits[2], "count" : 1 };
                    results.push( peptide_hash[bits[0]] );
                }
            });
            data = results;
        }
        return defaultDataReceived.call(this,data,status);
    };
})(MASCP.PrideRunner);



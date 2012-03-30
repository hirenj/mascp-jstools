/*
http://uniprot.org/mapping/?from=ACC+ID&to=REFSEQ_NT_ID&format=list&query=Q9UNA3
 */

/**
 * @fileOverview    Classes for reading SNP data
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve sequence data for a given AGI from a given ecotype
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ExomeReader = MASCP.buildService(function(data) {
                         this._raw_data = data || {};
                         return this;
                     });

MASCP.ExomeReader.SERVICE_URL = 'http://localhost:3000/data/latest/gator';

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

        if (typeof data == "string" && data.match(/^NM/)) {
            this.agi = data.replace(/(\n|\r)+$/,'');
            this.retrieve(this.agi);
            return;
        }
    };
})(MASCP.ExomeReader);

MASCP.ExomeReader.prototype.requestData = function()
{
    var self = this;
    var agi = this.agi || '';
    if (! agi.match(/NM/)) {
        return {
            type: "GET",
            dataType: "txt",
            url: "http://uniprot.org/mapping/",
            data : {
                "from" : "ACC+ID",
                "to" : "REFSEQ_NT_ID",
                "format" : "list",
                "query" : agi
            }
        }
    }
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : agi,
                'service' : 'exome'
        }
    };
};

MASCP.ExomeReader.prototype.setupSequenceRenderer = function(renderer) {
 var reader = this;

 reader.bind('resultReceived', function() {
     var a_result = reader.result;
     renderer.withoutRefresh(function() {
     var insertions_layer;

     var accessions = a_result.getAccessions();
     while (accessions.length > 0) {

         var acc = accessions.shift();
         var acc_fullname = acc;

         var diffs = a_result.getSnp(acc);

         if (diffs.length < 1) {
             continue;
         }

         var in_layer = 'rnaedit';

         var ins = [];
         var outs = [];
         var acc_layer = renderer.registerLayer(in_layer, {'fullname' : 'RNA Edit (mod)' });

         MASCP.getLayer(in_layer).icon = null;
         var i;

         for (i = diffs.length - 1; i >= 0 ; i-- ){
             outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
             ins.push( { 'insertBefore' : diffs[i][0] + 1, 'delta' : diffs[i][2] });
         }

         for (i = ins.length - 1; i >= 0 ; i-- ) {
             var pos = ins[i].insertBefore - 1;
             if (pos > renderer.sequence.length) {
                 pos = renderer.sequence.length;
             }
             renderer.getAA(pos).addAnnotation('rnaedit',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta, 'angle': 'auto' });
         }
     }

     });
     jQuery(renderer).trigger('resultsRendered',[reader]);
 });
};

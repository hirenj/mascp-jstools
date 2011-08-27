/**
 * @fileOverview    Classes for reading data from TAIR database
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
MASCP.AccessionReader = MASCP.buildService(function(data) {
                        this._data = data || { 'data' : ['',''] };
                        return this;
                    });

MASCP.AccessionReader.SERVICE_URL = 'http://gator.masc-proteomics.org/tair.pl';

MASCP.AccessionReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "POST",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'accession' : this.accession,
                'service' : 'tair' 
        }
    };
};

MASCP.AccessionReader.Result.prototype.getDeletions = function() {
    /* This doesn't work any more */
    return [];
    /*
    var old_sequence = this.reader.reference;

    var new_sequence = this.getSequence();

    var diffs = (new diff_match_patch()).diff_main(old_sequence,new_sequence);
    var deletions = [];
    var last_index = 1;
    for (var i = 0; i < diffs.length; i++ ){
        if (i > 0 && diffs[i-1][0] <= 0) {
            last_index += diffs[i-1][1].length;
        }
        if (diffs[i][0] == -1) {
            deletions.push(last_index);
            var length = diffs[i][1].length - 1;
            while (length > 0) {
                deletions.push(last_index + length);
                length -= 1;
            }
        }
    }
    return deletions;
    */
};

MASCP.AccessionReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    this.bind('resultReceived', function() {

        var accessions = reader.accession.split(',');
        
        
        var an_accession = accessions.shift();
        var a_result = reader.result.length ? reader.result.shift() : reader.result;

        MASCP.registerGroup('all_insertions');
        MASCP.registerGroup('all_deletions');
        renderer.registerLayer('insertions',{'fullname' : 'Accession','color' : '#ff0000'});

        if (renderer.createGroupController) {
            renderer.createGroupController('insertions','all_insertions');
        }
        console.log(a_result);
        
        while(a_result) {
            var old_sequence = renderer.sequence;
            var new_sequence = a_result.getSequence();

            var diffs = (new diff_match_patch()).diff_main(old_sequence,new_sequence);
            var last_index = 1;
            var ins = [];
            var outs = [];

            if (diffs.length <= 1) {
                a_result = reader.result.length ? reader.result.shift() : null;
                an_accession = accessions.shift();
                continue;
            }


            var in_layer = 'all_'+an_accession;

            renderer.registerLayer(in_layer, {'fullname' : an_accession, 'group' : 'all_insertions' });

            var i;
            for (i = diffs.length - 1; i >= 0; i-- ){
                if (i > 0 && diffs[i-1][0] <= 0) {
                    last_index += diffs[i-1][1].length;
                    if (last_index > renderer.sequence.length) {
                        last_index = renderer.sequence.length;
                    }
                }
                if (diffs[i][0] == -1) {
                    outs.push( { 'index' : last_index, 'delta' : diffs[i][1] });
                }
                if (diffs[i][0] == 1) {
                    ins.push( { 'insertBefore' : last_index, 'delta' : diffs[i][1] });
                }
            }
            for (i = ins.length - 1; i >= 0; i-- ) {
                renderer.getAA(ins[i].insertBefore - 1).addAnnotation(in_layer,1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
                renderer.getAA(ins[i].insertBefore - 1).addAnnotation('insertions',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
            }
        
            for (i = outs.length - 1; i >= 0; i--) {
                renderer.getAA(outs[i].index).addAnnotation(in_layer,1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
                renderer.getAA(outs[i].index).addAnnotation('insertions',1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
            }
            
            a_result = reader.result.length ? reader.result.shift() : null;
            an_accession = accessions.shift();            
        }
        
    });
};

MASCP.AccessionReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.AccessionReader.Result.prototype.getSequence = function() {    
    return (typeof(this._data) == 'object' && this._data.length) ? this._data[0].data[2] : this._data.data[2];
};


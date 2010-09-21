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

MASCP.AccessionReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    this.bind('resultReceived', function() {
        var old_sequence = renderer.sequence;
        
        var new_sequence = reader.result.getSequence();
        
        renderer.registerLayer('deletions',{'fullname' : 'All deletions','color' : '#0000ff'});
        renderer.registerLayer('insertions',{'fullname' : 'All insertions','color' : '#ff0000'});

        
        var diffs = (new diff_match_patch()).diff_main(old_sequence,new_sequence);
        var last_index = 1;
        var ins = [];
        var outs = [];

        if (diffs.length <= 1) {
            return;
        }

        var in_layer = 'in_'+reader.accession;
        var out_layer = 'out_'+reader.accession;
        
        MASCP.registerGroup('all_insertions');
        MASCP.registerGroup('all_deletions');

        
        renderer.registerLayer(in_layer, {'fullname' : 'Insertions for '+reader.accession, 'group' : 'all_insertions' });
        renderer.registerLayer(out_layer, {'fullname' : 'Deletions for '+reader.accession, 'group' : 'all_deletions' });

        if (renderer.createGroupController) {
            renderer.createGroupController('insertions','all_insertions');
            renderer.createGroupController('deletions','all_deletions');
        }        

        for (var i = 0; i < diffs.length; i++ ){
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
        
        for (var i = 0; i < ins.length; i++ ) {
            renderer.getAA(ins[i].insertBefore - 1).addAnnotation(in_layer,1, { 'border' : 'rgb(255,0,0)', 'content' : ins[i].delta });
            renderer.getAA(ins[i].insertBefore - 1).addAnnotation('insertions',1, { 'border' : 'rgb(255,0,0)', 'content' : ins[i].delta });
        }
        
        for (var i = 0; i < outs.length; i++) {
            renderer.getAA(outs[i].index).addAnnotation(out_layer,1, {'angle' : 30, 'border' : 'rgb(0,0,255)', 'content' : outs[i].delta });
            renderer.getAA(outs[i].index).addAnnotation('deletions',1, {'angle' : 30, 'border' : 'rgb(0,0,255)', 'content' : outs[i].delta });
        }
        
    });
};

MASCP.AccessionReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.AccessionReader.Result.prototype.getSequence = function() {
    return this._data.data[2];
};


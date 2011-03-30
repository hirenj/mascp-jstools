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
MASCP.SnpReader = MASCP.buildService(function(data) {
                        this._data = data || {};
                        return this;
                    });

MASCP.SnpReader.SERVICE_URL = 'http://gator.masc-proteomics.org/snps.pl';

MASCP.SnpReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "POST",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'service' : 'snps' 
        }
    };
};

MASCP.SnpReader.prototype.showSnp = function(renderer,acc) {
    var diffs = this.result.getSnp(acc);
    if (diffs.length < 1) {
        return;
    }


    var in_layer = 'all_'+acc;

    var ins = [];
    var outs = [];

//    renderer.registerLayer(in_layer, {'fullname' : acc, 'group' : 'all_insertions' });


    for (var i = 0; i < diffs.length; i++ ){
        outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
        ins.push( { 'insertBefore' : diffs[i][0] + 2, 'delta' : diffs[i][2] });
    }

    for (var i = 0; i < ins.length; i++ ) {
        renderer.getAA(ins[i].insertBefore - 1).addAnnotation(in_layer,1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
    }

    // for (var i = 0; i < outs.length; i++) {
    //     renderer.getAA(outs[i].index).addAnnotation(in_layer,1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
    // }
    
};

MASCP.SnpReader.ALL_ACCESSIONS = ["AGU","BAK2","BAY","BUR0","CDM0","COL0","DEL10","DOG4","DON0","EY152","FEI0","HKT24","ICE1","ICE102","ICE104","ICE106","ICE107","ICE111","ICE112","ICE119","ICE120","ICE127","ICE130","ICE134","ICE138","ICE150","ICE152","ICE153","ICE163","ICE169","ICE173","ICE181","ICE21","ICE212","ICE213","ICE216","ICE226","ICE228","ICE29","ICE33","ICE36","ICE49","ICE50","ICE60","ICE61","ICE63","ICE7","ICE70","ICE71","ICE72","ICE73","ICE75","ICE79","ICE91","ICE92","ICE93","ICE97","ICE98","ISTISU1","KASTEL1","KOCH1","KRO0","LAG22","LEO1","LER1","LERIK13","MER6","NEMRUT1","NIE12","PED0","PRA6","QUI0","RI0","RUE3131","SHA","STAR8","TUESB303","TUESCHA9","TUEV13","TUEWA12","VASH1","VIE0","WALHAESB4","XAN1"];


MASCP.SnpReader.prototype.setupSequenceRenderer = function(renderer) {
    var reader = this;
    
    this.bind('resultReceived', function() {

        var accessions = reader.accession ? reader.accession.split(',') : MASCP.SnpReader.ALL_ACCESSIONS;
                
        var a_result = reader.result;

        MASCP.registerGroup('all_insertions');
        MASCP.registerGroup('all_deletions');
        renderer.registerLayer('insertions',{'fullname' : ' ','color' : '#ff0000'});

        if (renderer.createGroupController) {
            renderer.createGroupController('insertions','all_insertions');
        }
        renderer._pause_rescale_of_annotations = true;
        
        while (accessions.length > 0) {
            var acc = accessions.shift();

            var diffs = a_result.getSnp(acc);

            if (diffs.length < 1) {
                continue;
            }


            var in_layer = 'all_'+acc;
            
            var ins = [];
            var outs = [];

            renderer.registerLayer(in_layer, {'fullname' : acc, 'group' : 'all_insertions' });
            MASCP.getLayer(in_layer).icon = null;

            for (var i = 0; i < diffs.length; i++ ){
                outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
                ins.push( { 'insertBefore' : diffs[i][0] + 2, 'delta' : diffs[i][2] });
            }

            for (var i = 0; i < ins.length; i++ ) {
//                renderer.getAA(ins[i].insertBefore - 1).addAnnotation(in_layer,1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
                var pos = ins[i].insertBefore - 1;
                if (pos > renderer.sequence.length) {
                    pos = renderer.sequence.length;
                }
                renderer.getAA(pos).addAnnotation('insertions',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
            }
        
//             for (var i = 0; i < outs.length; i++) {
// //                renderer.getAA(outs[i].index).addAnnotation(in_layer,1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
//                 renderer.getAA(outs[i].index).addAnnotation('insertions',1, {'angle' : 90, 'border' : 'rgb(0,0,150)', 'content' : outs[i].delta });
//             }
            
        }
        renderer.redrawAnnotations('insertions');
        renderer._pause_rescale_of_annotations = false;
        jQuery(renderer).trigger('resultsRendered',[reader]);
        
    });
};

MASCP.SnpReader.Result.prototype.getSnp = function(accession) {
    var snps_data = this._data[accession];
    var results = [];
    for (var pos in snps_data) {
        var position = parseInt(pos);
        var changes = snps_data[pos];
        var a_result = [ position, changes.charAt(0), changes.charAt(1)];
        results.push(a_result);
    }
    return results;
};
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


    var in_layer = 'all'+acc;

    var ins = [];
    var outs = [];

//    renderer.registerLayer(in_layer, {'fullname' : acc, 'group' : 'all_insertions' });

    var i;
    for (i = diffs.length - 1 ; i >= 0 ; i-- ){
        outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
        ins.push( { 'insertBefore' : diffs[i][0] + 2, 'delta' : diffs[i][2] });
    }

    for (i = ins.length - 1; i >= 0 ; i-- ) {
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
        var accessions = (typeof reader.accession !== 'undefined') ? reader.accession.split(',') : [].concat(MASCP.SnpReader.ALL_ACCESSIONS);
        var a_result = reader.result;

        MASCP.registerGroup('insertions');
        MASCP.registerGroup('deletions');

        renderer.withoutRefresh(function() {        
        var insertions_layer;
        
        while (accessions.length > 0) {

            if ( ! insertions_layer ) {
                insertions_layer = renderer.registerLayer('insertions_controller',{'fullname' : 'nsSNPs','color' : '#ff0000'});                
            }

            var acc = accessions.shift();

            var diffs = a_result.getSnp(acc);

            if (diffs.length < 1) {
                continue;
            }

            var in_layer = 'all'+acc;
            
            var ins = [];
            var outs = [];

            var acc_layer = renderer.registerLayer(in_layer, {'fullname' : acc, 'group' : 'insertions' });
            
            (function(this_acc) {
                return function() {
                    var visible = false;
                    var tempname = in_layer;
                    acc_layer.href = function() {
                        visible = ! visible;
                        if (visible) {
                            MASCP.getLayer(tempname).icon = '#minus_icon';
                            reader.showSnp(MASCP.renderer,this_acc);
                        } else {
                            MASCP.getLayer(tempname).icon = '#plus_icon';
                            MASCP.renderer.removeAnnotations(tempname);
                            MASCP.renderer.redrawAnnotations();
                        }
                        MASCP.renderer.refresh();
                        return false;
                    };
                };
            }(acc))();
            
            MASCP.getLayer(in_layer).icon = null;
            var i;
            for (i = diffs.length - 1; i >= 0 ; i-- ){
                outs.push( { 'index' : diffs[i][0] + 1, 'delta' : diffs[i][1] });
                ins.push( { 'insertBefore' : diffs[i][0] + 2, 'delta' : diffs[i][2] });
            }

            for (i = ins.length - 1; i >= 0 ; i-- ) {
                var pos = ins[i].insertBefore - 1;
                if (pos > renderer.sequence.length) {
                    pos = renderer.sequence.length;
                }
                renderer.getAA(pos).addAnnotation('insertions_controller',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta });
            }
        
        }
        
        if (MASCP.getGroup('insertions').size() > 0) {
        
            if (renderer.createGroupController) {
                renderer.createGroupController('insertions_controller','insertions');
            }
        }
        });
        renderer.redrawAnnotations('insertions_controller');
        jQuery(renderer).trigger('resultsRendered',[reader]);
        
    });
};

MASCP.SnpReader.Result.prototype.getSnp = function(accession) {
    var snps_data = this._data[accession];
    var results = [];
    for (var pos in snps_data) {
        if (snps_data.hasOwnProperty(pos)) {
            var position = parseInt(pos,10);
            var changes = snps_data[pos];
            var a_result = [ position, changes.charAt(0), changes.charAt(1)];
            results.push(a_result);
        }
    }
    return results;
};
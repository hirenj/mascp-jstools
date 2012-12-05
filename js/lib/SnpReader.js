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
                        this._raw_data = data || {};
                        return this;
                    });

MASCP.SnpReader.SERVICE_URL = 'http://gator.masc-proteomics.org/snps.pl?';

MASCP.SnpReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'service' : 'nssnps' 
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
        outs.push( { 'index' : diffs[i][0], 'delta' : diffs[i][1] });
        ins.push( { 'insertBefore' : diffs[i][0] + 1, 'delta' : diffs[i][2] });
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
    
    reader.bind('resultReceived', function() {
        var a_result = reader.result;

        MASCP.registerGroup('insertions');
        MASCP.registerGroup('deletions');

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
            if ( ! insertions_layer ) {
                insertions_layer = renderer.registerLayer('insertions_controller',{'fullname' : 'nsSNPs','color' : '#ff0000'});                
            }


            var in_layer = 'all'+acc;
            var group_layer = acc.indexOf('_') >= 0 ? (acc.split('_')[0]).toUpperCase() : null;

            if (['SALK','MPICAO','GMI','MPISCHNEE','MPICOLLAB', 'JGI'].indexOf(group_layer) < 0) {
                group_layer = null;
            } else {
                if (group_layer.match(/^MPI/)) {
                    group_layer = 'MPI';
                }
                acc_fullname = acc.replace(/^[^_]+_/,'');
            }

            var ins = [];
            var outs = [];

            if (group_layer) {
                MASCP.registerGroup(group_layer, {'group' : 'insertions'});
                renderer.registerLayer(group_layer+'_controller', {'fullname' : group_layer, 'group' : 'insertions' , 'color' : '#ff0000'});
                if (renderer.createGroupController && group_layer) {
                    renderer.createGroupController(group_layer+'_controller',group_layer);
                }
                
            }

            var acc_layer = renderer.registerLayer(in_layer, {'fullname' : acc_fullname, 'group' : group_layer || 'insertions' });
            
            (function(this_acc) {
                return function() {
                    var visible = false;
                    var tempname = in_layer;
                    acc_layer.href = function(is_visible) {
                        visible = (typeof is_visible == 'boolean') ? is_visible : ! visible;
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
                ins.push( { 'insertBefore' : diffs[i][0] + 1, 'delta' : diffs[i][2] });
            }

            for (i = ins.length - 1; i >= 0 ; i-- ) {
                var pos = ins[i].insertBefore - 1;
                if (pos > renderer.sequence.length) {
                    pos = renderer.sequence.length;
                }
                var ann = renderer.getAA(pos).addAnnotation('insertions_controller',1, { 'border' : 'rgb(150,0,0)', 'content' : ins[i].delta, 'angle': 0 });
                if (! ann._click) {
                    ann.addEventListener('click',(function(posn) {
                        var visible = false;
                        return function() {
                            visible = ! visible;
                            renderer.withoutRefresh(function() {
                                reader.result.getSnpsForPosition(posn).forEach(function(an_acc) {
                                    reader.showSnp(MASCP.renderer,an_acc);
                                    MASCP.getLayer('all'+an_acc).href(visible);
                                });
                            });
                            renderer.refresh();
                        };
                    })(pos),false);
                    ann.style.cursor = 'pointer';
                    ann._click = true;
                }
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

MASCP.SnpReader.Result.prototype.getAccessions = function() {
    var snps_data = this._raw_data.data;
    var results = [];
    for (var acc in snps_data) {
        if (snps_data.hasOwnProperty(acc)) {
            results.push(acc);
        }
    }
    return results;
};

MASCP.SnpReader.Result.prototype.getSnp = function(accession) {
    var snps_data = this._raw_data.data[accession];
    var results = [];
    for (var pos in snps_data) {
        if (snps_data.hasOwnProperty(pos)) {
            var position = parseInt(pos,10)+1;
            var changes = snps_data[pos];
            var a_result = [ position, changes.charAt(0), changes.charAt(1)];
            results.push(a_result);
        }
    }
    return results;
};

MASCP.SnpReader.Result.prototype.getSnpsForPosition = function(position) {
    var self = this;
    this._cached = this._cached || {};
    if (this._cached[position]) {
        return this._cached[position];
    }
    var results = [];
    this.getAccessions().forEach(function(acc) {
        self.getSnp(acc).forEach(function(snp) {
            if (snp[0] == position) {
                results.push(acc);
                return;
            }
        });
    });
    this._cached[position] = results;
    return results;
};

MASCP.cloneService(MASCP.SnpReader,"RnaEditReader");

MASCP.RnaEditReader.SERVICE_URL = '?';

MASCP.RnaEditReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'   : this.agi,
                'service' : 'rnaedit' 
        }
    };
};

MASCP.RnaEditReader.prototype.setupSequenceRenderer = function(renderer) {
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


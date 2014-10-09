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
            self.sequences = [];
            Object.keys(data.data).forEach(function(uniprot) {
                self.sequences.push({ "agi" : uniprot });
            });
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
        self.sequences = [];
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
            self.sequences.push({ "agi" : uniprot, "exon" : self.exons[nuc] });
        });
        return defaultDataReceived.call(this,{"data":mapped},status);
    };
})(MASCP.GenomeReader);


MASCP.GenomeReader.Result.prototype.getSequences = function() {
    var results = [];
    var cds_data = this._raw_data.data;
    var uniprots = Object.keys(cds_data);
    var min = max = null;
    uniprots.forEach(function(uniprot) {
        var ends = cds_data[uniprot].map(function(cd) { return [ cd.txstart, cd.txend ]; });
        ends.forEach(function(cd) {
            if (! min || cd[0] < min) {
                min = cd[0];
            }
            if (! max || cd[1] > max) {
                max = cd[1];
            }
        });
    });
    results = [ Array( Math.floor( (max - min) / 3 ) ).join('.') ];
    this.min = min;
    this.max = max;
    return results;
};

MASCP.ClustalRunner.Result.prototype.calculatePositionForSequence = function(idx,pos) {
    var wanted_uniprot = self.sequences[idx].agi;
    var inserts = this._raw_data.data.sequences[idx].insertions || {};
    var result = pos;
    var actual_position = 0;
    var seq = this._raw_data.data.sequences[idx].toString();
    for (var i = 0 ; i < seq.length; i++ ) {
        if (inserts[i]) {
            actual_position += inserts[i].length;
        }
        actual_position += 1;
        if (seq.charAt(i) == '-') {
            actual_position -= 1;
        }
        if (pos <= actual_position) {
            if (pos == actual_position) {
                return (i+1);
            } else {
                return -1 * i;
            }
        }
    }
    return -1 * seq.length;
};

(function(serv) {
    var extender = function(genomereader,aas,elements_to_move,index) {
        return function(el) {
            var orig_functions = {};
            genomereader.renderer._extendElement(orig_functions);

            var result = {};
            result.original_index = aas.shift();
            if ( ! el ) {
                el = { "_index" : -100, "_renderer" : renderer };
            }
            if ( ! el['_renderer']) {
                el['_renderer'] = renderer;
            }

            result._index = el._index;

            result.addShapeOverlay = function(layername,width,opts) {
                elements_to_move.push(orig_functions['addShapeOverlay'].call(el,layername,Math.abs(genomereader.result.calculatePositionForSequence(index,result.original_index+width)) - el._index,opts));
                elements_to_move.slice(-1)[0].layer_idx = index;
                elements_to_move.slice(-1)[0].aa = result.original_index;
                elements_to_move.slice(-1)[0].aa_width = width;
                return elements_to_move.slice(-1)[0];
            };
            result.addBoxOverlay = function(layername,width,fraction,opts) {
                elements_to_move.push(orig_functions['addBoxOverlay'].call(el,layername,Math.abs(genomereader.result.calculatePositionForSequence(index,result.original_index+width)) - el._index,fraction,opts));
                elements_to_move.slice(-1)[0].layer_idx = index;
                elements_to_move.slice(-1)[0].aa_width = width;
                elements_to_move.slice(-1)[0].aa = result.original_index;
                return elements_to_move.slice(-1)[0];
            };
            result.addTextOverlay = function(layername,width,opts) {
                elements_to_move.push(orig_functions['addTextOverlay'].call(el,layername,Math.abs(genomereader.result.calculatePositionForSequence(index,result.original_index+width)) - el._index,opts));
                elements_to_move.slice(-1)[0].layer_idx = index;
                elements_to_move.slice(-1)[0].aa = result.original_index;
                elements_to_move.slice(-1)[0].aa_width = width;
                return elements_to_move.slice(-1)[0];
            };
            result.addToLayerWithLink = function(layername,url,width) {
                elements_to_move.push(orig_functions['addToLayerWithLink'].call(el,layername,url,Math.abs(genomereader.result.calculatePositionForSequence(index,result.original_index+width)) - el._index));
                elements_to_move.slice(-1)[0].layer_idx = index;
                return elements_to_move.slice(-1)[0];
            };
            result.addToLayer = function(layername,opts) {
                elements_to_move.push(orig_functions['addToLayer'].call(el,layername,opts));
                elements_to_move.slice(-1)[0].layer_idx = index;
                elements_to_move.slice(-1)[0].aa = result.original_index;
                elements_to_move.slice(-1)[0].aa_width = 1;
                return elements_to_move.slice(-1)[0];
            };
            for (var method in orig_functions) {
                if ( ! result[method] ) {
                    result[method] = (function(method){
                        return function() {
                            elements_to_move.push(orig_functions[method].apply(el,arguments));
                            return elements_to_move.slice(-1)[0];
                        };
                    })(method);
                }
            }
            return result;
        };
    };
    var reader_extender = function(genomereader,elements_to_move) {
        return function(reader) {
            if (genomereader == reader) {
                return;
            }
            if ( ! genomereader.result ) {
                return;
            }
            var old = reader.gotResult;
            var renderer = genomereader.renderer;
            reader.getSequence = function() {
                var wanted_id = reader.acc || reader.agi || "";
                for (var i = 0; i < genomereader.sequences.length; i++) {
                    if (genomereader.sequences[i].agi && genomereader.sequences[i].agi.toUpperCase() == wanted_id.toUpperCase()) {
                        return genomereader.sequences[i].toString();
                    }
                }
                return renderer.sequence;
            };

            reader.gotResult = function() {
                var index = 0;
                var wanted_id = reader.acc || reader.agi || "";
                var curr_sequence = renderer.sequence;
                for (var i = 0; i < genomereader.sequences.length; i++) {
                    if (genomereader.sequences[i].agi && genomereader.sequences[i].agi.toUpperCase() == wanted_id.toUpperCase()) {
                        index = i;
                    }
                }
                var old_get_aas = renderer.getAminoAcidsByPosition;
                var old_get_pep = renderer.getAminoAcidsByPeptide;

                renderer.getAminoAcidsByPosition = function(aas) {
                    var new_aas = aas.map(function(aa) { return Math.abs(genomereader.result.calculatePositionForSequence(index,aa)); });
                    return old_get_aas.call(this,new_aas).map(extender(genomereader,aas,elements_to_move,index));
                };
                renderer.getAminoAcidsByPeptide = function(peptide) {
                    // var positions = [];
                    // var start = genomereader.sequences[index].toString().indexOf(peptide);
                    // for (var i = 0; i < peptide.length; i++ ) {
                    //     positions.push(start+i);
                    // }
                    // var results = this.getAminoAcidsByPosition(positions);
                    // if (results.length) {
                    //     results.addToLayer = function(layername, fraction, options) {
                    //         return results[0].addBoxOverlay(layername,results.length,fraction,options);
                    //     };
                    // } else {
                    //     results.addToLayer = function() {};
                    // }
                    // return results;
                };
                old.call(reader);
                renderer.sequence = curr_sequence;
                renderer.getAminoAcidsByPosition = old_get_aas;
                renderer.getAminoAcidsByPeptide = old_get_pep;
            };
        };
    };

    var get_exon_boxes = function(result) {
        var cds_data = result._raw_data.data;
        var uniprots = Object.keys(cds_data);
        var max = result.max;
        var min = result.min;
        var return_data = [];
        var base_offset = 0;
        uniprots.forEach(function(uniprot) {
            var ends = cds_data[uniprot].reverse().map(function(cd,idx) {
                var exons = cd.exons;
                var color = (idx == (cds_data[uniprot].length - 1)) ? '#000' : '#f99';
                exons.forEach(function(exon) {
                    return_data.push({ "aa": Math.floor((exon[0] - min)/3), "type" : "box" , "width" : (Math.floor((exon[1] - exon[0])/3)), "options" : { "offset" : base_offset, "height_scale" : 0.2, "fill" : color, "merge" : false  }});
                });
                base_offset += 1;
            });
        });
        return return_data;
    };

    serv.prototype.setupSequenceRenderer = function(renderer) {
        var self = this;

        var elements_to_move = [];

        renderer.bind('readerRegistered',reader_extender(self,elements_to_move));

        var controller_name = 'isoform_controller';
        var group_name = 'isoforms';

        var redraw_alignments = function(sequence_index) {
            if ( ! sequence_index ) {
                sequence_index = 0;
            }
            var result = self.result;

            MASCP.registerGroup(group_name, 'Aligned');
            MASCP.registerLayer(controller_name, { 'fullname' : 'Conservation', 'color' : '#000000' });
            if (renderer.trackOrder.indexOf(controller_name) < 0) {
                renderer.trackOrder.push(controller_name);
            }
            renderer.showLayer(controller_name);
            renderer.createGroupController(controller_name,group_name);

            elements_to_move.forEach(function(el) {
                if (el.move) {
                    var aa = result.calculatePositionForSequence(el.layer_idx,el.aa);
                    var aa_width = result.calculatePositionForSequence(el.layer_idx,el.aa+el.aa_width);
                    if (aa < 0) {
                        aa *= -1;
                    }
                    if (aa_width < 0) {
                        aa_width *= -1;
                    }
                    el.move(aa,aa_width-aa);
                }
            });
            var aligned = result.getSequences();


            if ( ! renderer.sequence ) {
                // Not sure what to do with this bit here

                renderer.setSequence(aligned[sequence_index])(function() {
                    redraw_alignments(sequence_index);
                });
                return;
            } else {
                renderer.sequence = aligned[sequence_index];
                renderer.redrawAxis();
            }
            for (var i = 0 ; i < aligned.length; i++) {
                var layname = self.sequences[i].agi.toUpperCase() || "missing"+i;
                MASCP.registerGroup(group_name, 'Aligned');
                var lay = MASCP.registerLayer(layname,{'fullname': self.sequences[i].name || layname.toUpperCase(), 'group' : group_name, 'color' : '#ff0000'});
                lay.fullname = self.sequences[i].name || layname.toUpperCase();
                if (renderer.trackOrder.indexOf(layname.toUpperCase()) < 0) {
                  renderer.trackOrder.push(layname.toUpperCase());
                }
            }

            renderer.renderObjects(controller_name,get_exon_boxes(result));

            renderer.zoom = 1;
            bean.fire(MASCP.getGroup(group_name),'visibilityChange',[renderer,true]);
            renderer.refresh();

        };

        this.bind('resultReceived',redraw_alignments);

    };

})(MASCP.GenomeReader);




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
    } else if ( ! this.acc ) {
        this.acc = this.agi = ""+this.geneid;
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
            self.sequences = [{ "agi" : "genome" }];
            Object.keys(data.data).forEach(function(uniprot) {
                self.sequences.push({ "agi" : uniprot.toLowerCase() });
            });
            return defaultDataReceived.call(this,data,status);
        }
        if (status < 200 || status >= 400) {
            return defaultDataReceived.call(this,null,status);
        }

        if ( ! this.geneid) {
            this.geneid = data.hits[0].entrezgene;
            this.retrieve(this.acc || this.agi);
            return;
        }
        if ( ! this.exons ) {
            this.exons = data.exons;
            this.retrieve(this.acc || this.agi);
            return;
        }
        var mapped = {};
        self.sequences = [{ "agi" : "genome" }];
        (data || "").split('\n').forEach(function(row) {
            var bits = row.split('\t');
            if ( ! bits[1]) {
                return;
            }
            var uniprot = bits[1].toLowerCase();
            var nuc = bits[0];
            if (! self.exons[nuc]) {
                return;
            }
            if (! self.agi || ! self.acc) {
                self.acc = uniprot;
                self.agi = uniprot;
            }

            if ( ! mapped[uniprot] ) {
                mapped[uniprot] = [];
            }
            self.exons[nuc]._id = nuc;
            mapped[uniprot].push(self.exons[nuc]);
            self.sequences.push({ "agi" : uniprot.toLowerCase() });
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

MASCP.GenomeReader.Result.prototype.getIntrons = function(margin) {
    var self = this;
    var results = [];
    var uprots = Object.keys(self._raw_data.data);
    uprots.forEach(function(up) {
        var cds = self._raw_data.data[up];
        cds.forEach(function(target_cds) {
            var exons = target_cds.exons;
            var target_position;

            for (var i = 0; i < exons.length; i++) {
                if (i == 0) {
                    results.push([ self.min, exons[i][0] - margin ]);
                } else {
                    results.push([ exons[i-1][1] + margin, exons[i][0] - margin]);
                }
                if (i == (exons.length - 1)) {
                    results.push([ exons[i][1] + margin, self.max ]);
                }
                if (results.slice(-1)[0][0] > results.slice(-1)[0][1]) {
                    results.splice(results.length - 1,1);
                }
            }
        });
    });
    return results;
};

MASCP.GenomeReader.prototype.calculateProteinPositionForSequence = function(idx,pos) {
    var self = this;
    var wanted_identifier = idx;
    var position_genome = pos * 3;
    var cds = self.result._raw_data.data[wanted_identifier.toLowerCase()];
    var target_cds = cds[0];
    var exons = target_cds.exons;
    var target_position;

    for (var i = 0; i < exons.length; i++) {
        if (target_cds.cdsstart > exons[i][1] & target_cds.cdsstart > exons[i][0]) {
            continue;
        }
        var start = target_cds.cdsstart > exons[i][0] ? target_cds.cdsstart : exons[i][0];
        var bases = (exons[i][1] - start);
        if (bases >= position_genome) {
            target_position = start + position_genome - self.result.min;
            break;
        } else {
            position_genome -= bases;
        }
    }
    return Math.floor(target_position / 3);
};

MASCP.GenomeReader.prototype.calculatePositionForSequence = function(idx,pos) {
    var self = this;
    var wanted_identifier = self.sequences[idx].agi;
    var empty_regions =  [];
    var calculated_pos = pos;

    if (wanted_identifier == 'genome') {
    // Don't change the genome identifier
    } else {
        calculated_pos = self.calculateProteinPositionForSequence(idx,pos);
    }

    for (var i = 0; i < empty_regions.length; i++) {
        if (pos > empty_regions[i][1]) {
            calculated_pos -= (empty_regions[i][1] - empty_regions[i][0]);
        }
        if (pos < empty_regions[i][1] && pos > empty_regions[i][0]) {
            calculated_pos = -1;
        }
    }

    return (calculated_pos);
};

(function(serv) {
    var get_exon_boxes = function(result) {
        var cds_data = result._raw_data.data;
        var uniprots = Object.keys(cds_data);
        var max = result.max;
        var min = result.min;
        var return_data = [];
        var base_offset = 0;
        uniprots.forEach(function(uniprot) {
            var ends = cds_data[uniprot].map(function(cd,idx) {
                var exons = cd.exons;
                var color = (idx == 0) ? '#000' : '#f99';
                exons.forEach(function(exon) {
                    return_data.push({ "aa": 1+exon[0], "type" : "box" , "width" : exon[1] - exon[0], "options" : { "offset" : base_offset, "height_scale" : 0.3, "fill" : color, "merge" : false  }});
                });
                return_data.push({"aa" : cd.cdsstart, "type" : "box" , "width" : 0.5, "options" : { "fill" : "#0000ff", "height_scale" : 0.3, "offset" : base_offset , "merge" : false } });
                base_offset += 1;
            });
            base_offset += 2;
        });
        return return_data;
    };

    var get_removed_labels = function(result) {
        var removed = result.removed_regions || [];
        var results = [];
        var max = result.max;
        var min = result.min;

        removed.forEach(function(vals) {
            var start = vals[0];
            var end = vals[1];
            var start_txt = Math.floor ( (start % 1e6 ) / 1000)+"kb";
            var end_txt = Math.floor ( (end % 1e6 ) / 1000)+"kb";

            results.push({"aa" : start - 1, "type" : "text", "options" : {"txt" : start_txt, "fill" : "#000", "height" : 8, "offset" : -8, "align" : "right" } });
            results.push({"aa" : end + 1, "type" : "text", "options" : {"txt" : end_txt, "fill" : "#000", "height" : 8, "offset" : 24, "align" : "left" } });
            results.push({"aa" : start - 1, "type" : "box", width : (end - start) + 3, "options" : {"fill" : "#999", "height_scale" : 10, "offset" : -8 } });
        });
        return results;
    };

    var calculate_removed_regions = function(result,margin) {
        var introns =  result.getIntrons(margin);

        var intervals = [{ "index" : result.min - 2, "start" : true, "idx" : -1 } , {"index" : result.min, "start" : false, "idx" : -1 }];
        introns.forEach(function(intron,idx) {
            intervals.push({ "index" : intron[0], "start" : true,  "idx" : idx });
            intervals.push({ "index" : intron[1], "start" : false , "idx" : idx });
        });

        intervals.sort(function(a,b) {
            if (a.index < b.index ) {
                return -1;
            }
            if (a.index > b.index ) {
                return 1;
            }
            if (a.index == b.index) {
                return a.start ? -1 : 1;
            }
        });
        var results = [];
        intervals.forEach(function(intr,idx) {
            if (intr.start && intervals[idx+1] && intervals[idx+1].start == false) {
                if (intr.index != intervals[idx+1].index && intervals[idx+1].index != result.min) {
                    results.push( [intr.index , intervals[idx+1].index ]);
                }
            }
        });
        result.removed_regions = results;
    };
    var generate_scaler_function = function(reader) {
        return function(in_pos,layer) {
            var pos = in_pos;
            var calculated_pos = pos - reader.result.min;
            if ( ! reader.result ) {
                return Math.floor(pos / 3);
            }
            var introns = reader.result.removed_regions || [];
            for (var i = 0; i < introns.length; i++) {
                if (pos > introns[i][1]) {
                    calculated_pos -= (introns[i][1] - introns[i][0]);
                }
                if (pos < introns[i][1] && pos > introns[i][0]) {
                    calculated_pos = -1 * (introns[i][0] - reader.result.min);
                }
            }
            if (calculated_pos < 3) {
                calculated_pos = 3;
            }
            return (Math.floor(calculated_pos / 3));
        };
    };
    Object.defineProperty(serv.prototype, 'exon_margin', {
        set: function(val) {
            this._exon_margin = val;
            if (this.result) {
                calculate_removed_regions(this.result,val);
                this.redrawIntrons();
            }
        },
        get: function() { return this._exon_margin; }
    });

    var redrawIntrons = function(renderer,controller_name,scaler_function) {
        var labs = [];
        var zoomCheck = function() {
            if (labs.length < 1 || ! labs[0].parentNode) {
                return;
            }
            var hidden = false;
            for (var i = 0 ; ! hidden && i < (labs.length - 3); i += 3) {
                if (labs[i].hasAttribute('display')) {
                    hidden = true;
                    continue;
                } 
                if (labs[i].getBoundingClientRect().right > labs[i+3].getBoundingClientRect().left) {
                    hidden = true;
                }
            }
            labs.forEach(function(lab) { if(lab.nodeName == 'rect') { return; } if (hidden) { lab.setAttribute('display','none') } else { lab.removeAttribute('display') } });
        };
        renderer.bind('zoomChange',zoomCheck);

        return function() {
            var result = this.result;
            renderer.sequence = Array( scaler_function(result.max)).join('.');

            if (labs.length > 0) {
                labs.forEach(function(lab) {
                    renderer.remove(controller_name,lab);
                });
                labs = [];
            }
            var proxy_reader = {
                agi: controller_name,
                gotResult: function() {
                    labs = renderer.renderObjects(controller_name,get_removed_labels(result));
                    renderer.refresh();
                    zoomCheck();
                }
            };
            MASCP.Service.prototype.registerSequenceRenderer.call(proxy_reader,renderer);
            proxy_reader.gotResult();
        };
    };

    serv.prototype.setupSequenceRenderer = function(renderer) {
        var self = this;
        renderer.addAxisScale('genome',function(pos,layer) {
            if (layer && layer.genomic) {
                return pos;
            }
            return self.calculateProteinPositionForSequence(layer.name,pos);
        });
        var controller_name = 'cds';
        var redraw_alignments = function(sequence_index) {
            if ( ! sequence_index ) {
                sequence_index = 0;
            }
            MASCP.registerLayer(controller_name, { 'fullname' : 'CDS', 'color' : '#000000' });
            MASCP.getLayer(controller_name).genomic = true;

            if (renderer.trackOrder.indexOf(controller_name) < 0) {
                renderer.trackOrder.push(controller_name);
            }
            renderer.showLayer(controller_name);

            var result = this.result;

            var aligned = result.getSequences();
            var scaler_function = generate_scaler_function(self);

            renderer.addAxisScale('removeIntrons',scaler_function);

            calculate_removed_regions(self.result,self.exon_margin || 300);

            if ( ! renderer.sequence ) {
                // Not sure what to do with this bit here

                renderer.setSequence(Array( scaler_function(result.max) ).join('.'))(function() {
                    redraw_alignments(sequence_index);
                });
                return;
            } else {
                renderer.sequence = Array( scaler_function(result.max)).join('.');
                renderer.redrawAxis();
            }
            var proxy_reader = {
                agi: controller_name,
                gotResult: function() {
                    renderer.renderObjects(controller_name,get_exon_boxes(result));
                }
            };
            MASCP.Service.prototype.registerSequenceRenderer.call(proxy_reader,renderer);
            proxy_reader.gotResult();

            self.redrawIntrons = redrawIntrons(renderer,controller_name,scaler_function);
            self.redrawIntrons();
        };

        this.bind('resultReceived',redraw_alignments);

    };

})(MASCP.GenomeReader);




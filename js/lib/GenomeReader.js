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
            this.retrieve(this.acc);
            return;
        }
        if ( ! this.exons ) {
            this.exons = data.exons;
            this.retrieve(this.acc);
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
                    return_data.push({ "aa": 1+Math.floor((exon[0] - min)/3), "type" : "box" , "width" : (Math.floor((exon[1] - exon[0])/3)), "options" : { "offset" : base_offset, "height_scale" : 0.3, "fill" : color, "merge" : false  }});
                });
                base_offset += 1;
            });
            base_offset += 2;
        });
        return return_data;
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

            var proxy_reader = {
                agi: controller_name,
                gotResult: function() {
                    renderer.renderObjects(controller_name,get_exon_boxes(result));
                }
            };
            MASCP.Service.prototype.registerSequenceRenderer.call(proxy_reader,renderer);
            proxy_reader.gotResult();
        };

        this.bind('resultReceived',redraw_alignments);

    };

})(MASCP.GenomeReader);




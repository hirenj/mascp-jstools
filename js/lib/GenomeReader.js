/** @fileOverview   Classes for reading data from MyGene.info */

import MASCP from './MASCP';
import Service from './Service';
import bean from '../bean';


/** Default class constructor
 *  @class      Service class that will retrieve data from Mygene.info for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
const GenomeReader = Service.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

GenomeReader.SERVICE_URL = 'http://mygene.info/v2/query';
GenomeReader.prototype.requestData = function()
{
    this.acc = this.agi;

    if (! this.geneid ) {
        return {
            type: "GET",
            dataType: "json",
            url : 'https://mygene.info/v2/query',
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
            url : 'https://mygene.info/v3/gene/'+this.geneid,
            dataType: "json",
            data: {
                'fields' : 'exons_hg19,uniprot.Swiss-Prot'
            }
        };
    }

    if (this.trying_isoform) {
        return MASCP.GatorDataReader.authenticate().then((url_base) => {
            this.trying_isoform = true;
            return {
                type: "GET",
                dataType: "json",
                auth: MASCP.GATOR_AUTH_TOKEN,
                api_key: MASCP.GATOR_CLIENT_ID,
                url: url_base+'/data/latest/combined/'+(this.swissprot).toUpperCase()
            };
        });
    }

    return MASCP.GatorDataReader.authenticate().then((url_base) => {
        this.trying_isoform = true;
        return {
            type: "GET",
            dataType: "json",
            auth: MASCP.GATOR_AUTH_TOKEN,
            api_key: MASCP.GATOR_CLIENT_ID,
            url: url_base+'/data/latest/combined/'+(this.swissprot).toUpperCase()+'-1'
        };
    });

    return {
        type: "GET",
        dataType: "txt",
        url: "https://www.uniprot.org/mapping/",
        data : {
            "from" : "REFSEQ_NT_ID",
            "to" : "ACC",
            "format" : "tab",
            "query" : Object.keys(this.exons).join(' ')
        }
    };
};

let update_structure = (data) => {
    let result = {};
    for (let transcript of data) {
        result[transcript.transcript] = transcript;
        transcript.exons = transcript.position;
        delete transcript.position;
    }
    return result;
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
            this.exons = update_structure(data.exons_hg19 || data.exons);
            this.swissprot = (data.uniprot || {})['Swiss-Prot'].toLowerCase();
            if ( ! this.nt_mapping ) {
                this.retrieve(this.acc || this.agi);
                return;
            }
            data = this.nt_mapping.map(function(map) { return map.join('\t'); } ).join('\n');
        }
        data = data.data.filter( dat => dat.dataset == 'uniprot_refseqnt' );

        if (data.length > 0) {
            data = data[0].data.map( mapping => [mapping.refseqnt.replace(/\..*/,''),mapping.uniprot].join('\t') ).join('\n');
        } else {
            if ( this.trying_isoform ) {
                this.retrieve(this.acc || this.agi);
                return;
            }
            data = "";
        }

        var mapped = {};
        self.sequences = [{ "agi" : "genome" }];
        (data || "").split('\n').forEach(function(row) {
            var bits = row.split('\t');
            if ( ! bits[1]) {
                return;
            }
            var uniprot = bits[1].toLowerCase().replace(/-\d+/,'');
            var nuc = bits[0];
            nuc = nuc.replace(/\..*$/,'');
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
})(GenomeReader);


GenomeReader.Result.prototype.getSequences = function() {
    var results = [];
    var cds_data = this._raw_data.data;
    var uniprots = Object.keys(cds_data);
    let min, max;
    min = max = null;
    uniprots.forEach(function(uniprot) {
        var ends = cds_data[uniprot].map(function(cd) {
            if ( Array.isArray(cd) ) {
                cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
            }
            return [ cd.txstart, cd.txend ];
        });
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

GenomeReader.Result.prototype.getIntrons = function(margin) {
    var self = this;
    var results = [];
    var uprots = Object.keys(self._raw_data.data);
    uprots.forEach(function(up) {
        var cds = self._raw_data.data[up];
        cds.forEach(function(target_cds) {
            if ( Array.isArray(target_cds) ) {
                target_cds = target_cds.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                if ( ! target_cds ) {
                    return null;
                }
            }

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

GenomeReader.prototype.proteinLength = function(target_cds) {
    var exons = target_cds.exons;
    var total = 0;
    for (var i = 0; i < exons.length; i++) {
        if (target_cds.cdsstart > exons[i][1] & target_cds.cdsstart > exons[i][0]) {
            continue;
        }
        if (target_cds.cdsend < exons[i][0]) {
            continue;
        }

        var start = target_cds.cdsstart > exons[i][0] ? target_cds.cdsstart : exons[i][0];
        var end = target_cds.cdsend < exons[i][1] ? target_cds.cdsend : exons[i][1];
        total += (end - start);
    }
    return Math.floor(total/3)-1;
};

GenomeReader.prototype.calculateSequencePositionFromProteinPosition = function(idx,pos) {
    var self = this;
    var wanted_identifier = idx;
    var cds = self.result._raw_data.data[wanted_identifier.toLowerCase()];
    if (! cds ) {
        return -1;
    }

    if (! cds.txstart ) {
        cds = cds.map( function(cd) {
            if ( Array.isArray(cd) ) {
                cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                if ( ! cd ) {
                    return null;
                }
            }
            return cd;
        });
    }

    var target_cds = cds[0] || {};
    var exons = target_cds.exons || [];

    var position_genome = Math.floor(pos / 3);


    var target_position = 0;

    if (pos < target_cds.cdsstart) {
        target_position = 6;
        if (target_cds.strand == -1) {
            target_position = 3;
        }
    }

    if (pos > target_cds.cdsend) {
        target_position = self.proteinLength(target_cds) * 3;
        if (target_cds.strand == 1) {
            target_position += 3;
        }
    }
    if ( target_position == 0) {
        for (var i = 0; i < exons.length; i++) {
            if (target_cds.cdsstart > exons[i][1] & target_cds.cdsstart > exons[i][0]) {
                continue;
            }
            var start = target_cds.cdsstart > exons[i][0] ? target_cds.cdsstart : exons[i][0];
            var end = target_cds.cdsend < exons[i][1] ? target_cds.cdsend: exons[i][1];

            if (pos < start) {
                break;
            }

            if (pos <= end && pos >= start) {
                target_position += (pos - start);
                break;
            } else {
                target_position += end - start;
            }
        }
    }
    target_position = Math.floor(target_position / 3) - 1;

    if (target_cds.strand == -1) {
        target_position = self.proteinLength(target_cds) - target_position;
    }

    return target_position;
};

GenomeReader.prototype.calculateProteinPositionForSequence = function(idx,pos) {
    var self = this;
    var wanted_identifier = idx;
    var cds = self.result._raw_data.data[wanted_identifier.toLowerCase()];
    if (! cds ) {
        return -1;
    }

    if (! cds.txstart ) {
        cds = cds.map( function(cd) {
            if ( Array.isArray(cd) ) {
                cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                if ( ! cd ) {
                    return null;
                }
            }
            return cd;
        });
    }

    var target_cds = cds[0] || {};
    var exons = target_cds.exons || [];

    if (target_cds.strand == -1) {
        pos = self.proteinLength(target_cds) - pos;
    }
    var position_genome = pos * 3;


    var target_position;

    for (var i = 0; i < exons.length; i++) {
        if (target_cds.cdsstart > exons[i][1] & target_cds.cdsstart > exons[i][0]) {
            continue;
        }
        var start = target_cds.cdsstart > exons[i][0] ? target_cds.cdsstart : exons[i][0];
        var bases = (exons[i][1] - start);
        if (bases >= position_genome) {
            target_position = start + position_genome;
            break;
        } else {
            position_genome -= bases;
        }
    }
    return target_position;
};

GenomeReader.prototype.calculatePositionForSequence = function(idx,pos) {
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
    var get_exon_boxes = function(result,uniprot) {
        var cds_data = result._raw_data.data;
        if (uniprot) {
            console.log('Filtering exons so we only show',uniprot);
        }
        var uniprots = Object.keys(cds_data);
        var max = result.max;
        var min = result.min;
        var return_data = [];
        var base_offset = 0;
        uniprots.filter( up => uniprot ? up === (uniprot || '').toLowerCase() : true ).forEach(function(uniprot) {
            var ends = cds_data[uniprot].map(function(cd,idx) {
                if ( Array.isArray(cd) ) {
                    cd = cd.filter(function(c) { return c.chr.match(/^[\dXx]+$/ ); })[0];
                    if ( ! cd ) {
                        return;
                    }
                }

                var exons = cd.exons;
                var color = (idx == 0) ? '#999' : '#f99';
                exons.forEach(function(exon) {
                    return_data.push({ "aa": 1+exon[0], "type" : "box" , "width" : exon[1] - exon[0], "options" : { "offset" : base_offset, "height_scale" : 1, "fill" : color, "merge" : false  }});
                    if (cd.strand  > 0) {
                        return_data.push({ "aa": exon[1] - 1, "type" : "marker", "options" : { "height" : 4, "content" : {"type" : "right_triangle", "fill" : '#aaa' }, "offset" : base_offset+2, "bare_element" : true }});
                    } else {
                        return_data.push({ "aa": exon[0] + 1, "type" : "marker", "options" : { "height" : 4, "content" : {"type" : "left_triangle", "fill" : '#aaa' }, "offset" : base_offset+2, "bare_element" : true }});
                    }
                });
                return_data.push({"aa" : cd.cdsstart, "type" : "box" , "width" : 1, "options" : { "fill" : "#0000ff", "height_scale" : 2, "offset" : base_offset - 2 , "merge" : false } });
                return_data.push({"aa" : cd.cdsend, "type" : "box" , "width" : 1, "options" : { "fill" : "#0000ff", "height_scale" : 2, "offset" : base_offset  - 2, "merge" : false } });
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
        var cds_data = result._raw_data.data;
        var uniprots = Object.keys(cds_data);
        var total = uniprots.reduce(function(prev,up) { return prev + cds_data[up].length;  },0);
        removed.forEach(function(vals) {
            var start = vals[0];
            var end = vals[1];
            var start_txt = Math.floor ( (start % 1e6 ) / 1000)+"kb";
            var end_txt = Math.floor ( (end % 1e6 ) / 1000)+"kb";
            results.push({"aa" : start - 1, "type" : "box", width : (end - start) + 3, "options" : {"fill" : "#999", "height_scale" : total*3, "offset" : -1*total } });
            results.push({"aa" : start - 3, "type" : "text", "options" : {"txt" : start_txt, "fill" : "#000", "height" : 4, "offset" : -4, "align" : "right" } });
            results.push({"aa" : end + 3, "type" : "text", "options" : {"txt" : end_txt, "fill" : "#000", "height" : 4, "offset" : 4, "align" : "left" } });
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
        return function(in_pos,layer,inverse) {
            var pos = in_pos;

            if ( ! reader.result ) {
                return inverse ? (pos * 3) : Math.floor(pos / 3);
            }

            var introns = reader.result.removed_regions || [];

            if (inverse) {
                pos = (in_pos * 3);
                calculated_pos = pos;
                for (var i = 0; i < introns.length && pos > 0; i++) {
                    var left_exon = i > 0 ? introns[i-1] : [null,reader.result.min];
                    var right_exon = introns[i] || [reader.result.max,null];
                    pos -= (right_exon[0] - left_exon[1]);
                    if (pos > 0) {
                        calculated_pos += introns[i][1] - introns[i][0];
                    }
                }
                return calculated_pos + reader.result.min;
            }

            var calculated_pos = pos - reader.result.min;
            for (var i = 0; i < introns.length; i++) {
                if (pos > introns[i][1]) {
                    calculated_pos -= (introns[i][1] - introns[i][0]);
                }
                if (pos < introns[i][1] && pos > introns[i][0]) {
                    calculated_pos = (introns[i][1] - reader.result.min);
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
            Service.prototype.registerSequenceRenderer.call(proxy_reader,renderer);
            proxy_reader.gotResult();
        };
    };

    serv.prototype.setupSequenceRenderer = function(renderer) {
        var self = this;
        renderer.addAxisScale('genome',function(pos,layer,inverse) {
            if (layer && layer.scales.has('genomic')) {
                return pos;
            }
            let all_scales = Object.keys(self.result._raw_data.data);
            let identifier = layer.name;
            for (let scale of all_scales) {
                if (layer.scales.has(scale.toUpperCase()) || layer.scales.has(scale.toLowerCase())) {
                    identifier = scale;
                }
            }
            if (inverse) {
                return self.calculateSequencePositionFromProteinPosition(identifier,pos);
            }
            return self.calculateProteinPositionForSequence(identifier,pos);
        });
        var controller_name = 'cds';
        var redraw_alignments = function(sequence_index) {
            if ( ! sequence_index ) {
                sequence_index = 0;
            }
            MASCP.registerLayer(controller_name, { 'fullname' : 'Exons', 'color' : '#000000' });
            MASCP.getLayer(controller_name).scales.add('genomic');

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
                    renderer.renderObjects(controller_name,get_exon_boxes(result, self.reviewed ? self.swissprot : self.uniprot));
                }
            };
            Service.prototype.registerSequenceRenderer.call(proxy_reader,renderer);
            proxy_reader.gotResult();

            self.redrawIntrons = redrawIntrons(renderer,controller_name,scaler_function);
            self.redrawIntrons();
        };

        this.bind('resultReceived',redraw_alignments);

    };

})(GenomeReader);

export default GenomeReader;


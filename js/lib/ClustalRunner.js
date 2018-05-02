/** @fileOverview   Classes for reading data from the Clustal tool
 */
import Service from './Service';
import bean from '../bean';


/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
const ClustalRunner = Service.buildService(function(data) {
                        this._raw_data = data;
                        if (data && typeof data == 'string') {
                            this._raw_data = { 'data' : { 'sequences' : this.getSequences(), 'alignment' : this.getAlignment() } };
                        }
                        return this;
                    });

ClustalRunner.SERVICE_URL = 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/run/';

ClustalRunner.hash = function(str){
    var hash = 0;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = char + (hash << 6) + (hash << 16) - hash;
    }
    return hash;
};

ClustalRunner.prototype.requestData = function()
{
    var sequences = [].concat(this.sequences || []);
    var self = this;
    this.agi = ClustalRunner.hash(this.sequences.join(','))+'';
    if (! ClustalRunner.SERVICE_URL.match(/ebi/)) {
        return {
            type: "POST",
            dataType: "json",
            api_key: MASCP.GATOR_CLIENT_ID,
            data : {
                'sequences' : sequences.join(",")
            }
        };
    }
    bean.fire(self,'running');
    if (this.job_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/status/'+this.job_id
        };
    }
    if (this.result_id) {
        return {
            type: "GET",
            dataType: "txt",
            url: 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/result/'+this.result_id+'/aln-clustalw'
        };
    }

    for (var i = 0; i < sequences.length; i++ ) {
        sequences[i] = ">seq"+i+"\n"+sequences[i];
    }
    return {
        type: "POST",
        dataType: "txt",
        data: { 'sequence' : escape(sequences.join("\n")+"\n"),
                'email'    : 'joshi%40sund.ku.dk'
        }
    };
};

(function(serv) {
    var defaultDataReceived = serv.prototype._dataReceived;

    serv.prototype._dataReceived = function(data,status)
    {
        if (data === null) {
            return defaultDataReceived.call(this,null,status);
        }
        if (typeof data == "object") {
            if (data.status && data.status == "RUNNING") {
                var self = this;
                bean.fire(self,"running");
                setTimeout(function() {
                    self.retrieve(self.agi);
                },5000);
                console.log("Got back running status");
                return;
            }
            return defaultDataReceived.call(this,data,status);
        }

        if (typeof data == "string" && data.match(/^clustalw/)) {
            this.job_id = data;
            this.retrieve(this.agi);
            return;
        }
        if (data.match(/FINISHED/)) {
            this.result_id = this.job_id;
            this.job_id = null;
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },500);
            return;
        }
        if (data.match(/RUNNING/)) {
            var self = this;
            setTimeout(function() {
                self.retrieve(self.agi);
            },500);
            return;
        }

        return defaultDataReceived.call(this,data,status);
    };

})(ClustalRunner);

(function() {
var normalise_insertions = function(inserts) {
    var pos;
    var positions = [];
    var result_data = {};
    for (pos in inserts) {
        if (inserts.hasOwnProperty(pos) && parseInt(pos) >= -1) {
            positions.push(parseInt(pos));
        }
    }
    positions = positions.sort(function sortfunction(a, b){
        return (a - b);
    });

    // From highest to lowest position, loop through and
    // subtract the lengths of previous subtratctions from
    // the final position value.

    for (var i = positions.length - 1; i >= 0; i--) {
        var j = i - 1;
        pos = parseInt(positions[i]);
        var value = inserts[pos];
        while (j >= 0) {
            pos -= inserts[positions[j]].length;
            j--;
        }
        if (! value.match(/^\s+$/)) {
            result_data[pos+1] = value + (result_data[pos+1] || '');
        }
    }
//    delete result_data[0];
    return result_data;
};

var splice_char = function(seqs,index,insertions) {
    for (var i = 0; i < seqs.length; i++) {
        var seq = seqs[i].toString();
        if (seq.charAt(index) != '-') {
            if ( ! insertions[i] ) {
                insertions[i] = {};
                insertions[i][-1] = '';
            }
            insertions[i][index - 1] = seq.charAt(index);
            if (insertions[i][index] && insertions[i][index].match(/\w/)) {
                insertions[i][index-1] += insertions[i][index];
                delete insertions[i][index];
            }
        } else {
            if ( insertions[i] ) {
                insertions[i][index - 1] = ' ';
                if ((insertions[i][index] || '').match(/^\s+$/)) {
                    insertions[i][index-1] += insertions[i][index];
                    delete insertions[i][index];
                }
            }
        }
        seqs[i] = seq.slice(0,index) + seq.slice(index+1);
    }
}

ClustalRunner.Result.prototype.alignToSequence = function(seq_index) {
    if ( ! this._orig_raw_data ) {
        this._orig_raw_data = JSON.stringify(this._raw_data);
    } else {
        this._raw_data = JSON.parse(this._orig_raw_data);
    }
    var seqs = this._raw_data.data.sequences.concat([this._raw_data.data.alignment]);
    var insertions = [];
    var aligning_seq = seqs[seq_index], i = aligning_seq.length - 1;
    for (i; i >= 0; i--) {
        if (aligning_seq.charAt(i) == '-') {
            splice_char(seqs,i,insertions);
        }
    }
    for (i = 0; i < seqs.length; i++) {
        if (insertions[i] && i != seq_index) {
            insertions[i] = normalise_insertions(insertions[i]);
            var seq = seqs[i];
            seqs[i] = { 'sequence' : seq, 'insertions' : insertions[i] };
            seqs[i].toString = function() {
                return this.sequence;
            };
        }
    }
    this._raw_data.data.alignment = seqs.pop();
    this._raw_data.data.sequences = seqs;
};

/*

Test suite for calculating positions

var aligner = 0;
foo = new ClustalRunner.Result();
foo._raw_data = {"data" : { "alignment" : "****************" , "sequences" : [ "----12345678----", "XXXXXXXXXXXXXXXX", "ABCDABC---ABCDAB" ] }};
foo.alignToSequence(aligner);
console.log(foo.getSequences());
console.log(foo.calculatePositionForSequence(0,1));
console.log(foo.calculatePositionForSequence(0,2));
console.log(foo.calculatePositionForSequence(0,3));
console.log(foo.calculatePositionForSequence(0,4));
console.log(foo.calculatePositionForSequence(0,5));
console.log(foo.calculatePositionForSequence(0,6));
console.log(foo.calculatePositionForSequence(0,7));
console.log(foo.calculatePositionForSequence(0,8));

*/
ClustalRunner.Result.prototype.calculatePositionForSequence = function(idx,pos) {
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
                if (i == 0) {
                    i = 1;
                }
                return -1 * i;
            }
        }
    }
    return -1 * seq.length;
};

ClustalRunner.Result.prototype.calculateSequencePositionFromPosition = function(idx,pos) {
    var inserts = this._raw_data.data.sequences[idx].insertions || {};
    var result = pos;
    var actual_position = 0;
    var seq = this._raw_data.data.sequences[idx].toString();
    for (var i = 0 ; i < pos; i++ ) {
        if (inserts[i]) {
            actual_position += inserts[i].length;
        }
        actual_position += 1;
        if (seq.charAt(i) == '-') {
            actual_position -= 1;
        }
    }
    if (actual_position == 0) {
        actual_position += 1;
    }
    return actual_position;
};


})();
//1265 (P)

ClustalRunner.prototype.setupSequenceRenderer = function(renderer) {
    var self = this;

    renderer.sequences = self.sequences;
    renderer.addAxisScale('clustal',function(pos,layer,inverse) {
        let idx = null;
        let seq_identifiers = self.sequences.map(function(seq) { return seq.agi; });
        while (seq_identifiers.length > 0) {
            idx = idx || 0;
            let acc = seq_identifiers.shift();
            if (layer.scales.has(acc)) {
                break;
            }
            idx++;
            if ( seq_identifiers.length === 0) {
                idx = null;
            }
        }
        if (layer.name === 'primarySequence') {
            idx = self.result.aligned_idx;
        }
        if (idx === null) {
            return pos;
        }
        if ( inverse ) {
            return self.result.calculateSequencePositionFromPosition(idx,pos);
        }

        return self.result.calculatePositionForSequence(idx,pos);
    });

    var rendered_bits = [];
    var controller_name = 'isoforms';
    var group_name = 'isoforms';

    var draw_discontinuity = function(canvas,size) {
        var top = -3;
        var left = -2;
        var group = canvas.group();
        var line;
        line = canvas.line(left+1,top+4,left+3,top+1);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        line = canvas.line(left+1,top+6,left+3,top+3);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        line = canvas.line(left+1,top+4,left+3,top+3);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','5');
        group.push(line);
        line = canvas.line(left+1,top+5.3,left+1,top+5.8);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        line = canvas.line(left+1,top+5.9,left+1.5,top+5.9);
        line.setAttribute('stroke','#fcc');
        line.setAttribute('stroke-width','10');
        group.push(line);
        var circle = canvas.circle(left+2.8,top+1.75,1);
        circle.setAttribute('fill','#fff');
        circle.setAttribute('stroke','#ccc');
        circle.setAttribute('stroke-width','10');
        group.push(circle);
        var minus = canvas.text(left+2.25,top+2.25,(size || '÷')+"");
        minus.setAttribute('fill','#ccc');
        minus.setAttribute('font-size',75);
        group.push(minus);
        canvas.firstChild.nextSibling.appendChild(group);
        return group;
    };

    var check_values = function(seq,idx,seqs) {
        var positives = 0;
        var aa = seq.toString().charAt(idx);
        for (var i = 1; i < seqs.length; i++) {
          if (seqs[i].toString().charAt(idx) == aa) {
            positives += 1;
          }
        }
        return (positives / (seqs.length - 1));
    };


    var redraw_alignments = function(sequence_index) {
        var result = self.result;

        while (rendered_bits.length > 0) {
            var bit = rendered_bits.shift();
            renderer.remove(bit.layer,bit);
        }
        result.alignToSequence(sequence_index || 0);

        var aligned = result.getSequences();

        if ( ! renderer.sequence ) {
            renderer.setSequence(aligned[sequence_index])(function() {
                renderer.sequences = self.sequences;
                MASCP.registerGroup(group_name, 'Aligned');
                MASCP.registerLayer(controller_name, { 'fullname' : 'Conservation', 'color' : '#000000' });
                if (renderer.trackOrder.indexOf(controller_name) < 0) {
                    renderer.trackOrder = renderer.trackOrder.concat([controller_name]);
                }
                renderer.showLayer(controller_name);
                renderer.createGroupController(controller_name,group_name);
                redraw_alignments(sequence_index);
            });
            return;
        } else {
            renderer.sequence = aligned[sequence_index];
            renderer.redrawAxis();
        }
        var alignments = result.getAlignment().split('');
        rendered_bits = rendered_bits.concat(renderer.renderTextTrack(controller_name,result.getAlignment().replace(/ /g,' ')));
        rendered_bits.slice(-1)[0].setAttribute('data-spaces','true');
        rendered_bits.slice(-1)[0].layer = controller_name;
        var idxs = ["*",":","."," "].reverse();
        for (var i = 0 ; i < alignments.length; i++ ) {
            rendered_bits.push(renderer.getAA(i+1,controller_name).addBoxOverlay(controller_name,1,idxs.indexOf(alignments[i])/4,{"merge" : true}));
            rendered_bits.slice(-1)[0].layer = controller_name;
        }
        for (var i = 0 ; i < aligned.length; i++) {
            var layname = self.sequences[i].agi.toUpperCase() || "missing"+i;
            var lay = MASCP.registerLayer(layname,{'fullname': self.sequences[i].name || layname.toUpperCase(), 'group' : group_name, 'color' : '#ff0000', 'accession' : self.sequences[i].agi });
            lay.scales.clear();
            lay.scales.add(self.sequences[i].agi);

            lay.fullname = self.sequences[i].name || layname.toUpperCase();
            var text_array = renderer.renderTextTrack(layname,aligned[i].toString());
            rendered_bits = rendered_bits.concat(text_array);
            rendered_bits.slice(-1)[0].layer = layname;
            if (renderer.trackOrder.indexOf(layname.toUpperCase()) < 0) {
              renderer.trackOrder = renderer.trackOrder.concat([group_name]);
            }
            var name = "Isoform "+(i+1);
            if (aligned[i].insertions) {
              for (var insert in aligned[i].insertions) {
                var insertions = aligned[i].insertions;
                if (insert == 0 && insertions[insert] == "") {
                  continue;
                }
                if (insertions[insert].length < 1) {
                    continue;
                }
                var size = insertions[insert].length;
                if (insert == 0) {
                  insert = 1;
                }
                var content = draw_discontinuity(renderer._canvas,size);
                content.setAttribute('fill','#ffff00');
                var an_anno = renderer.getAA(insert,controller_name).addToLayer(layname,
                  { 'content' : content,//'+'+insertions[insert].length,
                    'bare_element': true,
                    'height' : 10,
                    'offset' : -5,
                    'no_tracer' : true
                  })[1];
                an_anno.container.setAttribute('height','300');
                an_anno.container.setAttribute('viewBox','-50 -100 200 300');
                rendered_bits.push(an_anno);
                rendered_bits.slice(-1)[0].layer = layname;
              }
            }
        }
        renderer.zoom = 1;
        renderer.showGroup(group_name);
        renderer.refresh();

    };

    this.bind('resultReceived',function() {
        var self = this;
        redraw_alignments(0);
        self.result.aligned_idx = 0;
        var accs = [];
        self.sequences.forEach(function(seq) {
            accs.push(seq.agi.toUpperCase());
        });
        var current_order = [];
        renderer.bind('orderChanged',function(order) {
            if (self.result) {
                var new_order = order.slice((order.indexOf(controller_name)+1),order.length).filter( function(track) {
                    return accs.indexOf(track) >= 0;
                });
                if (new_order.join(',') == current_order.join(',')) {
                    return;
                }
                current_order = new_order;
                self.result.aligned_idx = accs.indexOf(current_order[0]);

                redraw_alignments(self.result.aligned_idx);
                renderer.refreshScale();
            }
        });
    });

}

ClustalRunner.Result.prototype.getSequences = function() {
    if (this._raw_data && this._raw_data.data && this._raw_data.data.sequences) {
        return [].concat(this._raw_data.data.sequences);
    }
    var bits = this._raw_data.match(/seq\d+(.*)/g);
    var results = [];
    for (var i = 0; i < bits.length; i++) {
        var seqbits = bits[i].match(/seq(\d+)\s+(.*)/);
        if (! results[seqbits[1]]) {
            results[seqbits[1]] = '';
        }
        results[seqbits[1]] += seqbits[2];
    }
    return results;
};

ClustalRunner.Result.prototype.getAlignment = function() {
    if (this._raw_data && this._raw_data.data && this._raw_data.data.alignment) {
        return this._raw_data.data.alignment.toString();
    }
    this._text_data = this._raw_data;
    var re = / {16}(.*)/g;
    var result = "";
    var match = re.exec(this._raw_data);
    while (match !== null) {
        result += match[1];
        match = re.exec(this._raw_data);
    }

    return result;
};

let onlyUnique = (val,idx,arr) => arr.indexOf(val) === idx;

let clustal_emulator = (sequences) => {
    if (sequences.length == 0) {
        return { data: { sequences: [], alignment: "" } };
    }
    let all_aas = sequences.map( seq => seq.split('') );
    let alignment = all_aas[0].map( (aa,pos) =>  all_aas.map( aas => aas[pos] ).filter(onlyUnique).length == 1 ? '*' : ':' ).join('');
    return { data: { sequences: sequences, alignment: alignment }};
};

ClustalRunner.EmulatedClustalRunner = function(renderer) {
    let runner = new ClustalRunner();
    runner.retrieve = function() {
        let datablock = clustal_emulator(this.sequences || []);
        this._dataReceived(datablock);
        this.sequences = this.sequences.map((seq,idx) => { return {  agi: 'seq'+idx, toString: () => seq } });
        this.gotResult();
        this.requestComplete();
    };
    if (renderer) {
        runner.registerSequenceRenderer(renderer);
    }
    return runner;
};

export default ClustalRunner;

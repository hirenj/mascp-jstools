/** @fileOverview   Classes for reading data from the Clustal tool
 */
if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

/** Default class constructor
 *  @class      Service class that will retrieve data from Clustal for given sequences
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.ClustalRunner = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (data && typeof data == 'string') {
                            this._raw_data = { 'data' : { 'sequences' : this.getSequences(), 'alignment' : this.getAlignment() } };
                        }
                        return this;
                    });

MASCP.ClustalRunner.SERVICE_URL = 'http://www.ebi.ac.uk/Tools/services/rest/clustalw2/run/';

MASCP.ClustalRunner.hash = function(str){
    var hash = 0;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = char + (hash << 6) + (hash << 16) - hash;
    }
    return hash;
};

MASCP.ClustalRunner.prototype.requestData = function()
{   
    var sequences = [].concat(this.sequences || []);
    this.agi = MASCP.ClustalRunner.hash(this.sequences.join(','))+'';
    if (! MASCP.ClustalRunner.SERVICE_URL.match(/ebi/)) {
        return {
            type: "POST",
            dataType: "json",
            data : {
                'sequences' : sequences.join(",")
            }
        };
    }
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
    
})(MASCP.ClustalRunner);

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

MASCP.ClustalRunner.Result.prototype.alignToSequence = function(seq_index) {
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
foo = new MASCP.ClustalRunner.Result();
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
MASCP.ClustalRunner.Result.prototype.calculatePositionForSequence = function(idx,pos) {
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


})();
//1265 (P)

var draw_discontinuity = function(canvas) {
    var top = -3;
    var left = -2;
    var group = canvas.group();
    var line;
    line = canvas.line(left+1,top+4,left+3,top+1);
    line.setAttribute('stroke','#f00');
    line.setAttribute('stroke-width','10');
    group.push(line);
    line = canvas.line(left+1,top+6,left+3,top+3);
    line.setAttribute('stroke','#f00');
    line.setAttribute('stroke-width','10');
    group.push(line);
    line = canvas.line(left+1,top+4,left+3,top+3);
    line.setAttribute('stroke','#f00');
    line.setAttribute('stroke-width','5');
    group.push(line);
    line = canvas.line(left+1,top+5.3,left+1,top+5.8);
    line.setAttribute('stroke','#f00');
    line.setAttribute('stroke-width','10');
    group.push(line);
    line = canvas.line(left+1,top+5.9,left+1.5,top+5.9);
    line.setAttribute('stroke','#f00');
    line.setAttribute('stroke-width','10');
    group.push(line);
    var circle = canvas.circle(left+2.8,top+1.75,1);
    circle.setAttribute('fill','#fff');
    circle.setAttribute('stroke','#000');
    circle.setAttribute('stroke-width','10');
    group.push(circle);
    var minus = canvas.text(left+2.25,top+2.25,'÷');
    minus.setAttribute('fill','#000');
    minus.setAttribute('font-size',100);
    group.push(minus);
    return group;
};

MASCP.ClustalRunner.prototype.setupSequenceRenderer = function(renderer) {
    var self = this;

    var elements_to_move = [];

    jQuery(renderer).bind('readerRegistered',function(ev,reader) {
        if (self == reader) {
            return;
        }
        var old = reader.gotResult;
        reader.gotResult = function() {
            var index = 0;
            for (var i = 0; i < self.sequences.length; i++) {
                if (self.sequences[i].agi && self.sequences[i].agi == reader.agi) {
                    index = i;
                }
            }
            var old_get_aas = renderer.getAminoAcidsByPosition;
            var old_get_pep = renderer.getAminoAcidsByPeptide;
            var orig_functions = {};
            renderer._extendElement(orig_functions);
            var extender = function(aas) {
                return function(el) {
                    var result = {};
                    result.original_index = aas.shift();
                    result.addShapeOverlay = function(layername,width,opts) {
                        elements_to_move.push(orig_functions['addShapeOverlay'].call(el,layername,(self.result.calculatePositionForSequence(index,result.original_index+width) - el._index),opts));
                        elements_to_move.slice(-1)[0].layer_idx = index;
                        elements_to_move.slice(-1)[0].aa = result.original_index;
                        elements_to_move.slice(-1)[0].aa_width = width;
                        return elements_to_move.slice(-1)[0];
                    };
                    result.addBoxOverlay = function(layername,width,fraction) {
                        elements_to_move.push(orig_functions['addBoxOverlay'].call(el,layername,(self.result.calculatePositionForSequence(index,result.original_index+width) - el._index),fraction));
                        return elements_to_move.slice(-1)[0];
                    };
                    result.addTextOverlay = function(layername,width,opts) {
                        elements_to_move.push(orig_functions['addTextOverlay'].call(el,layername,(self.result.calculatePositionForSequence(index,result.original_index+width) - el._index),opts));
                        return elements_to_move.slice(-1)[0];
                    };
                    result.addToLayerWithLink = function(layername,url,width) {
                        elements_to_move.push(orig_functions['addToLayerWithLink'].call(el,layername,url,(self.result.calculatePositionForSequence(index,result.original_index+width) - el._index)));
                        return elements_to_move.slice(-1)[0];
                    };
                    for (var method in orig_functions) {
                        if ( ! result[method] ) {
                            result[method] = function() {
                                elements_to_move.push(orig_functions[method].apply(el,arguments));
                                return elements_to_move.slice(-1)[0];
                            };
                        }
                    }
                    return result;
                };
            };
            renderer.getAminoAcidsByPosition = function(aas) {
                var new_aas = aas.map(function(aa) { return Math.abs(self.result.calculatePositionForSequence(index,aa)); });
                return old_get_aas.call(this,new_aas).map(extender(aas));
            };
            renderer.getAminoAcidsByPeptide = function() {};
            old.call(reader);
            renderer.getAminoAcidsByPosition = old_get_aas;
            renderer.getAminoAcidsByPeptide = old_get_pep;
        }
    });

    var rendered_bits = [];
    var controller_name = 'isoform_controller';
    var group_name = 'isoforms';


    var redraw_alignments = function(sequence_index) {
        var result = self.result;

        while (rendered_bits.length > 0) {
            var bit = rendered_bits.shift();
            renderer.remove(bit.layer,bit);
        }
        result.alignToSequence(sequence_index || 0);
        elements_to_move.forEach(function(el) {
            if (el.move) {
                var aa = result.calculatePositionForSequence(el.layer_idx,el.aa);
                var aa_width = result.calculatePositionForSequence(el.layer_idx,el.aa_width);
                el.move(aa,aa_width);
            }
        });
        var aligned = result.getSequences();
        if ( ! renderer.sequence ) {
            renderer.setSequence(aligned[sequence_index])(function() {
                MASCP.registerGroup(group_name, 'Splice variants');
                MASCP.registerLayer(controller_name, { 'fullname' : 'Splices', 'color' : '#000000' });
                if (renderer.trackOrder.indexOf(controller_name) < 0) {
                    renderer.trackOrder.push(controller_name);
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
        rendered_bits.concat(renderer.renderTextTrack(controller_name,result.getAlignment().replace(/ /g,'.')));
        for (var i = 0 ; i < alignments.length; i++ ) {
            rendered_bits.push(renderer.getAA(i+1).addBoxOverlay(controller_name,1,check_values(aligned[0],i,aligned)));
            rendered_bits.slice(-1)[0].layer = controller_name;
        }
        for (var i = 0 ; i < aligned.length; i++) {
            var layname = self.sequences[i].agi || "missing"+i;
            MASCP.registerLayer(layname,{'fullname': layname, 'group' : group_name, 'color' : '#ff0000'});
            var text_array = renderer.renderTextTrack(layname,aligned[i].toString());
            rendered_bits = rendered_bits.concat(text_array);
            rendered_bits.slice(-1)[0].layer = layname;
            if (renderer.trackOrder.indexOf(layname) < 0) {
              renderer.trackOrder.push(layname);
            }
            var name = "Isoform "+(i+1);
            if (aligned[i].insertions) {
              for (var insert in aligned[i].insertions) {
                var insertions = aligned[i].insertions;
                if (insert == 0 && insertions[insert] == "") {
                  continue;
                }
                if (insert == 0) {
                  insert = 1;
                }
                var content = draw_discontinuity(renderer._canvas);
                content.setAttribute('fill','#ffff00');
                var an_anno = renderer.getAA(insert).addToLayer(layname,
                  { 'content' : content,//'+'+insertions[insert].length,
                    'bare_element': true,
                    'height' : 20,
                    'offset' : -2.5,
                    'no_tracer' : true
                  })[1];
                an_anno.container.setAttribute('height','300');
                an_anno.container.setAttribute('viewBox','-50 -100 200 300');
                rendered_bits.push(an_anno);
                rendered_bits.slice(-1)[0].layer = layname;

                // (function(layname,insert,insertions,nm) {
                // an_anno.addEventListener('click',function() {
                //   if (seq_callout !== null && seq_callout.parentNode !== null) {
                //     seq_callout.parentNode.removeChild(seq_callout);
                //   }
                //   seq_callout = null;
                //   seq_callout = renderer.getAA(insert).callout(layname,'insertion_tmpl', { 'width' : insertions[insert].length, 'height' : 10, 'insert' : insertions[insert].match(/(\w{1,10})/g).join(' ')});
                //   seq_callout.addEventListener('click',function() {
                //     this.parentNode.removeChild(this);
                //   });
                //   renderer.refresh();
                // });
                // })(layname,insert,insertions,name);
               // var an_anno = widget_rend.getAA(insert).callout('lay'+i,'insertion_tmpl', { 'width' : aligned[i].insertions[insert].length*10, 'height' : 12, 'insert' : aligned[i].insertions[insert]});
                // console.log(an_anno);
              }
            }
        }
    };

    this.bind('resultReceived',function() {
        var result = this.result;
        redraw_alignments(0);
        var accs = [];
        self.sequences.forEach(function(seq) {
            accs.push(seq.agi);
        });

        renderer.bind('orderChanged',function(e,order) {
            redraw_alignments(accs.indexOf(order[(order.indexOf(controller_name)+1)]));
        });
    });

}

MASCP.ClustalRunner.Result.prototype.getSequences = function() {
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

MASCP.ClustalRunner.Result.prototype.getAlignment = function() {
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

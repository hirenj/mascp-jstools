/**
 * @fileOverview    Retrieve data from the Gator web service
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

(function() {
var url_base = window.location.hostname == 'localhost' ? 'https://test.glycocode.com/api' : '/api';
var cloudfront_host = '';

var data_parser =   function(data) {
  var doc = this.datasetname || 'combined';
  if ( ! data || ! data.data ) {
    return this;
  }
  var actual_data = data.data.filter(function(set) {
    return set.dataset.indexOf(doc) >= 0;
  })[0] || {'data' : [] };

  if (doc.split(',').length > 1) {
    doc = doc.split(',');
    var data_by_mime = {};
    data.data.filter(function(set) {
      return doc.indexOf(set.dataset) >= 0;
    }).forEach(function(set) {
        var mimetype = set.metadata.mimetype;
        set.data.forEach(function(dat) {
            dat.dataset = set.dataset;
            dat.acc = set.acc;
            if (set.metadata.sample) {
              dat.species = set.metadata.sample.species;
            }
        })
        data_by_mime[mimetype] = (data_by_mime[mimetype] || []).concat(set.data);
    });
    actual_data = { 'data' : data_by_mime };
  }

  if (doc == 'glycodomain') {
      actual_data = data.data.filter(function(set) {
          return set.metadata.mimetype == 'application/json+glycodomain';
      })[0] || {'data' : [] };
      console.log(actual_data);
  }
  if (doc == 'combined' || doc == 'homology') {
      var data_by_mime = {};
      data.data.forEach(function(set) {
          var mimetype = set.metadata.mimetype;
          if ( ! mimetype ) {
            return;
          }
          set.data.forEach(function(dat) {
              dat.dataset = set.dataset;
              dat.acc = set.acc;
              if (set.metadata.sample) {
                dat.species = set.metadata.sample.species;
              }
          });
          data_by_mime[mimetype] = (data_by_mime[mimetype] || []).concat(set.data);
      });
      actual_data = { 'data' : data_by_mime };
  }
  if (doc == 'homology') {
    actual_data.alignments = data.data.filter(function(set) { return set.dataset == 'homology_alignment'; })[0].data;
  }
  this._raw_data = actual_data;
  return this;
};

/** Default class constructor
 */
MASCP.GatorDataReader = MASCP.buildService(data_parser);

MASCP.GatorDataReader.prototype.requestData = function() {
  var reader_conf = {
          type: "GET",
          dataType: "json",
          data: { }
      };
  var acc = ( this._requestset || 'combined' ) + '/' + (this.agi || this.acc).toLowerCase();
  var gatorURL = this._endpointURL.slice(-1) == '/' ? this._endpointURL+ acc : this._endpointURL+'/'+acc;
  reader_conf.auth = MASCP.GATOR_AUTH_TOKEN;
  reader_conf.url = gatorURL;
  return reader_conf;
};

var id_token;

Object.defineProperty(MASCP.GatorDataReader, 'ID_TOKEN', {
  get: function() {
    return id_token;
  },
  set: function(token) {
    id_token = token;
    authenticating_promise = null;
  }
});

var authenticating_promise;

var anonymous_login = function() {
  return new Promise(function(resolve,reject) {
      MASCP.Service.request({'url' : url_base + '/login?cachebuster='+(new Date()).getTime(),
                             'type' : 'GET'
                            },function(err,token) {
        if (err) {
          reject(err);
        } else {
          MASCP.GatorDataReader.ID_TOKEN = JSON.parse(token);
          resolve(url_base);
        }
      },true);
    });
};

var reading_was_ok = true;

var reauth_reader = function(reader_class) {
  var current_retrieve = reader_class.prototype.retrieve;
  reader_class.prototype.retrieve = function() {
    var current_arguments = [].slice.call(arguments);
    var self = this;
    this.bind('error',function(err) {
      if (err.status == 401 || err.status == 403) {
        if ( ! self.tried_auth ) {
          self.unbind('error');
          self.tried_auth = true;
          if (reading_was_ok) {
            delete MASCP.GATOR_AUTH_TOKEN;
            authenticating_promise = null;
            reading_was_ok = false;
          }
          authenticate_gator().catch(function(err) {
            throw err;
          }).then(function() {
            reading_was_ok = true;
            self.retrieve.apply(self,current_arguments);
          });
        }
      }
    });
    current_retrieve.apply(self,current_arguments);
  };
};

reauth_reader(MASCP.GatorDataReader);


window.addEventListener("unhandledrejection", function(err, promise) {
  if (err.reason.message == 'Unauthorized' && ! err.reason.handled) {
    err.reason.handled = true;
    bean.fire(MASCP.GatorDataReader,'unauthorized');
  }
});

var authenticate_gator = function() {
    if (authenticating_promise) {
      return authenticating_promise;
    }
    // Need to put this somewhere for the moment
    // Temporary code until we move to a single host
    MASCP.ClustalRunner.SERVICE_URL = url_base + '/tools/clustal';
    MASCP.UniprotReader.SERVICE_URL = url_base + '/data/latest/uniprot';
    if ( ! MASCP.UniprotReader.reauthed ) {
      reauth_reader(MASCP.UniprotReader);
    }
    MASCP.UniprotReader.reauthed = true;

    if ( ! MASCP.GatorDataReader.ID_TOKEN && MASCP.GatorDataReader.anonymous ) {
      console.log("Doing an anonymous login");
      authenticating_promise = anonymous_login().then(function() { authenticating_promise = null; }).then(authenticate_gator);
      return authenticating_promise;
    }

    if ( ! MASCP.GatorDataReader.ID_TOKEN && ! MASCP.GatorDataReader.anonymous ) {
      console.log("We cannot log in");
      authenticating_promise = Promise.reject(new Error('Unauthorized'));
      return authenticating_promise;
    }

    if (MASCP.GATOR_AUTH_TOKEN) {
      console.log("We have existing auth token");
      authenticating_promise = Promise.resolve(url_base);
      return authenticating_promise;
    }
    authenticating_promise = new Promise(function(resolve,reject) {
      MASCP.Service.request({'auth' : MASCP.GatorDataReader.ID_TOKEN,
                             'url' : url_base + '/exchangetoken',
                             'type' : 'POST',
                             'content' : 'application/json'
                            },function(err,token) {
        if (err) {
          if (err.status === 0 || err.status === 401) {
            MASCP.GatorDataReader.ID_TOKEN = null;
            console.log("Rejecting a promise");
            reject(new Error('Unauthorized'));
            return;
          }
          reject(err);
        } else {
          console.log("Back from exchangetoken firing auth");
          MASCP.GATOR_AUTH_TOKEN = JSON.parse(token);
          bean.fire(MASCP.GatorDataReader,'auth',[url_base]);
          resolve(url_base);
        }
      },true);
    });

    return authenticating_promise;
};

MASCP.GatorDataReader.prototype.setupSequenceRenderer = function(renderer) {
    var self = this;
    if (this.datasetname !== 'homology') {
      return;
    }
    renderer.forceTrackAccs = true;
    renderer.addAxisScale('homology',function(pos,accession,inverse) {
        if ( ! self.result || self.agi === accession.name || self.acc === accession.name ) {
          return pos;
        }
        if ( inverse ) {
            return self.result.calculateSequencePositionFromPosition(self.agi || self.acc,accession.name.toLowerCase(),pos);
        }
        return self.result.calculatePositionForSequence(self.agi || self.acc,accession.name.toLowerCase(),pos);
    });
};


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
};

MASCP.GatorDataReader.Result.prototype.makeSequences = function(ref_acc,alignments) {
  var seqs = [];
  var insertions = [];
  var accs = [];
  var ref_cigar = '';
  alignments.forEach(function(align) {
    align.cigar = align.cigar.match(/\d*[MD]/g)
                       .map(function(bit) {
                          return new Array((parseInt(bit.slice(0,-1)) || 1)+1).join( bit.slice(-1) == 'M' ? '.' : '-' );
                       }).join('');
    if (align.uniprot !== ref_acc.toUpperCase()) {
      accs.push(align.uniprot);
      seqs.push(align.cigar)
    } else {
      ref_cigar = align.cigar;
    }
  });
  var aligning_seq = ref_cigar, i = aligning_seq.length - 1;
  for (i; i >= 0; i--) {
      if (aligning_seq.charAt(i) == '-') {
          splice_char(seqs,i,insertions);
      }
  }
  for (i = 0; i < seqs.length; i++) {
      if (insertions[i]) {
          insertions[i] = normalise_insertions(insertions[i]);
          var seq = seqs[i];
          seqs[i] = { 'sequence' : seq, 'insertions' : insertions[i] };
          seqs[i].toString = function() {
              return this.sequence;
          };
      }
  }
  var result = {};
  accs.forEach(function(acc,idx) {
    result[acc.toLowerCase()] = seqs[idx];
  });
  result[ref_acc.toLowerCase()] = ref_cigar.replace('-','');
  return result;
};
})();


MASCP.GatorDataReader.Result.prototype.calculatePositionForSequence = function(ref_acc,idx,pos) {
  if (ref_acc.toLowerCase() === idx.toLowerCase()) {
    return pos;
  }
  if ( ! this.sequences ) {
    this.sequences = this.makeSequences(ref_acc,this._raw_data.alignments);
  }

  var inserts = this.sequences[idx.toLowerCase()].insertions || {};
  var result = pos;
  var actual_position = 0;
  var seq = this.sequences[idx.toLowerCase()].toString();
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

MASCP.GatorDataReader.Result.prototype.calculateSequencePositionFromPosition = function(ref_acc,idx,pos) {
  if (ref_acc.toLowerCase() === idx.toLowerCase()) {
    return pos;
  }
  if ( ! this.sequences ) {
    this.sequences = this.makeSequences(ref_acc,this._raw_data.alignments);
  }
  var inserts = this.sequences[idx.toLowerCase()].insertions || {};
  var result = pos;
  var actual_position = 0;
  var seq = this.sequences[idx.toLowerCase()].toString();
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




var default_result_proto = MASCP.GatorDataReader.Result.prototype;

Object.defineProperty(MASCP.GatorDataReader.prototype, 'datasetname', {
    get: function() {
      return this._datasetname;
    },
    set: function(value) {
      this._datasetname = value;
      this._requestset = (value === 'homology') ? 'homology' : 'combined';
      var alt_result = function(data) {
        this.datasetname = value;
        MASCP.GatorDataReader.Result.apply(this,[data]);
        return this;
      };
      alt_result.prototype = default_result_proto;
      this.__result_class = alt_result;
    }
});
MASCP.GatorDataReader.authenticate = function() {
  return authenticate_gator();
};

var running_promises = {};

var new_retrieve = function(acc) {
  var self = this;
  var orig_arguments = [].slice.call(arguments);
  if (running_promises[acc+'-'+this._requestset]) {
    running_promises[acc+'-'+this._requestset].then(function(result) {
      MASCP.GatorDataReader.prototype.retrieve.apply(self,orig_arguments);
    }).catch(function(err) {
      authenticate_gator().then(function(){
        new_retrieve.apply(self,orig_arguments);
      });
    });
    return;
  }
  running_promises[acc+'-'+this._requestset] = new Promise(function(resolve,reject) {
    self.bind('resultReceived',resolve);
    self.once('error',reject);
  });

  running_promises[acc+'-'+this._requestset].catch(function(err) {
    authenticate_gator().then(function(){ running_promises[acc+'-'+self._requestset] = null });
  });

  MASCP.GatorDataReader.prototype.retrieve.apply(self,orig_arguments);
};

MASCP.GatorDataReader.createReader = function(doc) {
    // Do the auth dance here

    var reader = new MASCP.GatorDataReader(null,url_base+'/data/latest/');
    console.log(doc);
    reader.datasetname = doc;
    // MASCP.Service.CacheService(reader);

    authenticate_gator().then(function() {
      reader.retrieve = new_retrieve;
      bean.fire(reader,'ready');
    });

    return reader;
};

})();
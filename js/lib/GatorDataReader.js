/**
 * @fileOverview    Retrieve data from the Gator web service
 */

import Service from './Service';
import MASCP from './MASCP';
import ClustalRunner from './ClustalRunner';
import UniprotReader from './UniprotReader';
import bean from '../bean';


var localhosts = ['localhost','10.0.2.2'];
var url_base = localhosts.indexOf(window.location.hostname) >= 0 ? 'https://test.glycocode.com/api' : '/api';
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
  if (doc == 'combined' || doc == 'homology' || doc == 'predictions') {
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
const GatorDataReader = Service.buildService(data_parser);

GatorDataReader.prototype.requestData = function() {
  var reader_conf = {
          type: "GET",
          dataType: "json",
          data: { }
      };
  var acc = ( this._requestset || 'combined' ) + '/' + (this.agi || this.acc).toLowerCase();
  var gatorURL = this._endpointURL.slice(-1) == '/' ? this._endpointURL+ acc : this._endpointURL+'/'+acc;
  reader_conf.auth = MASCP.GATOR_AUTH_TOKEN;
  reader_conf.api_key = MASCP.GATOR_CLIENT_ID;
  reader_conf.session_cache = true;
  reader_conf.url = gatorURL;
  return reader_conf;
};

var id_token;

Object.defineProperty(GatorDataReader, 'server', {
  get: function() {
    return url_base.replace('/api','');
  },
  set: function(url) {
    url_base = url.replace('/$','') + '/api';
  }
});

Object.defineProperty(GatorDataReader, 'ID_TOKEN', {
  get: function() {
    return id_token;
  },
  set: function(token) {
    id_token = token;
    authenticating_promise = null;
    bean.fire(GatorDataReader,'idtoken');
  }
});

var is_anonymous;

Object.defineProperty(GatorDataReader, 'anonymous', {
  get: function() {
    return is_anonymous;
  },
  set: function(anon) {
    is_anonymous = anon;
    id_token = null;
    authenticating_promise = null;
  }
});

var authenticating_promise;

var anonymous_login = function() {
  return new Promise(function(resolve,reject) {
      Service.request({'url' : url_base + '/login?cachebuster='+(new Date()).getTime(),
                             'type' : 'GET'
                            },function(err,token) {
        if (err) {
          reject(err);
        } else {
          var auth_token = JSON.parse(token);
          if (typeof auth_token == 'string') {
            auth_token = { id_token: auth_token };
          }
          GatorDataReader.ID_TOKEN = auth_token.id_token;
          resolve(url_base);
        }
      },true);
    });
};

var reading_was_ok = true;

var reauth_reader = function(reader_class) {
  var current_retrieve = reader_class.prototype.retrieve;
  reader_class.prototype.retrieve = function() {
    console.log('Retrieve with auth retry');
    var current_arguments = [].slice.call(arguments);
    var self = this;
    this.bind('error',function(err) {
      if (err.status == 401 || err.status == 403) {
        if ( ! self.tried_auth ) {
          self.unbind('error');
          self.tried_auth = true;
          if (reading_was_ok) {
            delete MASCP.GATOR_AUTH_TOKEN;
            GatorDataReader.ID_TOKEN = null;
            authenticating_promise = null;
            bean.fire(GatorDataReader,'unauthorized');
            reading_was_ok = false;
          }
          authenticate_gator().catch(function(err) {
            console.log("Error after auth",err);
            throw err;
          }).then(function() {
            reading_was_ok = true;
            self.retrieve.apply(self,current_arguments);
          }).catch(function(err) {
            console.log("Died on doing the reauth",err);
          });
        }
      }
    });
    current_retrieve.apply(self,current_arguments);
  };
};

reauth_reader(GatorDataReader);


window.addEventListener("unhandledrejection", function(err, promise) {
  if (err.reason && err.reason.message == 'Unauthorized' && ! err.reason.handled) {
    err.reason.handled = true;
    bean.fire(GatorDataReader,'unauthorized');
    return;
  }
  console.log(err);
});

var authenticate_gator = function() {
    if (authenticating_promise) {
      return authenticating_promise;
    }
    // Need to put this somewhere for the moment
    // Temporary code until we move to a single host
    ClustalRunner.SERVICE_URL = url_base + '/tools/clustal';
    UniprotReader.SERVICE_URL = url_base + '/data/latest/uniprot';
    if ( ! UniprotReader.reauthed ) {
      reauth_reader(UniprotReader);
    }
    UniprotReader.reauthed = true;

    if ( ! GatorDataReader.ID_TOKEN && GatorDataReader.anonymous ) {
      console.log("Doing an anonymous login");
      authenticating_promise = anonymous_login().then(function() { authenticating_promise = null; }).then(authenticate_gator);
      return authenticating_promise;
    }

    if ( ! GatorDataReader.ID_TOKEN && ! GatorDataReader.anonymous ) {
      console.log("We cannot log in without an ID TOKEN, waiting for token");

      authenticating_promise = new Promise(function(resolve,reject) {
        var resolver = function() {
          console.log("Got a new ID token");
          bean.remove(GatorDataReader,'idtoken',resolver);
          MASCP.GATOR_AUTH_TOKEN = GatorDataReader.ID_TOKEN;
          resolve(url_base);
        };
        bean.add(GatorDataReader,'idtoken',resolver);
        setTimeout(function() {
          console.log("Timed out logging in");
          reject(new Error('Timed out'));
        },5000);
      });
      return authenticating_promise;
    }

    authenticating_promise = new Promise(function(resolve,reject) {
      setTimeout(function() {
        MASCP.GATOR_AUTH_TOKEN = GatorDataReader.ID_TOKEN;
        bean.fire(GatorDataReader,'auth',[url_base]);
        resolve(url_base);
      },0);
    });

    return authenticating_promise;
};

GatorDataReader.prototype.setupSequenceRenderer = function(renderer) {
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

GatorDataReader.Result.prototype.makeSequences = function(ref_acc,alignments) {
  var seqs = [];
  var insertions = [];
  var accs = [];
  var ref_cigar = '';
  alignments.forEach(function(align) {
    if ( ! align.cigar && align.cigar_line) {
      align.cigar = align.cigar_line;
      delete align.cigar_line;
    }
    // If the cigar line hasn't already been revivified
    if (! align.cigar.match(/^[\-\.]*$/)) {
      // Expand out the cigar line replacing M with . and D with -
      align.cigar = align.cigar.match(/\d*[MD]/g)
                         .map(function(bit) {
                            return new Array((parseInt(bit.slice(0,-1)) || 1)+1).join( bit.slice(-1) == 'M' ? '.' : '-' );
                         }).join('');
    }
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


GatorDataReader.Result.prototype.calculatePositionForSequence = function(ref_acc,idx,pos) {
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

GatorDataReader.Result.prototype.calculateSequencePositionFromPosition = function(ref_acc,idx,pos) {
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




var default_result = GatorDataReader.Result;

Object.defineProperty(GatorDataReader.prototype, 'datasetname', {
    get: function() {
      return this._datasetname;
    },
    set: function(value) {
      this._datasetname = value;
      this._requestset = (value === 'homology') ? 'homology' : 'combined';
      let alt_result = class extends default_result {
        constructor(data) {
          super(data);
          this.datasetname = value;
          return this;
        }
      };
      GatorDataReader.Result = alt_result;
    }
});
GatorDataReader.authenticate = function() {
  return authenticate_gator();
};

var running_promises = {};

var new_retrieve = function(acc) {
  var self = this;
  var orig_arguments = [].slice.call(arguments);
  if (running_promises[acc+'-'+this._requestset]) {
    running_promises[acc+'-'+this._requestset].then(function(result) {
      GatorDataReader.prototype.retrieve.apply(self,orig_arguments);
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

  GatorDataReader.prototype.retrieve.apply(self,orig_arguments);
};

GatorDataReader.createReader = function(doc) {
    // Do the auth dance here

    var reader = new GatorDataReader(null,url_base+'/data/latest/');
    console.log(doc);
    reader.datasetname = doc;
    // MASCP.Service.CacheService(reader);

    authenticate_gator().then(function() {
      reader.retrieve = new_retrieve;
      bean.fire(reader,'ready');
    });

    return reader;
};

export default GatorDataReader;
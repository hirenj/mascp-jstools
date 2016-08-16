/**
 * @fileOverview    Retrieve data from the Gator web service
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

(function() {
var url_base = '/api';
var cloudfront_host = '';

var data_parser =   function(data) {
  var doc = this.datasetname || 'combined';
  if ( ! data || ! data.data ) {
    return this;
  }
  var actual_data = data.data.filter(function(set) {
      return set.dataset.indexOf(doc) >= 0;
  })[0] || {'data' : [] };
  if (doc == 'glycodomain') {
      actual_data = data.data.filter(function(set) {
          return set.metadata.mimetype == 'application/json+glycodomain';
      })[0] || {'data' : [] };
      console.log(actual_data);
  }
  if (doc == 'combined') {
      var data_by_mime = {};
      data.data.forEach(function(set) {
          var mimetype = set.metadata.mimetype;
          set.data.forEach(function(dat) {
              dat.dataset = set.dataset;
          })
          data_by_mime[mimetype] = (data_by_mime[mimetype] || []).concat(set.data);
      });
      actual_data = { 'data' : data_by_mime };
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
          resolve();
        }
      },true);
    });
};

var authenticate_gator = function() {
    if (authenticating_promise) {
      return authenticating_promise;
    }

    // Need to put this somewhere for the moment
    // Temporary code until we move to a single host
    MASCP.ClustalRunner.SERVICE_URL = url_base + '/tools/clustal';

    if ( ! MASCP.GatorDataReader.ID_TOKEN ) {
      authenticating_promise = anonymous_login().then(function() { authenticating_promise = null; }).then(authenticate_gator);
      return authenticating_promise;
    }

    if (MASCP.GATOR_AUTH_TOKEN && MASCP.LOGGEDIN) {
        authenticating_promise = Promise.resolve();
        return authenticating_promise;
    }
    authenticating_promise = new Promise(function(resolve,reject) {
      MASCP.Service.request({'auth' : MASCP.GatorDataReader.ID_TOKEN,
                             'url' : url_base + '/exchangetoken',
                             'type' : 'POST',
                             'content' : 'application/json'
                            },function(err,token) {
        if (err) {
          reject(err);
        } else {
          MASCP.GATOR_AUTH_TOKEN = JSON.parse(token);
          MASCP.LOGGEDIN = true;
          bean.fire(MASCP.GatorDataReader,'auth',[url_base]);
          resolve();
        }
      },true);
    });

    return authenticating_promise;
};



var default_result_proto = MASCP.GatorDataReader.Result.prototype;

Object.defineProperty(MASCP.GatorDataReader.prototype, 'datasetname', {
    get: function() {
      return this._datasetname;
    },
    set: function(value) {
      this._datasetname = value;
      this._requestset = 'combined';
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
  authenticate_gator();
};

MASCP.GatorDataReader.createReader = function(doc) {
    // Do the auth dance here

    var reader = new MASCP.GatorDataReader(null,url_base+'/data/latest/');
    console.log(doc);
    reader.datasetname = doc;
    // MASCP.Service.CacheService(reader);

    authenticate_gator().then(function() {
        bean.fire(reader,'ready');
    });

    return reader;
};

})();
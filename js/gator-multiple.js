MASCP.Service.BeginCaching();

MASCP.BatchRead = function()
{
    this._make_readers();
};

MASCP.BatchRead.prototype._make_readers = function() {
    this._readers = [];

    var rdr,rdr_id;
    for (rdr_id in READER_CONF) {
        if (READER_CONF.hasOwnProperty(rdr_id)) {
            rdr = READER_CONF[rdr_id];
            var clazz = rdr.definition;
            var reader = new clazz(null, rdr.url);
            this._readers.push(reader);
        }
    }

};


// For every event for a particular class (or null for all classes), bind
// this function to run. e.g. do something whenever a resultReceived for all MASCP.PhosphatReader

MASCP.BatchRead.prototype.bind = function(ev, clazz, func) {
    if (ev == 'resultReceived') {
        ev = '_resultReceived';
    }
    if (ev == 'error') {
        ev = '_error';
    }
    for (var i = 0; i < this._readers.length; i++ ) {
        if (! clazz || this._readers[i].__class__ == clazz) {
            this._readers[i].bind(ev,func);
        }
    }
};

MASCP.BatchRead.prototype.retrieve = function(agi, opts) {

    var self = this;


    if ( ! opts ) {
        opts = {};
    }

    if (self._in_call) {
        var self_func = arguments.callee;
        bean.add(self,'resultReceived', function() {
            bean.remove(self,'resultReceived',arguments.callee);
            self_func.call(self,agi,opts);
        });
        return;
    }

    // for a single reader, events: single_success
    // bound for all readers, events: error, success

    self._in_call = true;


    var result_count = self._readers.length;

    var trigger_done = function() {
        if (result_count === 0) {
            if (opts.success) {
                opts.success.call();
            }
            self._in_call = false;
            bean.fire(self,'resultReceived');
        }
    };
    
    var res_received = function() {
        bean.fire(this,'_resultReceived');
        bean.remove(this,'resultReceived');
        result_count -= 1;
        trigger_done.call(this);
    };
    
    var err_received = function() {
        bean.fire(this,'_error');
        bean.remove(this,'error');
        result_count -= 1;
        trigger_done.call(this);
    };
    
    for (var i = 0; i < this._readers.length; i++ ) {
        var a_reader = this._readers[i];

        a_reader.unbind('resultReceived');
        a_reader.unbind('error');

        a_reader.result = null;
        a_reader.agi = agi;
                    
        if (opts.single_success) {
            a_reader.bind('resultReceived',opts.single_success);
        }
        if (opts.error) {
            a_reader.bind('error', opts.error);
        }

        a_reader.bind('resultReceived',res_received);
        a_reader.bind('error',err_received);

        a_reader.retrieve();
    }
};

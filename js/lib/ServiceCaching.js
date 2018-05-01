
import Service from './Service';
import MASCP from './MASCP';

var get_db_data, store_db_data, search_service, clear_service, find_latest_data, data_timestamps, sweep_cache, cached_accessions, begin_transaction, end_transaction,first_accession;

var max_age = 0, min_age = 0;

class CachingService extends Service {
}

CachingService.BeginCaching = function() {
    CachingService.CacheService(CachingService.prototype);
};

// To do 7 days ago, you do
// var date = new Date();
// date.setDate(date.getDate() - 1);
// Service.SetMinimumFreshnessAge(date);

// Set the minimum age if you want nothing OLDER than this date
CachingService.SetMinimumAge = function(date) {
    if (date === 0) {
        min_age = 0;
    } else {
        min_age = date.getTime();
    }
};

// Set the maximum age if you want nothing NEWER than this date
CachingService.SetMaximumAge = function(date) {
    if (date === 0) {
        max_age = 0;
    } else {
        max_age = date.getTime();
    }
};

CachingService.SweepCache = function(date) {
    if (! date) {
        date = (new Date());
    }
    sweep_cache(date.getTime());
};

CachingService.CacheService = function(reader) {
    if ((reader.prototype && reader.prototype.retrieve.caching) || reader.retrieve.caching) {
        return;
    }
    var _oldRetrieve = reader.retrieve;
    var has_avoid;
    reader.retrieve = function(agi,cback) {
        var self = this;
        var id = agi ? agi : self.agi;
        if ( ! id ) {
            _oldRetrieve.call(self,id,cback);
            return self;
        }

        id = id.toLowerCase();
        self.agi = id;

        if (self.avoid_database) {
            if (has_avoid) {
                return;
            }
            has_avoid = self._dataReceived;
            self._dataReceived = (function() { return function(dat) {
                    var res = has_avoid.call(this,dat);
                    var id = self.agi;
                    if (res && this.result && this.result._raw_data !== null) {
                        store_db_data(id,this.toString(),this.result._raw_data || {});
                    }
                    dat = {};
                    return res;
                };})();
            cback.call(self);
            return;
        }
        if (has_avoid && ! self.avoid_database) {
            self._dataReceived = has_avoid;
            has_avoid = null;
            cback.call(self);
            return;
        }

        get_db_data(id,self.toString(),function(err,data) {
            if (data) {
                if (cback) {
                    self.result = null;
                    var done_func = function(err) {
                        bean.remove(self,"resultReceived",arguments.callee);
                        bean.remove(self,"error",arguments.callee);
                        cback.call(self,err);
                    };
                    bean.add(self,"resultReceived",done_func);
                    bean.add(self,"error", done_func);
                }

                var received_flag = self._dataReceived(data,"db");

                if (received_flag) {
                    self.gotResult();
                }

                if (received_flag !== null) {
                    self.requestComplete();
                } else {
                    self.requestIncomplete();
                }

            } else {
                var old_received = self._dataReceived;
                self._dataReceived = (function() { return function(dat,source) {
                    var res = old_received.call(this,dat,source);
                    if (res && this.result && this.result._raw_data !== null) {
                        store_db_data(id,this.toString(),this.result._raw_data || {});
                    }
                    this._dataReceived = null;
                    this._dataReceived = old_received;
                    dat = {};
                    return res;
                };})();
                var old_url = self._endpointURL;
                // If we have a maximum age, i.e. we don't want anything newer than a date
                // we should not actually do a request that won't respect that.
                // We can set a minimum age, since the latest data will be, by definition be the latest!
                if ((max_age !== 0)) {
                    self._endpointURL = null;
                }
                _oldRetrieve.call(self,id,cback);
                self._endpointURL = old_url;
            }             
        });
        return self;
    };
    reader.retrieve.caching = true;
};

CachingService.FindCachedService = function(service,cback) {
    var serviceString = service.toString();
    search_service(serviceString,cback);
    return true;
};

CachingService.CachedAgis = function(service,cback) {
    var serviceString = service.toString();
    cached_accessions(serviceString,cback);
    return true;
};

CachingService.FirstAgi = function(service,cback) {
    var serviceString = service.toString();
    first_accession(serviceString,cback);
    return true;
};

CachingService.ClearCache = function(service,agi,callback) {
    var serviceString = service.toString();
    if ( ! callback ) {
        callback = function() {};
    }
    clear_service(serviceString,agi,callback);
    return true;
};

CachingService.HistoryForService = function(service,cback) {
    var serviceString = service.toString();
    data_timestamps(serviceString,null,cback);
};

CachingService.Snapshot = function(service,date,wanted,cback) {
    var serviceString = service.toString();
    get_snapshot(serviceString,null,wanted,cback);
};

var transaction_ref_count = 0;
var waiting_callbacks = [];
CachingService.BulkOperation = function(callback) {
    transaction_ref_count++;
    var trans = function(callback) {
        if ( ! callback ) {
            callback = function() {};
        }
        transaction_ref_count--;
        waiting_callbacks.push(callback);
        if (transaction_ref_count == 0) {
            end_transaction(function(err) {
                waiting_callbacks.forEach(function(cback) {
                    cback(err);
                });
                waiting_callbacks = [];
            });
        }
    };
    begin_transaction(callback,trans);
    return trans;
};

var setup_idb = function(idb) {
    var transaction_store_db;
    var transaction_find_latest;
    var transaction_data = [];
    begin_transaction = function(callback,trans) {
        if (transaction_store_db != null) {
            setTimeout(function() {
                callback.call({ "transaction" : trans });
            },0);
            return false;
        }
        transaction_store_db = store_db_data;
        store_db_data = function(acc,service,data) {
            transaction_data.push([acc,service,data]);
        };
        setTimeout(function() {
            callback.call({ "transaction" : trans });
        },0);
        return true;
    };

    end_transaction = function(callback) {
        if (transaction_store_db === null) {
            callback(null);
            return;
        }
        store_db_data = transaction_store_db;
        transaction_store_db = null;
        var trans = idb.transaction(["cached"], "readwrite");
        var store = trans.objectStore("cached");
        trans.oncomplete = function(event) {
            callback(null);
        };
        trans.onerror = function(event) {
            callback(event.target.errorCode);
        };
        while (transaction_data.length > 0) {
            var row = transaction_data.shift();
            var acc = row[0];
            var service = row[1];
            var data = row[2];
            if (typeof data != 'object' || data.constructor.name !== 'Object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
                continue;
            }
            var dateobj = data.retrieved ? data.retrieved : (new Date());
            if (typeof dateobj === 'string' || typeof dateobj === 'number') {
                dateobj = new Date(dateobj);
            }
            dateobj.setUTCHours(0);
            dateobj.setUTCMinutes(0);
            dateobj.setUTCSeconds(0);
            dateobj.setUTCMilliseconds(0);
            var reporter = insert_report_func(acc,service);
            var datetime = dateobj.getTime();
            data.id = [acc,service,datetime];
            data.acc = acc;
            data.service = service;
            if (window.msIndexedDB) {
                data.serviceacc = service+acc;
            }
            data.retrieved = datetime;
            var req = store.put(data);
            req.onerror = reporter;
        }
    };

    var insert_report_func = function(acc,service) {
        return function(err,rows) {
            if ( ! err && rows) {
            }
        };
    };

    store_db_data = function(acc,service,data) {
        var trans = idb.transaction(["cached"], "readwrite");
        var store = trans.objectStore("cached");
        if (typeof data != 'object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
            return;
        }
        var dateobj = data.retrieved ? data.retrieved : (new Date());
        if (typeof dateobj === 'string' || typeof dateobj === 'number') {
            dateobj = new Date(dateobj);
        }
        dateobj.setUTCHours(0);
        dateobj.setUTCMinutes(0);
        dateobj.setUTCSeconds(0);
        dateobj.setUTCMilliseconds(0);
        var reporter = insert_report_func(acc,service);
        var datetime = dateobj.getTime();
        data.id = [acc,service,datetime];
        data.acc = acc;
        if (window.msIndexedDB) {
            data.serviceacc = service+acc;
        }
        data.service = service;
        data.retrieved = datetime;
        var req = store.put(data);
        // req.onsuccess = reporter;
        req.onerror = reporter;
    };

    get_db_data = function(acc,service,cback) {
        var timestamps = max_age ? [min_age,max_age] : [min_age, (new Date()).getTime()];
        return find_latest_data(acc,service,timestamps,cback);
    };

    find_latest_data = function(acc,service,timestamps,cback) {
        if ( ! acc ) {
            cback.call();
            return;
        }
        var trans = idb.transaction(["cached"],"readonly");
        var store = trans.objectStore("cached");
        var idx = store.index(window.msIndexedDB ? "entries-ms" : "entries");
        var max_stamp = -1;
        var result = null;
        var range = IDBKeyRange.only(window.msIndexedDB ? service+acc : [acc,service]);
        idx.openCursor(range).onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                var ts = window.msIndexedDB ? cursor.value.retrieved : cursor.primaryKey[2];
                var c_acc = window.msIndexedDB ? cursor.value.acc : cursor.primaryKey[0];
                var serv = window.msIndexedDB ? cursor.value.service : cursor.primaryKey[1];
                if (ts >= timestamps[0] && ts <= timestamps[1] ) {
                    if (ts > max_stamp && c_acc == acc && serv == service) {
                        result = cursor.value;
                        max_stamp = ts;
                        result.retrieved = new Date(ts);
                    }
                }
                cursor.continue();
            } else {
                if (result) {
                    // result = result.data
                }
                cback.call(null,null,result);
            }
        };
    };

    sweep_cache = function(timestamp) {
        var trans = idb.transaction(["cached"],"readwrite");
        var store = trans.objectStore("cached");
        var idx = store.index("timestamps");
        var results = [];
        idx.openKeyCursor(null, "nextunique").onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if ( timestamp >= cursor.key[1] ) {
                    store.delete(cursor.primaryKey);
                }
                cursor.continue();
            }
        };
    };

    data_timestamps = function(service,timestamps,cback) {

        if (! timestamps || typeof timestamps != 'object' || ! timestamps.length ) {
            timestamps = [0,(new Date()).getTime()];
        }

        var trans = idb.transaction(["cached"],"readonly");
        var store = trans.objectStore("cached");
        var idx = store.index("timestamps");
        var results = [];
        idx.openKeyCursor(null, "nextunique").onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if (cursor.key[0] == service && timestamps[0] <= cursor.key[1] && timestamps[1] >= cursor.key[1] ) {
                    results.push(new Date(parseInt(cursor.key[1])));
                }
                cursor.continue();
            } else {
                cback.call(null,results);
            }
        };
    };

    clear_service = function(service,acc,callback) {
        var trans = idb.transaction(["cached"],"readwrite");
        var store = trans.objectStore("cached");
        var idx = store.index("services");
        var range = IDBKeyRange.only(service);
        idx.openCursor(range).onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                if ((! acc || (cursor.value.acc == acc) )) {
                    if (window.msIndexedDB) {
                        store.delete(cursor.value.serviceacc);
                    } else {
                        store.delete(cursor.value.id ? cursor.value.id : cursor.primaryKey );
                    }
                }
                cursor.continue();
            }
        };
        trans.oncomplete = function() {
            callback.call(Service);
        };
    };

    search_service = function(service,cback) {
        var trans = idb.transaction(["cached"],"readonly");
        var store = trans.objectStore("cached");
        var idx = store.index("services");
        var results = [];
        var range = IDBKeyRange.only(service);
        idx.openKeyCursor(range, "nextunique").onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                results.push(cursor.key);
                cursor.continue();
            } else {
                cback.call(Service,results);
            }
        };
    };
    first_accession = function(service,cback) {
        var trans = idb.transaction(["cached"],"readonly");
        var store = trans.objectStore("cached");
        var idx = store.index("services");
        var range = IDBKeyRange.only(service);
        idx.openCursor(range,"nextunique").onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                cback.call(Service,cursor.value.acc);
            } else {
                cback.call(Service,null);
            }
        };
    };
    cached_accessions = function(service,cback) {
        var trans = idb.transaction(["cached"],"readonly");
        var store = trans.objectStore("cached");
        var idx = store.index("services");
        var results = [];
        var range = IDBKeyRange.only(service);
        idx.openCursor(range).onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                results.push(cursor.value.acc);
                cursor.continue();
            } else {
                cback.call(Service,results);
            }
        };
    };
};
var setup_websql = function(db) {
    db.all('SELECT version from versions where tablename = "datacache"',function(err,rows) { 
        var version = (rows && rows.length > 0) ? rows[0].version : null;
        if (version == 1.3) {
            if (MASCP.events) {
                MASCP.events.emit('ready');            
            }
            if (MASCP.ready) {
                MASCP.ready();
                MASCP.ready = true;
            } else {
                MASCP.ready = true;
            }
            return;                
        }
        
        if (! version || version == "" || version < 1.0 ) {
            db.exec('CREATE TABLE if not exists versions (version REAL, tablename TEXT);');
            db.exec('CREATE TABLE if not exists "datacache" (agi TEXT,service TEXT,retrieved REAL,data TEXT);',function(err) { if (err && err != "Error: not an error") { throw err; } });
            db.exec('DELETE FROM versions where tablename = "datacache"');
            db.exec('INSERT INTO versions(version,tablename) VALUES(1.1,"datacache");',function(err,rows) {
                if ( ! err ) {
//                        console.log("Upgrade to 1.1 completed");
                }
            });
            version = 1.1;
        }
        if (version < 1.2) {
            db.exec('DROP TABLE if exists datacache_tmp;');
            db.exec('CREATE TABLE if not exists datacache_tmp (acc TEXT,service TEXT,retrieved REAL,data TEXT);');
            db.exec('INSERT INTO datacache_tmp(acc,service,retrieved,data) SELECT agi,service,retrieved,data FROM datacache;');
            db.exec('DROP TABLE datacache;');
            db.exec('ALTER TABLE datacache_tmp RENAME TO datacache;');
            db.exec('CREATE INDEX accessions on datacache(acc);');
            db.exec('CREATE INDEX accessions_service on datacache(acc,service);');
            db.exec('DELETE FROM versions where tablename = "datacache"');
            db.exec('INSERT INTO versions(version,tablename) VALUES(1.2,"datacache");',function(err,rows) {
                if ( ! err ) {
//                          console.log("Upgrade to 1.2 completed");
                }
            });
            version = 1.2;
        }
        if (version < 1.3) {
            db.exec('CREATE INDEX if not exists services on datacache(service);');
            db.exec('DELETE FROM versions where tablename = "datacache"');
            db.exec('INSERT INTO versions(version,tablename) VALUES(1.3,"datacache");',function(err,rows) {
                if ( ! err ) {
                    if (MASCP.events) {
                        MASCP.events.emit('ready');            
                    }
                    if (MASCP.ready) {
                        MASCP.ready();
                        MASCP.ready = true;
                    } else {
                        MASCP.ready  = true;
                    }
                }
            });
            version = 1.3;                
        }
    });

    begin_transaction = function(callback,trans) {
        callback.call({ "transaction" : trans });
    };
    end_transaction = function(callback) {
        callback();
    };

    sweep_cache = function(timestamp) {
        db.all("DELETE from datacache where retrieved <= ? ",[timestamp],function() {});
    };
    
    clear_service = function(service,acc,callback) {
        var servicename = service;
        servicename += "%";
        if ( ! acc ) {
            db.all("DELETE from datacache where service like ? ",[servicename],function() { callback.call(Service); });
        } else {
            db.all("DELETE from datacache where service like ? and acc = ?",[servicename,acc.toLowerCase()],function() { callback.call(Service); });
        }
        
    };
    
    search_service = function(service,cback) {
        db.all("SELECT distinct service from datacache where service like ? ",[service+"%"],function(err,records) {
            var results = {};
            if (records && records.length > 0) {
                records.forEach(function(record) {
                    results[record.service] = true;
                });
            }
            var uniques = [];
            for (var k in results) {
                if (results.hasOwnProperty(k)) {                    
                    uniques.push(k);
                }
            }
            cback.call(Service,uniques);
            return uniques;
        });
    };

    first_accession = function(service,cback) {
        db.all("SELECT distinct acc from datacache where service = ? limit 1",[service],function(err,records) {
            if (! records || records.length < 1) {
                cback.call(Service,null);
            } else {
                cback.call(Service,records[0].acc);
            }
        });
    };

    
    cached_accessions = function(service,cback) {
        db.all("SELECT distinct acc from datacache where service = ?",[service],function(err,records) {
            var results = [];
            for (var i = 0; i < records.length; i++ ){
                results.push(records[i].acc);
            }
            cback.call(Service,results);
        });
    };
    
    get_snapshot = function(service,timestamps,wanted,cback) {
        if (! timestamps || typeof timestamps != 'object' || ! timestamps.length ) {
            timestamps = [0,(new Date()).getTime()];
        }
        var sql;
        var args = [service,timestamps[0],timestamps[1]];
        if (wanted && Array.isArray(wanted)) {
            var question_marks = (new Array(wanted.length+1).join(',?')).substring(1);
            args = args.concat(wanted);
            sql = "SELECT * from datacache where service = ? AND retrieved >= ? AND retrieved <= ? AND acc in ("+question_marks+") ORDER BY retrieved ASC";
        } else {
            if (wanted && /^\d+$/.test(wanted.toString())) {
                sql = "SELECT * from datacache where service = ? AND retrieved >= ? AND retrieved <= ? LIMIT ? ORDER BY retrieved ASC";
                args = args.concat(parseInt(wanted.toString()));
            } else {
                sql = "SELECT * from datacache where service = ? AND retrieved >= ? AND retrieved <= ? ORDER BY retrieved ASC";
            }
        }
        db.all(sql,args,function(err,records) {
            records = records || [];
            var results = {};
            records.forEach(function(record) {
                var data = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
                if (data) {
                    data.retrieved = new Date(parseInt(record.retrieved));
                }
                if (results[record.acc] && results[record.acc].retrieved > record.retrieved) {
                    return;
                }
                results[record.acc] = record;
            });
            cback.call(null,null,results);
        });
    };

    get_db_data = function(acc,service,cback) {
        var timestamps = max_age ? [min_age,max_age] : [min_age, (new Date()).getTime()];
        return find_latest_data(acc,service,timestamps,cback);
    };

    var insert_report_func = function(acc,service) {
        return function(err,rows) {
            if ( ! err && rows) {
//                    console.log("Caching result for "+acc+" in "+service);
            }
        };
    };

    store_db_data = function(acc,service,data) {
        if (typeof data != 'object' || (((typeof Document) != 'undefined') && data instanceof Document)) {
            return;
        }
        var str_rep;
        try {
            str_rep = JSON.stringify(data);
        } catch (err) {
            return;
        }
        var dateobj = data.retrieved ? data.retrieved : (new Date());
        if (typeof dateobj == 'string') {
            dateobj = new Date();
        }
        dateobj.setUTCHours(0);
        dateobj.setUTCMinutes(0);
        dateobj.setUTCSeconds(0);
        dateobj.setUTCMilliseconds(0);
        var datetime = dateobj.getTime();
        data = {};
        db.all("INSERT INTO datacache(acc,service,retrieved,data) VALUES(?,?,?,?)",[acc,service,datetime,str_rep],insert_report_func(acc,service));
    };

    find_latest_data = function(acc,service,timestamps,cback) {
        var sql = "SELECT * from datacache where acc=? and service=? and retrieved >= ? and retrieved <= ? ORDER BY retrieved DESC LIMIT 1";
        var args = [acc,service,timestamps[0],timestamps[1]];            
        db.all(sql,args,function(err,records) {
            if (records && records.length > 0 && typeof records[0] != "undefined") {
                var data = typeof records[0].data === 'string' ? JSON.parse(records[0].data) : records[0].data;
                if (data) {
                    data.retrieved = new Date(parseInt(records[0].retrieved));
                }
                cback.call(null,null,data);
            } else {
                cback.call(null,null,null);
            }
        });
    };
    
    data_timestamps = function(service,timestamps,cback) {
        if (! timestamps || typeof timestamps != 'object' || ! timestamps.length ) {
            timestamps = [0,(new Date()).getTime()];
        }
        var sql = "SELECT distinct retrieved from datacache where service=? and retrieved >= ? and retrieved <= ? ORDER BY retrieved ASC";
        var args = [service,timestamps[0],timestamps[1]];
        db.all(sql,args,function(err,records) {
            var result = [];
            if (records && records.length > 0 && typeof records[0] != "undefined") {
                for (var i = records.length - 1; i >= 0; i--) {
                    result.push(new Date(parseInt(records[i].retrieved)));
                }
            }
            cback.call(null,result);
        });            
    };
};
var setup_localstorage = function() {
    sweep_cache = function(timestamp) {
        if ("localStorage" in window) {
            var keys = [];
            for (var i = 0, len = localStorage.length; i < len; i++) {
                keys.push(localStorage.key(i));
            }
            var key = keys.shift();
            while (key) {
                if (new RegExp("^MASCP.*").test(key)) {
                    var data = localStorage[key];
                    if (data && typeof data === 'string') {
                        var datablock = JSON.parse(data);
                        datablock.retrieved = timestamp;
                        localStorage.removeItem(key);
                    }
                }
                key = keys.shift();
            }
        }
    };
    
    clear_service = function(service,acc,callback) {
        if ("localStorage" in window) {
            var keys = [];
            for (var i = 0, len = localStorage.length; i < len; i++) {
                keys.push(localStorage.key(i));
            }
            var key = keys.shift();
            while (key) {
                if ((new RegExp("^"+service+".*"+(acc?"#"+acc.toLowerCase()+"$" : ""))).test(key)) {
                    localStorage.removeItem(key);
                    if (acc) {
                        return;
                    }
                }
                key = keys.shift();
            }
            callback.call(Service);
        }            
    };
    
    search_service = function(service,cback) {
        var results = {};
        if ("localStorage" in window) {
            var key;
            var re = new RegExp("^"+service+".*");
            for (var i = 0, len = localStorage.length; i < len; i++){
                key = localStorage.key(i);
                if (re.test(key)) {                        
                    results[key.replace(/\.#.*$/g,'')] = true;
                }
            }
        }

        var uniques = [];
        for (var k in results) {
            if (results.hasOwnProperty(k)) {
                uniques.push(k);
            }
        }

        cback.call(CachingService,uniques);

        return uniques;
    };

    first_accession = function(service,cback) {
        if ("localStorage" in window) {
            var key;
            var re = new RegExp("^"+service);
            for (var i = 0, len = localStorage.length; i < len; i++){
                key = localStorage.key(i);
                if (re.test(key)) {
                    key = key.replace(service,'');
                    cback.call(CachingService,key);
                    return;
                }
            }
        }
        cback.call(CachingService,null);
    };

    cached_accessions = function(service,cback) {
        if ("localStorage" in window) {
            var key;
            var re = new RegExp("^"+service);
            for (var i = 0, len = localStorage.length; i < len; i++){
                key = localStorage.key(i);
                if (re.test(key)) {
                    key = key.replace(service,'');
                    results[key] = true;
                }
            }
        }

        var uniques = [];
        for (var k in results) {
            if (results.hasOwnProperty(k)) {
                uniques.push(k);
            }
        }

        cback.call(CachingService,uniques);
    };

    get_db_data = function(acc,service,cback) {
        var data = localStorage[service.toString()+".#"+(acc || '').toLowerCase()];
        if (data && typeof data === 'string') {
            var datablock = JSON.parse(data);
            datablock.retrieved = new Date(parseInt(datablock.retrieved));
            cback.call(null,null,datablock);
        } else {
            cback.call(null,null,null);
        }
        
    };
    
    store_db_data = function(acc,service,data) {
        if (data && (typeof data !== 'object' || data instanceof Document || data.nodeName)){
            return;
        }
        data.retrieved = (new Date()).getTime();
        localStorage[service.toString()+".#"+(acc || '').toLowerCase()] = JSON.stringify(data);
    };

    find_latest_data = function(acc,service,timestamp,cback) {
        // We don't actually retrieve historical data for this
        return get_db_data(acc,service,cback);
    };

    data_timestamps = function(service,timestamp,cback) {
        cback.call(null,[]);
    };
    
    begin_transaction = function(callback) {
        // No support for transactions here. Do nothing.
        setTimeout(function() {
            callback.call();
        },0);
    };
    end_transaction = function(callback) {
        // No support for transactions here. Do nothing.
        setTimeout(function(){
            callback();
        },0);
    };

    if (MASCP.events) {
        MASCP.events.emit('ready');
    }
    setTimeout(function() {
        if (MASCP.ready) {
            MASCP.ready();
            MASCP.ready = true;
        } else {
            MASCP.ready = true;
        }
    },100);
};

var db,idb;

if ("openDatabase" in window || "indexedDB" in window) {

    if ("indexedDB" in window) {

        /* Versioning of DB schema */

        var change_func = function(version,transaction) {
            var db = transaction.db;
            if (db.objectStoreNames && db.objectStoreNames.contains("cached")) {
                db.deleteObjectStore("cached");
            }
            var keypath = window.msIndexedDB ? "serviceacc" : "id";
            var store = db.createObjectStore("cached", { keyPath: keypath });
            store.createIndex("entries", [ "acc" , "service" ], { unique : false });
            if (window.msIndexedDB) {
                store.createIndex("entries-ms","serviceacc", { unique : false });
            }
            store.createIndex("timestamps", [ "service" , "retrieved" ], { unique : false });
            store.createIndex("services", "service", { unique : false });
            transaction.oncomplete = function() {
                database_ready(db);
                database_ready = function() {};
            };
        };


        idb = true;
        var db_version = 2;
        var req = indexedDB.open("datacache",db_version);

        req.onupgradeneeded = function (e) {
          var transaction = req.transaction;
          change_func(e.oldVersion, transaction);
        };

        var database_ready = function(db) {
            if (db) {
                idb = db;
            }
            setup_idb(idb);

            if (MASCP.events) {
                MASCP.events.emit("ready");
            }
            if (MASCP.ready) {
                MASCP.ready();
                MASCP.ready = true;
            } else {
                MASCP.ready = true;
            }
        };
        req.onerror = function(e) {
            console.log("Error loading Database");
            setup_localstorage();
            // setTimeout(function() {
            //     indexedDB.deleteDatabase("datacache").onsuccess = function() {

            //     }
            // },0);
        }
        req.onsuccess = function(e) {
            idb = e.target.result;
            var version = db_version;
            if (idb.version != Number(version)) {
                var versionRequest = db.setVersion(ver);
                versionRequest.onsuccess = function (e) {
                    var transaction = versionRequest.result;
                    change_func(oldVersion, transaction);
                };
            } else {
                database_ready();
            }
        };
    } else {
        try {
            db = openDatabase("cached","","MASCP Gator cache",1024*1024);
        } catch (err) {
            throw err;
        }
        db.all = function(sql,args,callback) {
            this.exec(sql,args,callback);
        };
        db.exec = function(sql,args,callback) {
            var self = this;
            var sqlargs = args;
            var cback = callback;
            if (typeof cback == 'undefined' && sqlargs && Object.prototype.toString.call(sqlargs) != '[object Array]') {
                cback = args;
                sqlargs = null;
            }
            self.transaction(function(tx) {
                tx.executeSql(sql,sqlargs,function(tx,result) {
                    var res = [];
                    for (var i = 0; i < result.rows.length; i++) {
                        res.push(result.rows.item(i));
                    }
                    if (cback) {
                        cback.call(db,null,res);
                    }
                },function(tx,err) {
                    if (cback) {
                        cback.call(db,err);
                    }
                });
            });
        };
    }
}
if (typeof idb !== 'undefined') {
    // Do nothing
} else if (typeof db !== 'undefined') {
    setup_websql(db);
} else if ("localStorage" in window) {
    setup_localstorage();
} else {

    sweep_cache = function(timestamp) {
    };
    
    clear_service = function(service,acc) {
    };
    
    search_service = function(service,cback) {
    };

    cached_accessions = function(service,cback) {
        cback.call(CachingService,[]);
    };

    get_db_data = function(acc,service,cback) {
        cback.call(null,null,null);
    };
    
    store_db_data = function(acc,service,data) {
    };

    find_latest_data = function(acc,service,timestamp,cback) {
        // We don't actually retrieve historical data for this
        cback.call(null,[]);
    };

    data_timestamps = function(service,timestamp,cback) {
        cback.call(null,[]);
    };
    
    begin_transaction = function(callback,trans) {
        // No support for transactions here. Do nothing.
        setTimeout(function(){
            callback({"transaction": trans});
        },0);
    };
    end_transaction = function(callback) {
        // No support for transactions here. Do nothing.
        setTimeout(function(){
            callback();
        },0);
    };
}


export default CachingService;
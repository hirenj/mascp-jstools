#!/usr/bin/env node

/*
File format should be

IDENTIFIER,{ ... JSON ...}
IDENTIFIER,{ ... JSON ...}

In UTF8 format

*/




var argv =  require('optimist')
            .usage('Load data into the cache\n'+
                   'Usage:\n'+
                   ' cat [file] | $0 --reader [Reader class] --date YYYY/MM/DD --verbose\n'+
                   'OR\n '+
                   '$0 --file [file] --reader [Reader class] --date YYYY/MM/DD --verbose\n\n'+
                   'For large data loading, use the pipe format, which runs a lot faster.\n\n'+
                   'Write data from the cache\n'+
                   '$0 --reader [Reader class] --date YYYY/MM/DD --write --verbose\n')
            .demand(['reader'])
            .argv;

var events = require('events'),
    fs = require('fs'),
    carrier = require('carrier'),
    sys = require('sys');

var read_csv = function(filename) {
        var lines = fs.readFileSync(filename,"utf8").split("\n");
        var data = [];
        for (var i = lines.length - 1; i >= 0; i-- ) {
            data.push(lines[i].split(/,(.+)/));
        }
        return data.reverse();
};

var get_stdin = function(cback,endcback) {
    process.stdin.resume();
    process.stdin.on('end',function() {
        endcback();
    });
    carrier.carry(process.stdin,function(line) {
        cback.call(null,line.split(/,(.+)/));
    })
};
MASCP = require('../dist/js/mascp-jstools.services.js');
MASCP.events.once('ready',function() {
    var date = argv.date ? new Date(Date.parse(argv.date + " 0:00 GMT")) : new Date();
    var classname = argv.reader;

    var retrieve_func = function(current_agi,cback) {
        if (current_agi === null || typeof current_agi == 'undefined') {
            cback.call(this);
        }
        var current_data = this._data;
        var data_block = JSON.parse(current_data);
        data_block.retrieved = date;
        this.agi = current_agi;
        this.result = {};
        this.result._raw_data = data_block;
        this._dataReceived(data_block);
        data_block = {};
        this.result = {};
        cback.call(this);
    };

    var make_new_reader = function(clazz) {
        var rdr = new clazz();
        rdr.retrieve = retrieve_func;
        rdr._dataReceived = function() {
            return true;
        };
        MASCP.Service.CacheService(rdr);
        return rdr;
    }

    var read_in_data = function(clazz) {
        if (argv.verbose) {
            process.stderr.write("Reading in "+(argv.file ? argv.file : "STDIN")+" for "+classname+" setting timestamp to "+date+"\n");
        }
        var reader = make_new_reader(clazz);

        //We want to trigger the retrieve function all the time, so we set the minimum date to now
        MASCP.Service.SetMinimumAge(new Date());
        var end_func = MASCP.Service.BulkOperation();
        if (argv.file) {
            var data = read_csv(argv.file);
            reader.retrieve(null, function() {
                if (data.length > 0) {
                    var row = data.shift();
                    this._data = row[1];
                    this.retrieve(row[0],arguments.callee);
                } else if (data.length == 0) {
                    end_func();
                }
            });
        } else {
            get_stdin(function(line) {
                var rdr = make_new_reader(clazz);
                rdr._data = line[1];
                rdr.retrieve(line[0], function() { });
            }, function() {
                end_func();
            });
        }
    };
    
    var write_out_data = function(clazz) {
        if (argv.verbose) {
            process.stderr.write("Writing out data for "+clazz+" that is no newer than "+date);
        }
        // We want data from this particular date, and nothing older.
        MASCP.Service.BeginCaching();
        MASCP.Service.SetMaximumAge(date);
        MASCP.Service.CachedAgis(clazz,function(ids) {
            ids.forEach(function(id) {
                // Set the endpoint URL to a null value so that it will never retrieve data
                (new clazz(null,null).retrieve(id,function(err) {
                    if ( ! err && this.result ) {
                        var data = this.result._raw_data || {};
                        var stringrep = JSON.stringify(data);
                        stringrep = stringrep.replace(/\n/g, '');
                        process.stdout.write(id+","+stringrep+"\n");
                    }
                }));
            });
        });
    };
    for (var reader_class in MASCP) { 
        if (MASCP.hasOwnProperty(reader_class) && classname == MASCP[reader_class].toString()) {

            var clazz = MASCP[reader_class];
            if (argv.write) {
                write_out_data(clazz);
            } else {
                read_in_data(clazz);                
            }
            
        }
    }
});
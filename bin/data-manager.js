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
                   ' cat [file] | $0 --reader [Reader class] --date YYYY/MM/DD --verbose --test\n'+
                   'OR\n '+
                   '$0 --file [file] --reader [Reader class] --date YYYY/MM/DD --verbose --test\n'+
                   'OR\n '+
                   'To load data directly from a FASTA file\n'+
                   '$0 --file [file] --reader [Reader class] --date YYYY/MM/DD --fasta\n'+
                   'OR\n '+
                   'To load up data with an alternative class\n'+
                   '$0 --file [file] --reader [Reader class] --writeclass [Class] --date YYYY/MM/DD --verbose\n\n'+
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
    process.stdin.on('end',function(line) {
        setTimeout(endcback,100);
    });
    carrier.carry(process.stdin,function(line) {
        cback.call(null,line.split(/,(.+)/));
    });
};

if (argv.fasta) {
    (function() {
        var normal_read_csv = read_csv;
        var normal_get_stdin = get_stdin;
        var seq = "";
        var id;
        var handle_line = function(line) {
            var match = line.match(/^>(.*)/);
            var dat;
            if (match) {
                if (id) {
                    dat = [id, JSON.stringify({ 'data' : [ seq+"", "" ] }) ];
                    seq = "";
                }
                id = match[1];
                return dat;
            } else {
                seq += line;
            }
        };
        read_csv = function(filename) {
            var lines = fs.readFileSync(filename,"utf8").split("\n").reverse();
            lines.unshift(">");
            var data = [];
            var block;
            for (var i = lines.length - 1; i >= 0; i-- ) {
                block = handle_line(lines[i]);
                if (block) {
                    data.push(block);
                }
            }
            return data;
        };

        get_stdin = function(cback,endcback) {
            process.stdin.resume();
            process.stdin.on('end',function(line) {
                if (! line) {
                    line = ">";
                }
                var block = handle_line(line);
                if (block) {
                    cback.call(null,block);
                }
                setTimeout(endcback,100);
            });
            carrier.carry(process.stdin,function(line) {
                var block = handle_line(line);
                if (block) {
                    cback.call(null,block);
                }
            });
        };

    })();
}

MASCP = require('../dist/js/mascp-jstools.services.js');
MASCP.events.once('ready',function() {
    var date = argv.date ? new Date(Date.parse(argv.date + " 0:00 GMT")) : new Date();
    var classname = argv.reader;

    var retrieve_func = function(current_agi,cback) {
        if (current_agi === null || current_agi == '' || typeof current_agi == 'undefined') {
            this.requestComplete();
            return;
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
        if (cback) {
            cback.call(this);
        }
        this.requestComplete();
    };

    var make_new_reader = function(clazz) {
        var rdr = new clazz();
        rdr.retrieve = retrieve_func;
        rdr._dataReceived = function() {
            return true;
        };
        if ( ! argv.test ) {
            MASCP.Service.CacheService(rdr);
        }
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
            var request_complete = function() {
                if (data.length > 0 && data[0][0] != '') {
                    var row = data.shift();
                    this._data = row[1];
                    this.retrieve(row[0]);
                } else if (data.length == 0 || data[0][0] == '') {
                    end_func();
                }
            };
            reader.bind('requestComplete',request_complete);
            request_complete.call(reader);
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
            
            if (argv.writeclass) {
                clazz = MASCP.cloneService(clazz,argv.writeclass);
            }

            if (argv.write) {
                write_out_data(clazz);
            } else {
                read_in_data(clazz);                
            }
            
        }
    }
});
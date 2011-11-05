#!/usr/bin/env node

/*
File format should be

IDENTIFIER,PEPTIDE
,PEPTIDE
,PEPTIDE
IDENTIFIER,PEPTIDE,PEPTIDE,PEPTIDE
,PEPTIDE,PEPTIDE,PEPTIDE

In UTF8 format

*/




var argv =  require('optimist')
            .usage('Load a CSV file into the server\n'+
                   'Usage:\n'+
                   ' cat [file] | $0 --dataset [Set name] --date YYYY/MM/DD --url [Ref url] --color [CSS color] --verbose\n'+
                   'OR\n '+
                   '$0 --file [file] --dataset [Set name] --date YYYY/MM/DD --url [Ref url] --color [CSS color] --verbose\n\n'+
                   'For large data loading, use the pipe format, which runs a lot faster.\n')
            .demand(['dataset'])
            .argv;

var events = require('events'),
    fs = require('fs'),
    carrier = require('carrier'),
    sys = require('sys');

var read_csv = function(filename) {
        var lines = fs.readFileSync(filename,"utf8").split("\n");
        var data = [];
        for (var i = lines.length - 1; i >= 0; i-- ) {
            data.push(lines[i].replace(/"/g,'').split(/\s*['"]?\s*,\s*['"]\s*?/));
        }
        return data.reverse();
};

var get_stdin = function(cback,endcback) {
    process.stdin.resume();
    process.stdin.on('end',function() {
        endcback();
    });
    carrier.carry(process.stdin,function(line) {
        cback.call(null,line.replace(/"/g,'').split(/\s*['"]?\s*,\s*['"]?\s*/));
    })
};
MASCP = require('../dist/js/mascp-jstools.services.js');
MASCP.events.once('ready',function() {
    var date = argv.date ? new Date(Date.parse(argv.date + " 0:00 GMT")) : new Date();
    var classname = MASCP.ArbitraryDataReader;
    var dataset = argv.dataset;
    var url = argv.url;
    var color = argv.color;

    var retrieve_func = function(current_agi,cback) {
        if (current_agi === null || typeof current_agi == 'undefined' && cback) {
            cback.call(this);
            return;
        }
        var data_block = this._data;
        data_block.retrieved = date;
        if (url) {
            data_block.url = url;
        }
        if (color) {
            data_block.color = color;
        }
        this.agi = current_agi;
        this.result = {};
        this.result._raw_data = data_block;
        this._dataReceived(data_block);
        data_block = {};
        this.result = {};
        if (cback) {
            cback.call(this);
        }
    };

    var make_new_reader = function(clazz) {
        var rdr = new clazz();
        rdr = rdr._extend(dataset);
        rdr.retrieve = retrieve_func;
        rdr._dataReceived = function() {
            return true;
        };
        MASCP.Service.CacheService(rdr);
        return rdr;
    }

    var clean_row = function(row) {
        if (row.length == 0) {
            return row;
        }
        var cell = row[0].toString();
        if (cell.match(/\d+-\d+/)) {
            return row.map(function(c) {
                var bits = c.split(/-/);
                bits[0] = parseInt(bits[0],10);
                bits[1] = parseInt(bits[1],10);
                return bits;
            });
        }
        if (cell.match(/^\d+$/)) {
            var res = [];
            while (row.length > 0){
                var bits = [row.shift(), row.shift()];
                bits[0] = parseInt(bits[0],10);
                bits[1] = parseInt(bits[1],10);
                res.push(bits);
            }
            return res;
        }
        if (cell.match(/^[A-Z\(\)a-z]+$/)) {
            return row;
        }
    }

    var read_in_data = function(clazz) {
        if (argv.verbose) {
            process.stderr.write("Reading in "+(argv.file ? argv.file : "STDIN")+" for "+classname+" setting timestamp to "+date+"\n");
        }
        var reader = make_new_reader(clazz);
        var last_agi;
        var peptides = [];

        //We want to trigger the retrieve function all the time, so we set the minimum date to now
        MASCP.Service.SetMinimumAge(new Date());
        var end_func = MASCP.Service.BulkOperation();
        if (argv.file) {
            var data = read_csv(argv.file);
            reader.retrieve(null, function() {
                if (data.length > 0) {
                    var row = data.shift();
                    var an_agi = row.shift();
                    row = clean_row(row);
                    if (last_agi && an_agi != last_agi && an_agi.length ) {
                        this._data = { 'data' : [].concat(peptides) };
                        peptides = [].concat(row);
                        var curr_agi = last_agi;
                        last_agi = an_agi;
                        this.retrieve(curr_agi,arguments.callee);
                        return;
                    }
                    if (an_agi) {
                        last_agi = an_agi;
                    }
                    peptides = peptides.concat(row);
                    
                    arguments.callee.call(this);
                } else if (data.length == 0) {
                    if (last_agi) {
                        this._data = { 'data' : [].concat(peptides) };
                        this.retrieve(last_agi);
                    }                    
                    end_func();
                }
            });
        } else {
            get_stdin(function(row) {
                var an_agi = row.shift();
                row = clean_row(row);
                if (last_agi && an_agi != last_agi && an_agi.length ) {
                    var rdr = make_new_reader(clazz);
                    rdr._data = { 'data' : [].concat(peptides) };
                    rdr.retrieve(last_agi,function() {});
                    peptides = [].concat(row);
                    last_agi = an_agi;
                    return;
                }
                if (an_agi) {
                    last_agi = an_agi;
                }
                peptides = peptides.concat(row);
            }, function() {
                if (last_agi) {
                    var rdr = make_new_reader(clazz);
                    rdr._data = { 'data' : [].concat(peptides) };
                    rdr.retrieve(last_agi);
                }                
                end_func();
            });
        }
    };
    
    read_in_data(classname);
});
/**
 * @fileOverview    Classes for reading data from Uniprot database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}



/** Default class constructor
 *  @class      Service class that will retrieve data from Uniprot for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.UniprotReader = MASCP.buildService(function(data) {
                        if ( data && typeof(data) === 'string' ) {
                            var dats = MASCP.UniprotReader.parseFasta(data);
                            var key;
                            for (key in dats) {
                                if (dats.hasOwnProperty(key)) {
                                    data = { 'data' : dats[key] };
                                    this._raw_data = data;
                                }
                            }
                        }
                        this._data = data || {};
                        if ( ! this._data.data ) {
                            this._data = { 'data' : ['',''] };
                        }
                        return this;
                    });

MASCP.UniprotReader.SERVICE_URL = 'http://gator.masc-proteomics.org/uniprot.pl?';

MASCP.UniprotReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "txt",
        'url'   : 'http://www.uniprot.org/uniprot/'+(this.agi).toUpperCase()+'.fasta',
        data: { 'acc'   : this.agi,
                'service' : 'uniprot' 
        }
    };
};

MASCP.UniprotReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

MASCP.UniprotReader.Result.prototype.getSequence = function() {
    return this._data.data[0];
};

MASCP.UniprotReader.parseFasta = function(datablock) {
    var chunks = (datablock.split('>'));
    var datas = {};
    chunks.forEach(function(entry) {
        var lines = entry.split(/\n/);
        if (lines.length <= 1) {
            return;
        }
        var header = lines.shift();
        var seq = lines.join("");
        var header_data = header.split('|');
        var acc = header_data[1];
        var desc = header_data[2];
        datas[acc] = [seq,desc];
    });
    return datas;
}

MASCP.UniprotReader.readFastaFile = function(datablock,callback) {

    var datas = MASCP.UniprotReader.parseFasta(datablock);

    var writer = new MASCP.UserdataReader();
    writer.toString = function() {
        return "MASCP.UniprotReader";
    };
    writer.map = function(dat) {
        return dat.data;
    };
    writer.datasetname = "UniprotReader";
    callback(writer);
    setTimeout(function() {
        writer.avoid_database = true;
        writer.setData("UniprotReader",{"data" : datas});
    },0);
    return writer;
};

MASCP.UniprotReader.parseDomains = function(datalines) {
    var results = {};
    datalines = datalines.split(/\n/);
    var domain_re = /FT\s+DOMAIN\s+(\d+)\s+(\d+)\s+(.*)/m;
    var carb_re = /FT\s+CARBOHYD\s+(\d+)\s+(\d+)\s+(.*)/m;
    var signal_re = /FT\s+SIGNAL\s+(\d+)\s+(\d+)\s+(.*)/m;
    var transmem_re = /FT\s+TRANSMEM\s+(\d+)\s+(\d+)\s+(.*)/m;

    datalines.forEach(function(data) {
        var match = carb_re.exec(data);
        if (match) {
            var name = match[3];
            name = name.replace('...','..');
            if ( ! results[name]) {
                results[name] = { "peptides" : [], "name" : name };
            }
            results[name].peptides.push([match[1],match[2]]);
        }
        var match = domain_re.exec(data);
        if (match) {
            var name = match[3];
            name = name.replace(/;.*/,"");
            name = name.replace(/\.\s+\{.*\}?/,"");
            name = name.replace(/\.$/,"");
            name = name.replace(/\s+\d+$/,"");
            if ( ! results[name]) {
                results[name] = { "peptides" : [], "name" : name };
            }
            results[name].peptides.push([match[1],match[2]]);
        }
        match = signal_re.exec(data);
        if (match) {
            if ( ! results["SIGNALP"]) {
                results["SIGNALP"] = { "peptides" : [], "name" : "SIGNALP" };
            }
            results["SIGNALP"].peptides.push([ match[1], match[2] ]);
        }
        match = transmem_re.exec(data);
        if (match) {
            if ( ! results["uniprot-TMhelix"]) {
                results["uniprot-TMhelix"] = { "peptides" : [], "name" : "TMhelix" };
            }
            results["uniprot-TMhelix"].peptides.push([ match[1], match[2] ]);
        }
    });

    return results;
};

MASCP.UniprotReader.parseSecondaryStructure = function(datalines) {
    var results;
    datalines = datalines.split(/\n/);
    datalines.forEach(function(data) {
        var strand_re = /FT\s+(STRAND)\s+(\d+)\s+(\d+)/m;
        var helix_re = /FT\s+(HELIX)\s+(\d+)\s+(\d+)/m;
        var turn_re = /FT\s+(TURN)\s+(\d+)\s+(\d+)/m;
        [strand_re,helix_re,turn_re].forEach(function(re) {
            var match = re.exec(data);
            if ( ! match ) {
                return;
            }
            if ( ! results || ! results[match[1]] ) {
                results = { "STRAND" : {"peptides" : [ ]},  "HELIX" : {"peptides" : []}, "TURN" : {"peptides" : [] } };
            }
            if (match) {
                results[match[1]].peptides.push([match[2],match[3]]);
            }
        });
    });

    return results;
};


MASCP.UniprotDomainReader = MASCP.buildService(function(data) {
                        if ( data && typeof(data) === 'string' ) {
                            var dats = MASCP.UniprotReader.parseDomains(data);
                            data = { 'data' : dats };
                            this._raw_data = data;
                        }
                        return this;
                    });

MASCP.UniprotDomainReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "txt",
        'url'   : 'http://www.uniprot.org/uniprot/'+(this.agi).toUpperCase()+'.txt',
        data: { 'acc'   : this.agi,
                'service' : 'uniprot'
        }
    };
};


MASCP.UniprotSecondaryStructureReader = MASCP.buildService(function(data) {
                        if ( data && typeof(data) === 'string' ) {
                            var dats = MASCP.UniprotReader.parseSecondaryStructure(data);
                            if (dats) {
                                data = { 'data' : dats };
                            } else {
                                return null;
                            }
                            this._raw_data = data;
                        } else if (data) {
                            this._raw_data = data;
                        }
                        return this;
                    });

MASCP.UniprotSecondaryStructureReader.prototype.requestData = function()
{
    var self = this;
    return {
        type: "GET",
        dataType: "txt",
        'url'   : 'http://www.uniprot.org/uniprot/'+(this.agi).toUpperCase()+'.txt',
        data: { 'acc'   : this.agi,
                'service' : 'uniprot'
        }
    };
};


MASCP.UniprotSecondaryStructureReader.prototype.setupSequenceRenderer = function(renderer,options) {
    this.bind('resultReceived',function() {
        if (this.result && this.result._raw_data.data) {
            if ( ! options.track ) {
                MASCP.registerLayer('secstructure',{ 'fullname' : 'Secondary structure', 'color' : '#0f0' });
            }
            this.result._raw_data.data['STRAND'].peptides.forEach(function(pos) {
                var start = parseInt(pos[0]);
                var end = parseInt(pos[1]);
                renderer.getAA(start).addBoxOverlay(options.track || 'secstructure',end-start,1,{"fill" : "#9AFF9A"});
            });
            this.result._raw_data.data['HELIX'].peptides.forEach(function(pos) {
                var start = parseInt(pos[0]);
                var end = parseInt(pos[1]);
                renderer.getAA(start).addBoxOverlay(options.track || 'secstructure',end-start,1,{"fill" : "#7EB6FF"});
            });
            this.result._raw_data.data['TURN'].peptides.forEach(function(pos) {
                var start = parseInt(pos[0]);
                var end = parseInt(pos[1]);
                renderer.getAA(start).addBoxOverlay(options.track || 'secstructure',end-start,1,{"fill" : "#F0A"});
            });
        }
        renderer.trigger('resultsRendered',[this]);
    });
};


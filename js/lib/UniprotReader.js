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
        'url'   : 'http://www.uniprot.org/uniprot/'+this.agi+'.fasta',
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
    datalines.forEach(function(data) {
        var domain_re = /FT\s+DOMAIN\s+(\d+)\s+(\d+)\s+(.*)/m;
        var carb_re = /FT\s+CARBOHYD\s+(\d+)\s+(\d+)\s+(.*)/m;
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
            if ( ! results[match[3]]) {
                results[match[3]] = { "peptides" : [] };
            }
            results[match[3]].peptides.push([match[1],match[2]]);
        }
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
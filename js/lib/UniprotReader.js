/**
 * @fileOverview    Classes for reading data from Uniprot database
 */

import MASCP from './MascpService';
import UserdataReader from './UserdataReader';
import bean from '../bean';


/** Default class constructor
 *  @class      Service class that will retrieve data from Uniprot for a given AGI.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
const UniprotReader = MASCP.buildService(function(data) {
                        if ( data && typeof(data) === 'string' ) {
                            var dats = UniprotReader.parseFasta(data);
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

UniprotReader.SERVICE_URL = null;

UniprotReader.prototype.requestData = function()
{
    var self = this;
    if ( ! UniprotReader.SERVICE_URL) {
        throw new Error('No service URL for UniprotReader');
    }
    return {
        type: "GET",
        dataType: "json",
        'auth' : MASCP.GATOR_AUTH_TOKEN,
        'api_key' : MASCP.GATOR_CLIENT_ID,
        'url'   : UniprotReader.SERVICE_URL+'/'+(this.agi).toUpperCase()
    };
};

UniprotReader.Result.prototype.getDescription = function() {
    return this._data.data[1];
};

UniprotReader.Result.prototype.getSequence = function() {
    return this._data.data[0];
};

UniprotReader.parseFasta = function(datablock) {
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

UniprotReader.readFastaFile = function(datablock,callback) {

    var datas = UniprotReader.parseFasta(datablock);

    var writer = new UserdataReader();
    writer.toString = function() {
        return "UniprotReader";
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

export default UniprotReader;




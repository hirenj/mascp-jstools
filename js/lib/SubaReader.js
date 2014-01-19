/**
 * @fileOverview    Classes for reading data from the Suba database
 */

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}


/** Default class constructor
 *  @class      Service class that will retrieve data from SUBA for a given AGI.
 *              Data is transferred using JSON.
 *  @param      {String} agi            Agi to look up
 *  @param      {String} endpointURL    Endpoint URL for this service
 *  @extends    MASCP.Service
 */
MASCP.SubaReader = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        return this;
                    });

MASCP.SubaReader.SERVICE_URL = 'http://suba.plantenergy.uwa.edu.au/services/byAGI.php?';

MASCP.SubaReader.prototype.requestData = function()
{
    return {
        type: "GET",
        dataType: "json",
        data: { 'agi'       : this.agi,
                'service'   : 'suba' 
        }
    };
};

/**
 *  @class   Container class for results from the Promex service
 *  @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.SubaReader.Result = MASCP.SubaReader.Result;

/**#@+
 * @memberOf MASCP.SubaReader.Result.prototype
 */
MASCP.SUBA_FIELDS =
{
    /** @name location_gfp */
    location_gfp        :   null,
    /** @name location_ipsort */
    location_ipsort     :   null,
    /** @name location_loctree */
    location_loctree    :   null,
    /** @name location_mitopred */
    location_mitopred   :   null,
    /** @name location_mitoprot2 */
    location_mitoprot2  :   null,
    /** @name location_ms */
    location_ms         :   null,
    /** @name location_multiloc */
    location_multiloc   :   null,
    /** @name location_preoxp */
    location_preoxp     :   null,
    /** @name location_predotar */
    location_predotar   :   null,
    /** @name location_subloc */
    location_subloc     :   null,
    /** @name location_swissprot */
    location_swissprot  :   null,
    /** @name location_targetp */
    location_targetp    :   null,
    /** @name location_wolfpsort */
    location_wolfpsort  :   null
};

/**#@-*/


MASCP.SubaReader.Result.prototype._getLocalisation = function(localisation)
{
    var results = {};
    var any_data = false;
    for (var i = 0; i < this._raw_data.observed.length; i++) {
        var obs = this._raw_data.observed[i];
        if (obs[2] == localisation) {
            if (! results[obs[0]]) {
                results[obs[0]] = [];
            }
            results[obs[0]].push(obs[1]);
            any_data = true;
        }
    }
    if ( ! any_data ) {
        return null;
    }
    return results;
};

MASCP.SubaReader.Result.prototype._parseLocalisation = function(localisation)
{
    if (localisation === null || localisation.length === 0 )
    {
        return null;
    }
    var experiments = localisation.split(';');
    var tissues = {};
    var i;
    for (i = experiments.length - 1; i >= 0; i--) {
        var data = experiments[i].split(':');
        tissues[data[0]] = tissues[data[0]] || [];
        tissues[data[0]].push(data[1]);
    }
    return tissues;
};

MASCP.SubaReader.Result.prototype._sortLocalisation = function(loc_data)
{
    var loc_keys = [];
    for (var i in loc_data) {
        if (loc_data.hasOwnProperty(i)) {
            loc_keys.push(i);
        }
    }
    loc_keys = loc_keys.sort(function(a,b) {
        return loc_data[a].length - loc_data[b].length;
    });
    
    return loc_keys;    
};

/** Retrieve the mass spec localisation for this AGI
 *  @returns [ { String : [String] } ]   Mass Spec localisation and array of Pubmed IDs
 */
MASCP.SubaReader.Result.prototype.getMassSpecLocalisation = function()
{
    return this._getLocalisation('ms');
};


/** Retrieve the GFP localisation for this AGI
 *  @returns [ {String : [String] }  ]   GFP localisation and array of Pubmed IDs
 */
MASCP.SubaReader.Result.prototype.getGfpLocalisation = function()
{
    return this._getLocalisation('gfp');
};

MASCP.SubaReader.Result.prototype.getWinnerTakesAllGfp = function()
{
    var vals = this.getGfpLocalisation();
    var locs = (this._sortLocalisation(vals));
    var results = [];
    var last_val = -1;
    var i;
    for ( i = locs.length - 1; i >= 0; i-- ) {
        if (last_val && vals[locs[i]] == last_val) {
            results.push(locs[i]);
        } else if (last_val < 0) {
            last_val = vals[locs[i]];
            results.push(locs[i]);
        } else {
            break;
        }
    }
    results._values = [];
    for (i = results.length - 1; i >= 0; i-- ) {
        results._values.push(vals[results[i]].length);
    }
    return results;
};

MASCP.SubaReader.Result.prototype.getWinnerTakesAllMassSpec = function()
{
    var vals = this.getMassSpecLocalisation();
    var locs = (this._sortLocalisation(vals));
    var results = [];
    var last_val = -1;
    var i;
    for (i = locs.length - 1; i >= 0; i-- ) {
        if (last_val && vals[locs[i]] == last_val) {
            results.push(locs[i]);
        } else if (last_val < 0) {
            last_val = vals[locs[i]];
            results.push(locs[i]);
        } else {
            break;
        }
    }
    results._values = [];
    for ( i = results.length - 1; i >= 0; i-- ) {
        results._values.push(vals[results[i]].length);
    }
    return results;
};

/** Retrieve the set of predicted localisations for this AGI
 *  @returns [ { String : [String] } ]   Predicted localisation and array of methods
 */
MASCP.SubaReader.Result.prototype.getPredictedLocalisations = function()
{
    var results = {};
    for (var i = 0; i < this._raw_data.predicted.length; i++) {
        if ( ! results[this._raw_data.predicted[i][0]]) {
            results[this._raw_data.predicted[i][0]] = [];
        }
        results[this._raw_data.predicted[i][0]].push(this._raw_data.predicted[i][1]);        
    }
    return results;    
};

MASCP.SubaReader.Result.prototype.mapController = function(inputElement)
{
    console.log("Deprecated mapController");
};

MASCP.SubaReader.Result.prototype.render = function()
{
    return null;
};
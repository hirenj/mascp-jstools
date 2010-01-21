/**
 *  @fileOverview Classes for reading data from the AtProteome database using JSON data
 */

/**
 * @class   Service class that will retrieve AtProteome data for this entry given an AGI.
 *          To retrieve data from AtProteome, two requests need to be made to the remote
 *          server. The first request ascertains the internal ID used by AtProteome for
 *          the given AGI. A second request then retrieves the data from AtProteome.
 *          Data is received in XML format, and will need to go through a tidying proxy
 *          if retrieving data directly from AtProteome.
 * @description Default class constructor
 * @param   {String} agi            Agi to look up
 * @param   {String} endpointURL    Endpoint URL for this service
 * @extends MASCP.Service
 */
MASCP.AtProteomeReaderJson = MASCP.buildService(function(data) {
                        this._raw_data = data;
                        if (data) {
                            this._populate_spectra(data);
                            this._populate_peptides(data);
                        }
                        return this;
                    });

MASCP.AtProteomeReaderJson.prototype.requestData = function()
{
    var self = this;
    var agi = this.agi;
    return {
        type: "POST",
        dataType: "json",
        data: { 'agi'       : agi,
                'service'   : 'atproteome-json' 
        }
    };
};


/**
 * @class   Container class for results from the AtProteome service
 * @extends MASCP.Service.Result
 */
// We need this line for the JsDoc to pick up this class
MASCP.AtProteomeReaderJson.Result = MASCP.AtProteomeReaderJson.Result;

/**
 * The list of tissue names that are used by AtProteome for this particular AGI
 *  @returns {[String]} Tissue names
 */
MASCP.AtProteomeReaderJson.Result.prototype.tissues = function()
{

};

MASCP.AtProteomeReaderJson.Result.prototype = jQuery.extend(MASCP.AtProteomeReaderJson.Result.prototype,
/** @lends MASCP.AtProteomeReaderJson.Result.prototype */
{
    /** @field 
     *  @description Hash keyed by tissue name containing the number of spectra for each tissue for this AGI */
    spectra :   null,
    /** @field
     *  @description Hash keyed by tissue name containing the number of spectra for each peptide (keyed by "start-end" position) */
    peptide_counts_by_tissue : null
});

MASCP.AtProteomeReaderJson.Result.prototype._populate_spectra = function(data)
{
    this.spectra = {};
    if ( ! data || ! data.tissues ) {
        return;
    }
    for (var i = 0; i < data.tissues.length; i++ ) {
        this.spectra[data.tissues[i].tissue] = parseInt(data.tissues[i].qty_spectra);
    }
};

MASCP.AtProteomeReaderJson.Result.prototype._populate_peptides = function(data)
{
    this.peptide_counts_by_tissue = {};
    if ( ! data || ! data.peptides ) {
        return;
    }
    for (var i = 0; i < data.peptides.length; i++ ) {
        var a_peptide = data.peptides[i];
        var peptide_position = a_peptide.position+'-'+(parseInt(a_peptide.position)+parseInt(a_peptide.sequence.length));
        for (var j = 0; j < a_peptide.tissues.length; j++ ) {
            var a_tissue = a_peptide.tissues[j];
            if (! this.peptide_counts_by_tissue[a_tissue.tissue]) {
                this.peptide_counts_by_tissue[a_tissue.tissue] = {};
            }
            this.peptide_counts_by_tissue[a_tissue.tissue][peptide_position] = parseInt(a_tissue.qty_spectra);
        }
    }
};


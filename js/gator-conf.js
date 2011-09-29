var READER_CONF = (function() {
    var vals = {};
    for (var i = 0; i < arguments.length; i+= 2) {
        if (! arguments[i] || typeof arguments[i] == 'undefined') {
            continue;
        }
        vals[arguments[i]] = arguments[i+1];
        vals[arguments[i]].url = arguments[i] === MASCP.AtChloroReader ? '/data/latest/atchloro/' : '/data/latest/gator';
    }
    return vals;
})(
    MASCP.SubaReader , {
        'definition'    : MASCP.SubaReader,
        'nicename'      : 'SUBA',
        'error_url'     : 'http://www.plantenergy.uwa.edu.au/applications/suba/',
        'success_url'   : 'http://www.plantenergy.uwa.edu.au/applications/suba/flatfile.php?id=',
        'result'        : function() {
                            jQuery('#suba_results').text('').append('<div><table id="suba_tags"><thead><tr><th>tag</th><th>Publication count</th></tr></thead><tbody></tbody></table></div>');
                            jQuery(this.result.getMassSpecLocalisation()).each(function(i) {
                                var loc_data = this;
                                var loc_key = null;
                                for (loc_key in loc_data) {
                                    if (loc_data.hasOwnProperty(loc_key)) {
                                        jQuery('#suba_results tbody').append("<tr><td>MS "+loc_key+"</td><td>"+loc_data[loc_key].length+"</td></tr>");
                                    }
                                }
                            });
                            jQuery(this.result.getGfpLocalisation()).each(function(i) {
                                var loc_data = this;
                                var loc_key = null;
                                for (loc_key in loc_data) {
                                    if (loc_data.hasOwnProperty(loc_key)) {
                                        jQuery('#suba_results tbody').append("<tr><td>GFP "+loc_key+"</td><td>"+loc_data[loc_key].length+"</td></tr>");
                                    }
                                }
                            });
                            jQuery(this.result.getPredictedLocalisations()).each(function(i) {
                                var loc_data = this;
                                var loc_key = null;
                                for (loc_key in loc_data) {
                                    if (loc_data.hasOwnProperty(loc_key)) {
                                        jQuery('#suba_results tbody').append("<tr><td>Prediction "+loc_key+"</td><td>"+loc_data[loc_key].length+"</td></tr>");                    
                                    }
                                }
                            });                

                            var tagvis = new MASCP.TagVisualisation("suba_tags",[MASCP.TagVisualisation.TagCloud]);
                            tagvis.tagColumn = 0;
                            tagvis.visualisations[0].tagFactory = function(tagId,tag,row) {
                                var span = document.createElement('span');
                                var the_tag = tag;
                                var original_tag = tag;
                                if ((the_tag = original_tag.replace(/MS /,'')) != original_tag) {
                                    span.style.color = '#ff0000';
                                    original_tag = the_tag;
                                }
                                if ((the_tag = original_tag.replace(/GFP /,'')) != original_tag) {
                                    span.style.color = '#00ff00';                        
                                    original_tag = the_tag;
                                }
                                if ((the_tag = original_tag.replace(/Prediction /,'')) != original_tag) {
                                    span.style.color = '#aaaaaa';                        
                                    original_tag = the_tag;                        
                                }                    
                                span.textContent = original_tag;
                                span.innerText = original_tag;

                                var valuespan = document.createElement('span');
                                valuespan.textContent = row[1].textContent || row[1].innerText;
                                valuespan.innerText = row[1].textContent || row[1].innerText;
                                valuespan.style.textShadow = 'none';
                                span.appendChild(valuespan);

                                return span;
                            };                
                            tagvis.visualisations[0].update(1);
                            jQuery('#suba .rich_tagcloud').masonry({ 'itemSelector' : '.rich_tagcloud_tag', 'animate': true });
                        },
        'layers'        : []
    },
    MASCP.PhosphatReader , {
        'definition'    : MASCP.PhosphatReader,
        'nicename'      : 'PhosPhAt',
        'error_url'     : 'http://phosphat.mpimp-golm.mpg.de',
        'success_url'   : 'http://phosphat.mpimp-golm.mpg.de/app.html?agi=',
        'result'        : function() {
                            if (this.result.getAllExperimentalPositions().length > 0) {                 
                                jQuery('#phosphat_experimental').show();
                                MASCP.renderer.showLayer('phosphat_experimental');
                            } else if (this.result.getAllPredictedPositions().length > 0) {
                                jQuery('#phosphat_theoretical').show();                 
                            }
                            var tissues = this.result.getSpectra();
                            var loc_key = null;
                            for (loc_key in tissues) {
                                if (tissues.hasOwnProperty(loc_key)) {
                                    var long_name = loc_key;
                                    var count = tissues[loc_key];
                                    document.getElementById('tissue_results').updateKey(long_name,count);
                                }
                            }
                            document.getElementById('tissue_tags').updateTags();
                        },
        'url'           : 'http://gator.masc-proteomics.org/proxy.pl',
        'layers'        : ['phosphat_experimental']
    },
    MASCP.RippdbReader ,  {
        'definition'    :  MASCP.RippdbReader,
        'nicename'      : 'RIPP-DB',
        'error_url'     : 'https://database.riken.jp/sw/links/en/ria102i/',
        'success_url'   : 'https://database.riken.jp/sw/links/en/ria102i/?refagi=',
        'result'        :  function() {
                            if (this.result.getSpectra().length > 0) {                 
                                jQuery('#prippdb_experimental').show();
                                MASCP.renderer.showLayer('prippdb_experimental');
                            }
                        },
        'layers'        : ['prippdb_experimental']
    },
    MASCP.PromexReader, { 
        'definition'    : MASCP.PromexReader,
        'nicename'      : 'ProMEX',
        'error_url'     : 'http://promex.pph.univie.ac.at/promex/',
        'success_url'   : 'http://promex.pph.univie.ac.at/promex/?ac=#locus=true',
        'result'        : function() {
                            if (this.result.getPeptides().length > 0) {
                                jQuery('#promex_placeholder').show();
                            }
                        },
        'layers'        : ['promex_experimental'],
        'placeholder'   : true
    },
    MASCP.InterproReader, { 
        'definition'    : MASCP.InterproReader,
        'nicename'      : 'Interpro',
        'error_url'     : 'http://www.ebi.ac.uk/interpro/',
        'success_url'   : 'http://www.ebi.ac.uk/interpro/ISearch?mode=protein&query=',
        'result'        : function() {
                            jQuery('#interpro_placeholder').show();
                        },
        'layers'        : ['interpro_domains'],
        'placeholder'   : true
    },
    MASCP.PpdbReader, {
        'definition'    : MASCP.PpdbReader,
        'nicename'      : 'PPDB',
        'error_url'     : 'http://ppdb.tc.cornell.edu',
        'success_url'   : 'http://ppdb.tc.cornell.edu/?refagi=',
        'url'           : 'http://gator.masc-proteomics.org/proxy.pl',
        'result'        : function() {
                                if (this.result.getPeptides().length > 0) {
                                    jQuery('#ppdb_placeholder').show();
                                }
                            },
        'layers'        : ['ppdb'],
        'placeholder'   : true
    },
    MASCP.GelMapReader, { 
        'definition'    : MASCP.GelMapReader,
        'nicename'      : 'GelMap',
        'error_url'     : 'http://www.gelmap.de/',
        'success_url'   : 'http://www.gelmap.de/',
        'result'        : function() {
                          },
        'layers'        : ['gelmap_experimental'],
        'placeholder'   : true
    },
    MASCP.AtChloroReader, {
        'definition'    : MASCP.AtChloroReader,
        'nicename'      : 'AT_CHLORO',
        'error_url'     : 'http://www.grenoble.prabi.fr/at_chloro/',
        'success_url'   : 'http://www.grenoble.prabi.fr/at_chloro/?refagi=',
        'result'        : function() {
                                if (this.result.getPeptides().length > 0) {
                                    jQuery('#atchloro_experimental').show();
                                }
                            },
        'layers'        : ['atchloro']
    },
    MASCP.AtPeptideReader, {
        'definition'    : MASCP.AtPeptideReader,
        'nicename'      : 'AtPeptide',
        'error_url'     : 'http://proteomics.ucsd.edu/Software/ArabidopsisProteogenomics.html',
        'success_url'   : 'http://proteomics.ucsd.edu/Software/ArabidopsisProteogenomics.html?refagi=',
        'result'        : function() {
                                var loc_key = null;
                                for (loc_key in this.result.spectra) {
                                    if (this.result.spectra.hasOwnProperty(loc_key)) {
                                        var long_name = this.result._long_name_map[loc_key];
                                        var count = this.result.spectra[loc_key];                    
                                        document.getElementById('tissue_results').updateKey(long_name,count);
                                    }
                                }
                                document.getElementById('tissue_tags').updateTags();
                                if (this.result.getPeptides().length > 0) {
                                    jQuery('#atpeptide_placeholder').show();
                                }
                            },
        'layers'        : ['atpeptide_experimental'],
        'placeholder'   : true
    },
    MASCP.AtProteomeReader, {
        'definition'    : MASCP.AtProteomeReader,
        'nicename'      : 'Pep2Pro',
        'error_url'     : 'http://fgcz-atproteome.unizh.ch/',
        'success_url'   : 'http://fgcz-pep2pro.uzh.ch/locus.php?#locus=true',
        'result'        : function() {
                                if (this.result === null) {
                                    return;
                                }

                                var loc_key = null;
                                for (loc_key in this.result.spectra) {
                                    if (this.result.spectra.hasOwnProperty(loc_key)) {
                                        var long_name = this.result._long_name_map[loc_key];
                                        var count = this.result.spectra[loc_key];
                                        document.getElementById('tissue_results').updateKey(long_name,count);
                                    }
                                }
                                document.getElementById('tissue_tags').updateTags();
                                jQuery('#atproteome_placeholder').show();
                            },
        'layers'        : ['atproteome'],
        'placeholder'   : true
    },
    MASCP.P3dbReader, {
        'definition'    : MASCP.P3dbReader,
        'nicename'      : 'P3DB',
        'error_url'     : 'http://p3db.org',
        'success_url'   : 'http://p3db.org',
        'url'           : 'http://gator.masc-proteomics.org/proxy.pl',
        'result'        : function() {
                          },
        'layers'        : ['p3db_experimental'],
        'placeholder'   : true
    },
    MASCP.SnpReader, {
        'definition'    : MASCP.SnpReader,
        'nicename'      : 'Snps',
        'url'           : 'http://snp.jbei.org/snps.pl',
        'result'        : function() {            
        },
        'layers'        : ['insertions_controller','insertions']
    }
);

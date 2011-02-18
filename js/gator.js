var rendering_readers = [];
var all_readers = [];

var rrend = function(e,reader) {
    rendering_readers.splice(rendering_readers.indexOf(reader),1);
    if (rendering_readers.length > 0) {                
        return;
    }

    if (document._screen) {
        document._screen.hide();
    }

    for (var rdr_id in READER_CONF) {
        var rdr = READER_CONF[rdr_id];
        if (rdr.placeholder) {
            for (var i = 0; i < rdr.layers.length; i++ ) {
                var lay = rdr.layers[i];
                var placeholder = lay+'';
                var controller = lay+'';
                placeholder = placeholder.replace(/_experimental/,'') + '_placeholder';
                controller = controller.replace(/_experimental/,'') + '_controller';
                var checkbox = jQuery('#'+placeholder+' input');
                                
                if ( ! checkbox ) {
                    continue;
                }
                
                checkbox.attr('checked',true);
                if (MASCP.getGroup(lay) && MASCP.getGroup(lay).size() > 0) {
                    MASCP.renderer.createLayerCheckbox(controller,checkbox[0],true);
                } else {
                    MASCP.renderer.createGroupCheckbox(lay,checkbox[0],true);
                }
            }
        } else {
            for (var i = 0; i < rdr.layers.length; i++ ) {
                var lay = rdr.layers[i];
                MASCP.renderer.createLayerCheckbox(lay,jQuery('#'+lay+' input')[0],true);
            }            
        }
    }

    var tweak_track_order = function(array) {
        if (array.splice && array.indexOf) {
            for (var rdr_id in READER_CONF) {
                var rdr = READER_CONF[rdr_id];
                if (! rdr.placeholder) {
                    continue;
                }
                for (var i = 0; i < rdr.layers.length; i++) {
                    var lay = rdr.layers[i];
                    var placeholder = lay.replace(/_experimental/,'') + '_placeholder';
                    var controller = lay.replace(/_experimental/,'') + '_controller';
                    if (MASCP.getGroup(lay) && MASCP.getGroup(lay).size() > 0) {
                        array.splice(array.indexOf(placeholder),0,controller,lay);
                        MASCP.renderer.showLayer(controller);
                    } else {
                        array.splice(array.indexOf(placeholder),0,lay);                        
                        MASCP.renderer.showLayer(lay);
                    }
                }
            }
            if (MASCP.getGroup('phosphat_peptides') && MASCP.getGroup('phosphat_peptides').size() > 0) {
                array.splice(array.indexOf('phosphat_experimental')+1,0,'phosphat_peptides');                                                
                MASCP.renderer.showLayer('phosphat_experimental');
            }
            
            if (MASCP.getGroup('prippdb_peptides') && MASCP.getGroup('prippdb_peptides').size() > 0) {
                array.splice(array.indexOf('prippdb_experimental')+1,0,'prippdb_peptides');                                                
                MASCP.renderer.showLayer('prippdb_experimental');
            }
            
        }
        return array;
    };
    
    MASCP.renderer.trackOrder = tweak_track_order(jQuery('#sequence_controllers').sortable({
        update: function(event, ui) {
            if (MASCP.renderer.trackOrder) {
                MASCP.renderer.trackOrder = tweak_track_order(jQuery('#sequence_controllers').sortable('toArray'));
            }
            if (MASCP.renderer.setTrackOrder) {
                MASCP.renderer.setTrackOrder(tweak_track_order(jQuery('#sequence_controllers').sortable('toArray')));
            }
        },
    }).sortable('toArray'));

    var a_dialog = jQuery('#sequence_control').dialog({resizable: false, autoOpen: false, draggable: true, title: "Options", width: '300px', position:['50%','50%'], zIndex: 5000});
    var control_el = MASCP.renderer._Navigation ? MASCP.renderer._Navigation : '#controls';            

    jQuery(control_el).unbind('click').bind('click',function() {
        if (! a_dialog.dialog('isOpen')) {
            a_dialog.dialog('open');
        } else {
            a_dialog.dialog('close');
        }
    });
    
    if ( MASCP.renderer._Navigation ) {
        jQuery('#controls').hide();
        var zoom_controls = GOMap.Diagram.addZoomControls(MASCP.renderer,1.5);
        zoom_controls.id = 'zoom_controls';
        if (zoom_controls.style.height == '100%') {
            jQuery('#sequence_controllers').css('left','3em').css('position','relative');
            zoom_controls.style.position = 'relative';
            zoom_controls.style.height = '1em';
            zoom_controls.style.width = '50%';
            zoom_controls.style.top = '0px';                    
        }
        zoom_controls.style.zIndex = 2;
        jQuery(MASCP.renderer._Navigation._scroll_control).append(zoom_controls);                
    }
    
    if (MASCP.renderer.setTrackOrder) {
        MASCP.renderer.setTrackOrder(MASCP.renderer.trackOrder);                
    }

};

var READER_CONF = (function() {
    var vals = {};
    for (var i = 0; i < arguments.length; i+= 2) {
        if (! arguments[i] || typeof arguments[i] == 'undefined') {
            continue;
        }
        vals[arguments[i]] = arguments[i+1];
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
                                    jQuery('#suba_results tbody').append("<tr><td>MS "+loc_key+"</td><td>"+loc_data[loc_key].length+"</td></tr>");
                                }
                            });
                            jQuery(this.result.getGfpLocalisation()).each(function(i) {
                                var loc_data = this;
                                var loc_key = null;
                                for (loc_key in loc_data) {
                                    jQuery('#suba_results tbody').append("<tr><td>GFP "+loc_key+"</td><td>"+loc_data[loc_key].length+"</td></tr>");
                                }
                            });
                            jQuery(this.result.getPredictedLocalisations()).each(function(i) {
                                var loc_data = this;
                                var loc_key = null;
                                for (loc_key in loc_data) {
                                    jQuery('#suba_results tbody').append("<tr><td>Prediction "+loc_key+"</td><td>"+loc_data[loc_key].length+"</td></tr>");                    
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
        'layers'        : [],
    },
    MASCP.PhosphatReader , {
        'definition'    : MASCP.PhosphatReader,
        'nicename'      : 'PhosPhAt',
        'error_url'     : 'http://phosphat.mpimp-golm.mpg.de',
        'success_url'   : 'http://phosphat.mpimp-golm.mpg.de/app.html?agi=',
        'result'        : function() {
                            if (this.result.getAllExperimentalPositions().length > 0) {                 
                                jQuery('#phosphat_experimental').show();
                            } else if (this.result.getAllPredictedPositions().length > 0) {
                                jQuery('#phosphat_theoretical').show();                 
                            }
                            var tissues = this.result.getSpectra();
                            var loc_key = null;
                            for (loc_key in tissues) {
                                var long_name = loc_key;
                                var count = tissues[loc_key];
                                updateKey(long_name,count);
                            }
                            updateTags();
                        },
        'url'           : 'proxy.pl',
        'layers'        : ['phosphat_experimental','phosphat_theoretical'],
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
        'layers'        : ['prippdb_experimental'],
    },
    MASCP.PromexReader, { 
        'definition'    : MASCP.PromexReader,
        'nicename'      : 'ProMEX',
        'error_url'     : 'http://promex.pph.univie.ac.at/promex/',
        'success_url'   : 'http://promex.pph.univie.ac.at/promex/index.php?subtext=',
        'result'        : function() {
                            if (this.result.getPeptides().length > 0) {
                                jQuery('#promex_placeholder').show();
                            }
                        },
        'layers'        : ['promex_experimental'],
        'placeholder'   : true
    },
    MASCP.PpdbReader, {
        'definition'    : MASCP.PpdbReader,
        'nicename'      : 'PPDB',
        'error_url'     : 'http://ppdb.tc.cornell.edu',
        'success_url'   : 'http://ppdb.tc.cornell.edu/?refagi=',
        'url'           : 'proxy.pl',
        'result'        : function() {
                                if (this.result.getPeptides().length > 0) {
                                    jQuery('#ppdb_placeholder').show();
                                }
                            },
        'layers'        : ['ppdb'],
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
        'layers'        : ['atchloro'],
    },
    MASCP.AtPeptideReader, {
        'definition'    : MASCP.AtPeptideReader,
        'nicename'      : 'AtPeptide',
        'error_url'     : 'http://proteomics.ucsd.edu/Software/ArabidopsisProteogenomics.html',
        'success_url'   : 'http://proteomics.ucsd.edu/Software/ArabidopsisProteogenomics.html?refagi=',
        'result'        : function() {
                                jQuery(MASCP.getLayer('atpeptide_controller')).each(function() {
                                    if (MASCP.renderer.applyStyle) {
                                        MASCP.renderer.applyStyle(this.name,'cursor: pointer');
                                    }
                                });

                                var loc_key = null;
                                for (loc_key in this.result.spectra) {
                                    var long_name = this.result._long_name_map[loc_key];
                                    var count = this.result.spectra[loc_key];                    
                                    updateKey(long_name,count);
                                }
                                updateTags();
                                if (this.result.getPeptides().length > 0) {
                                    jQuery('#atpeptide_placeholder').show();
                                }
                            },
        'layers'        : ['atpeptide_experimental'],
        'placeholder'   : true
    },
    MASCP.AtProteomeReader, {
        'definition'    : MASCP.AtProteomeReader,
        'nicename'      : 'AtProteome',
        'error_url'     : 'http://fgcz-atproteome.unizh.ch/',
        'success_url'   : 'http://fgcz-atproteome.unizh.ch/index.php?page=query_protein&myassembly=1%239&queryf=',
        'result'        : function() {
                                if (this.result == null) {
                                    return;
                                }

                                jQuery(MASCP.getLayer('atproteome_controller')).each(function() {
                                    if (MASCP.renderer.applyStyle) {
                                        MASCP.renderer.applyStyle(this.name,'cursor: pointer');
                                    }
                                });

                                var loc_key = null;
                                for (loc_key in this.result.spectra) {
                                    var long_name = this.result._long_name_map[loc_key];
                                    var count = this.result.spectra[loc_key];
                                    updateKey(long_name,count);
                                }
                                updateTags();
                                jQuery('#atproteome_placeholder').show();
                            },
        'layers'        : ['atproteome'],
        'placeholder'   : true
    }
);

var seqchange = function() {
    if (MASCP.renderer.sequence == '') {
        return;
    }

    var agi = jQuery('#agi')[0].value;
    
    MASCP.renderer.reset();
    
    if (MASCP.renderer.createHydropathyLayer) {
        MASCP.renderer.createHydropathyLayer(6);
        MASCP.renderer.createLayerCheckbox('hydropathy',jQuery('#hydropathy input')[0],true);
        MASCP.renderer.showLayer('hydropathy');
        jQuery('#hydropathy').show();
    }
    
    jQuery('#tissue_results').text('').append('<div><table id="tissue_tags"><thead><tr><th>tag</th><th>Experiment count</th></tr></thead><tbody></tbody></table></div>');

    document.tagvis = null;

    all_readers = [];
    rendering_readers = [];

    for (var rdr_id in READER_CONF) {
        var rdr = READER_CONF[rdr_id];
        var clazz = rdr.definition;
        var reader = new clazz(agi, rdr.url);
        reader.bind('resultReceived', rdr.result);
        if (rdr.layers.length > 0) {
            reader.registerSequenceRenderer(MASCP.renderer);
            rendering_readers.push(reader);
        }
        all_readers.push(reader);
    }

    for (var rdr_id in READER_CONF) {
        var rdr = READER_CONF[rdr_id];
        if (rdr.placeholder) {
            for (var i = 0; i < rdr.layers.length; i++ ) {
                var lay = rdr.layers[i];
                var placeholder = lay+'';
                placeholder = placeholder.replace(/_experimental/,'') + '_placeholder';
                jQuery('#'+placeholder).hide();
            }
        } else {
            for (var i = 0; i < rdr.layers.length; i++ ) {
                var lay = rdr.layers[i];
                jQuery('#'+lay).hide();                
            }            
        }
    }


    jQuery('#links').text('');
    jQuery('#links').append('<ul></ul>');
    jQuery(all_readers).each(function(i) {

        this.bind('error',function(resp,req,status) {
            var rdr = READER_CONF[this.__class__];
            jQuery('#links ul').append('<li class="error"><a href="'+rdr.error_url+'">'+rdr.nicename+'</a></li>');
            jQuery(MASCP.renderer).trigger('resultsRendered',[this]);
        });

        this.bind('resultReceived',function() {
            var an_agi = this.result.agi;
            var a_locus = an_agi.replace(/\.\d/,'');
            var rdr = READER_CONF[this.__class__];
            jQuery('#links ul').append('<li><a href="'+rdr.success_url+an_agi+'">'+rdr.nicename+'</a></li>');
        });
        
        this.retrieve();
    });
    
    jQuery(MASCP.renderer).bind('resultsRendered',function(e,reader) {
        if (reader.__class__ != MASCP.AtProteomeReader) {
            return;
        }
        
        // Do the selection just for atproteome at the moment
        // while bugs are ironed out
        MASCP.getGroup('atproteome').eachLayer(function() {
            jQuery(this).bind('click',function(e,oe,start,finish) {
                MASCP.renderer.select(start,finish);
                e.stopPropagation();
            });
        });
        
        jQuery(MASCP.renderer).unbind('resultsRendered',arguments.callee);
    });
};
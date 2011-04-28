jQuery(document).ready(function() {
    var supportsXHR = false;
    if (XMLHttpRequest)
    {
        var request = new XMLHttpRequest();
        if ("withCredentials" in request)
        {
            supportsXHR = true;
        }
    }
    
    MASCP.Service.BeginCaching();

    var CSVToArray = function( strData, strDelimiter ){
        strDelimiter = (strDelimiter || ",");

        var objPattern = new RegExp(
        (
        "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
        "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
        "([^\"\\" + strDelimiter + "\\r\\n]*))"
        ),
        "gi"
        );

        var arrData = [[]];
        var arrMatches = null;
        while (arrMatches = objPattern.exec( strData )){
            var strMatchedDelimiter = arrMatches[ 1 ];
            if (
            strMatchedDelimiter.length &&
            (strMatchedDelimiter != strDelimiter)
            ){
                arrData.push( [] );
            }
            if (arrMatches[ 2 ]){
                var strMatchedValue = arrMatches[ 2 ].replace(
                new RegExp( "\"\"", "g" ),
                "\""
                );
            } else {
                var strMatchedValue = arrMatches[ 3 ];
            }
            arrData[ arrData.length - 1 ].push( strMatchedValue );
        }
        return( arrData );
    };


    var loadData = function(data) {
        var reader = new MASCP.UserdataReader();
        MASCP.Service.CacheService(reader);
        
        var agi = jQuery('#agi')[0].value;

        reader.bind('ready',function() {
            this.retrieve(agi);
            refreshSets();
        });
        
        var datasetname = document.getElementById('user_name').value || 'Dataset_'+(new Date()).toLocaleTimeString().replace(/[ :]/g,'_');

        reader.registerSequenceRenderer(MASCP.renderer);
        reader.bind('resultReceived',function() {
            if ( ! jQuery('#'+datasetname).length > 0) {
                jQuery('#sequence_controllers').append('<li id='+datasetname+'><input type="checkbox"/> '+datasetname+'</li>');
                jQuery('#'+datasetname).show();
            }
            jQuery('#sequence_controllers').trigger('sortupdate');
            MASCP.renderer.showLayer(datasetname);
        });

        reader.setData(datasetname,data);        
    };
    
    jQuery('#user_loaddata').bind('click',function() {
        var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        if (regexp.test(document.getElementById('user_data').value)) {
            var uri = document.getElementById('user_data').value;
            var score = 30;

            (new MascotToJSON()).convertReport(uri,score,function(data,error) {
                if (! error) {
                    loadData(data);
                }
            });

            // jQuery.get('mascottojson.njs?score='+score+'&uri='+uri, null, function(data) {
            //     loadData(data);
            // });
        } else {
            var data = CSVToArray(document.getElementById('user_data').value);
            loadData(data);
        }
    });

    
    filetojson('user_data','filetojson.rb', function(t) {
    return true; },function(data) { 
        loadData(data);
        document.getElementById('user_data').value = '';
    });
    
    var refreshSets = function() {
        var existing = document.getElementById('user_existingsets');

        while (existing.childNodes.length > 0) {
            existing.removeChild(existing.firstChild);
        }
        
        MASCP.UserdataReader.datasets(function(set) {
            var set_link = document.createElement('button');
            set_link.textContent = set;
            set_link.onclick = function() {
                var reader = new MASCP.UserdataReader();
                MASCP.Service.CacheService(reader);

                var agi = jQuery('#agi')[0].value;
                var datasetname = set;
            
                reader.registerSequenceRenderer(MASCP.renderer);
                reader.datasetname = set;
                reader.bind('resultReceived',function() {
                    if (! this.result || this.result.length == 0 ) {
                        return;
                    }
                    if ( ! jQuery('#'+datasetname).length > 0) {
                        jQuery('#sequence_controllers').append('<li id='+datasetname+'><input type="checkbox"/> '+datasetname+'</li>');
                        jQuery('#'+datasetname).show();
                    }
                    console.log(jQuery('#sequence_controllers'));
                    jQuery('#sequence_controllers').trigger('sortupdate');
                    MASCP.renderer.showLayer(datasetname);
                });
                reader.retrieve(agi);
            };
            var clear_link = document.createElement('button');
            clear_link.textContent = 'Delete';
            clear_link.onclick = function() {
                MASCP.Service.ClearCache('MASCP.UserdataReader.'+set);
                this.parentNode.parentNode.removeChild(this.parentNode);
            };
            var li = document.createElement('li');
            li.appendChild(set_link);
            li.appendChild(clear_link);
            existing.appendChild(li);
        });
    };
    
    refreshSets();
    
    if (! document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1") || ! supportsXHR ) {
        MASCP.renderer = new MASCP.SequenceRenderer(document.getElementById('sequence_container'));
        if (document.cookie.indexOf('iesplash') < 0) {
            showIESplash();
        }
    } else {
        MASCP.renderer = new MASCP.CondensedSequenceRenderer(document.getElementById('condensed_container'));
        MASCP.renderer.grow_container = true;
        
        var dragger = new GOMap.Diagram.Dragger();
        jQuery("#clicker").bind('click',function() {
            dragger.enabled = ! dragger.enabled;
            if (dragger.enabled) {
                this.value = "Panning";
            } else {
                this.value = "Selecting";
            }
        })
        MASCP.renderer.zoom = 0.81;
        MASCP.renderer.padding = 10;

        jQuery(MASCP.renderer).bind('sequenceChange', function() {
            var zoomFactor = 0.95 * document.width / (2 * MASCP.renderer.sequence.length);
            MASCP.renderer.defaultZoom = zoomFactor;
            MASCP.renderer.zoom = zoomFactor;
            dragger.applyToElement(MASCP.renderer._canvas);
            GOMap.Diagram.addTouchZoomControls(MASCP.renderer, MASCP.renderer._canvas);
            GOMap.Diagram.addScrollZoomControls(MASCP.renderer, MASCP.renderer._canvas)
        });
    }

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
});

jQuery(document).ready(function() {
    
    var rendering_readers = [];
    var all_readers = [];

    var updateTags = function() {
        if (! this.tagvis )  {
            this.tagvis = new MASCP.TagVisualisation("tissue_tags",[MASCP.TagVisualisation.TagCloud]);
            this.tagvis.tagColumn = 0;
            this.tagvis.visualisations[0].tagFactory = function(tagId,tag,row) {
                var span = document.createElement('span');
                span.textContent = tag;
                span.innerText = tag;
                span.id = MASCP.TagVisualisation.TagCloud.TAG_ELEMENT_ID_PREFIX+tagId;
                var valuespan = document.createElement('span');
                valuespan.textContent = row[1].textContent || row[1].innerText;
                valuespan.innerText = row[1].textContent || row[1].innerText;
                span.appendChild(valuespan);
                return span;
            };
        }
        this.tagvis.visualisations[0].update(1);
        if (jQuery('#tissue .rich_tagcloud')[0]) {
            jQuery('#tissue .rich_tagcloud').masonry({ 'itemSelector' : '.rich_tagcloud_tag', 'animate': true });
        }
    };

    document.getElementById('tissue_results').updateKey = function(key,val) {
        key = key.replace(/ves$/,'f');
        key = key.replace(/s$/,'');
        var found = false;
        jQuery('#tissue_results').find('tr td').each(function() {
            if (jQuery(this).html().toString() == key.toString()) {
                var current_val = parseInt(jQuery(this.nextSibling).html());
                jQuery(this.nextSibling).html(current_val + val);
                found = true;
            }
        });
        if (found) {
            return true;
        }
        jQuery('#tissue_results tbody').append("<tr><td>"+key+"</td><td>"+val+"</td></tr>");        
        return false;
    };

    var tweak_track_order = function(array) {            
        if (array.splice && array.indexOf) {
            if (array.indexOf('hydropathy') === -1) {
                array.push('hydropathy');
            }
            for (var rdr_id in READER_CONF) {
                var rdr = READER_CONF[rdr_id];
                if (! rdr.placeholder) {
                    if (rdr.layers.length > 0) {
                        if (array.indexOf(rdr.layers[0]) == -1) {
                            for (var i = 0 ; i < rdr.layers.length; i++) {
                                MASCP.renderer.showLayer(rdr.layers[i]);
                                array.push(rdr.layers[i]);
                            }
                        }                            
                    }
                    continue;
                }
                for (var i = 0; i < rdr.layers.length; i++) {
                    var lay = rdr.layers[i];
                    var placeholder = lay.replace(/_.*$/,'') + '_placeholder';
                    var controller = lay.replace(/_.*$/,'') + '_controller';
                    
                    if (array.indexOf(placeholder) === -1) {
                        array.push(placeholder);
                    }
                    
                    if (MASCP.getGroup(lay) && MASCP.getGroup(lay).size() > 0) {
                        array.splice(array.indexOf(placeholder),1,controller,lay);
                        MASCP.renderer.showLayer(controller);
                    } else {
                        array.splice(array.indexOf(placeholder),1,lay);                        
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
            
    MASCP.renderer.trackOrder = tweak_track_order(jQuery('#sequence_controllers').sortable().sortable('toArray'));

    jQuery('#sequence_controllers').bind('sortupdate',function(event, ui) {
            if (MASCP.renderer.trackOrder) {
                MASCP.renderer.trackOrder = tweak_track_order(jQuery('#sequence_controllers').sortable('toArray'));
            }
            if (MASCP.renderer.setTrackOrder) {
                MASCP.renderer.setTrackOrder(tweak_track_order(jQuery('#sequence_controllers').sortable('toArray')));
            }
    });
    
    if (MASCP.renderer.setTrackOrder) {
        MASCP.renderer.setTrackOrder(MASCP.renderer.trackOrder);                
    }

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
        jQuery('#sequence_controllers').trigger('sortupdate');

    };

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
        document.getElementById('tissue_tags').updateTags = updateTags;

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
                    placeholder = placeholder.replace(/_(.*)$/,'') + '_placeholder';
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
                var an_agi = this.agi;
                var a_locus = an_agi.replace(/\.\d+/,'');
                var rdr = READER_CONF[this.__class__];
                var indexing_id = (rdr.success_url || '').indexOf('locus=true') > 0 ? a_locus : an_agi;
                var datestring = (this.result.retrieved instanceof Date) ? this.result.retrieved.toDateString() : 'Just now';
                jQuery('#links ul').append('<li><a href="'+rdr.success_url+a_locus+'">'+rdr.nicename+'</a><span class="timestamp">'+datestring+'</span></li>');
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
    
    jQuery(MASCP.renderer).bind('resultsRendered',rrend);
    jQuery(MASCP.renderer).bind('sequenceChange',seqchange);
    
});
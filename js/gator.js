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
    
    (function() {
        var onemonthago = new Date();
        onemonthago.setMonth((new Date()).getMonth() - 1);
        MASCP.Service.SweepCache(onemonthago);
    })();
    
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
        while ((arrMatches = objPattern.exec( strData )) !== null){
            var strMatchedDelimiter = arrMatches[ 1 ];
            if (
            strMatchedDelimiter.length &&
            (strMatchedDelimiter != strDelimiter)
            ){
                arrData.push( [] );
            }
            var strMatchedValue;
            
            if (arrMatches[ 2 ]){
                strMatchedValue = arrMatches[ 2 ].replace(
                new RegExp( "\"\"", "g" ),
                "\""
                );
            } else {
                strMatchedValue = arrMatches[ 3 ];
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
            MASCP.renderer.trackOrder = MASCP.renderer.trackOrder.concat([datasetname]);
            MASCP.renderer.showLayer(datasetname);
        });

        reader.setData(datasetname,data);        
    };
    
    jQuery('#user_loaddata').bind('click',function() {
        var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        if (regexp.test(document.getElementById('user_data').value)) {
            var uri = document.getElementById('user_data').value;
            if (uri.match(new RegExp("(http|https)://"+window.location.hostname))) {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", uri,true);
                xhr.onreadystatechange=function() {
                    if (xhr.readyState==4) {
                        var data = xhr.responseText;                        
                        loadData(CSVToArray(data));
                        document.getElementById('user_data').value = '';                        
                    }
                };
                xhr.send(null);
                return;
            }
            
            
            var score = 30;

            (new MascotToJSON()).convertReport(uri,function(data,error) {
                if (! error) {
                    loadData(data);
                } else {
                    document.getElementById('user_data').value = 'Could not load MASCOT result';
                    throw "Error";
                }
            });

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
                    if (! this.result || this.result.length === 0 ) {
                        return;
                    }
                    MASCP.renderer.trackOrder = MASCP.renderer.trackOrder.concat([datasetname]);
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
    
    if (! document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1")) {
        MASCP.renderer = new MASCP.SequenceRenderer(document.getElementById('sequence_container'));
        if (document.cookie.indexOf('iesplash') < 0) {
            showIESplash();
        }
    } else {
        MASCP.renderer = new MASCP.CondensedSequenceRenderer(document.getElementById('condensed_container'));
        MASCP.renderer.grow_container = true;
        
        var dragger = new GOMap.Diagram.Dragger();
        MASCP.renderer.zoom = 0.81;
        MASCP.renderer.padding = 10;

        jQuery(MASCP.renderer).bind('sequenceChange', function() {
            var zoomFactor = 0.95 * window.innerWidth / (2 * MASCP.renderer.sequence.length);
            MASCP.renderer.zoom = zoomFactor;
            dragger.applyToElement(MASCP.renderer._canvas);
            GOMap.Diagram.addTouchZoomControls(MASCP.renderer, MASCP.renderer._canvas);
            GOMap.Diagram.addScrollZoomControls(MASCP.renderer, MASCP.renderer._canvas);
            jQuery('#search').trigger('search');
        });
    }

    jQuery('#zoomin').click(function() {
        MASCP.renderer.zoom *= 1.1;
    });

    jQuery('#zoomout').click(function() {
        MASCP.renderer.zoom *= 0.9;
    });
    
    var search_func = function() {
        var pattern = this.value;
        var re = new RegExp(pattern,"gi");
        re.global = true;
        var n_sites = (pattern == "") ? [] : (MASCP.renderer.sequence.match(re) || []);
        var n_pos = [];
        var last_hit = 0;
        n_sites.forEach(function(site) {
            var pos = MASCP.renderer.sequence.indexOf(site,last_hit);
            n_pos = n_pos.concat([pos,pos+site.length]);
            last_hit = pos+1;
        });
        MASCP.renderer.moveHighlight.apply(MASCP.renderer,n_pos);
    };
    
    jQuery('#search').unbind('change').bind('change',search_func);
    
});

jQuery(document).ready(function() {
    
    var rendering_readers = null;
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
        if ( ! key ) {
            return false;
        }
        key = key.replace(/ves$/,'f');
        key = key.replace(/s$/,'');
        var found = false;
        jQuery('#tissue_results').find('tr td').each(function() {
            if (jQuery(this).html().toString() == key.toString()) {
                var current_val = parseInt(jQuery(this.nextSibling).html(),10);
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
        var readers_to_show = [];
        if (array.splice && array.indexOf) {
            if (array.indexOf('hydropathy') === -1) {
                array.push('hydropathy');
            }
            for (var rdr_id in READER_CONF) {
                if (READER_CONF.hasOwnProperty(rdr_id)) {
                    var rdr = READER_CONF[rdr_id],i;
                    if (! rdr.placeholder) {
                        if (rdr.layers.length > 0) {
                            if (array.indexOf(rdr.layers[0]) == -1) {
                                for (i = 0 ; i < rdr.layers.length; i++) {
                                    readers_to_show.push(rdr.layers[i]);
                                    array.push(rdr.layers[i]);
                                }
                            }                            
                        }
                        continue;
                    }
                    for (i = 0; i < rdr.layers.length; i++) {
                        var lay = rdr.layers[i];
                        var placeholder = lay.replace(/_.*$/,'') + '_placeholder';
                        var controller = lay.replace(/_.*$/,'') + '_controller';
                    
                        if (array.indexOf(placeholder) === -1) {
                            array.push(placeholder);
                        }
                    
                        if (MASCP.getGroup(lay) && MASCP.getGroup(lay).size() > 0) {
                            array.splice(array.indexOf(placeholder),1,controller,lay);
                            readers_to_show.push(controller);
                        } else {
                            array.splice(array.indexOf(placeholder),1,lay);                        
                            readers_to_show.push(lay);
                        }
                    }
                }
            }
            if (MASCP.getGroup('phosphat_peptides') && MASCP.getGroup('phosphat_peptides').size() > 0) {
                array.splice(array.indexOf('phosphat_experimental')+1,0,'phosphat_peptides');                                                
                readers_to_show.push('phosphat_experimental');
            }
        
            if (MASCP.getGroup('prippdb_peptides') && MASCP.getGroup('prippdb_peptides').size() > 0) {
                array.splice(array.indexOf('prippdb_experimental')+1,0,'prippdb_peptides');                                                
                readers_to_show.push('prippdb_experimental');
            }
        }
        if (rendering_readers && rendering_readers.length === 0) {
            readers_to_show.forEach(function(lay) {
                MASCP.renderer.showLayer(lay,true);
            });
            MASCP.renderer.refresh();
        }
        return array;
    };
                
    // 
    // jQuery('#sequence_controllers').bind('sortupdate',function(event, ui) {
    //         if (MASCP.renderer.trackOrder) {
    //             MASCP.renderer.trackOrder = tweak_track_order(jQuery('#sequence_controllers').sortable('toArray'));
    //         }
    //         if (MASCP.renderer.setTrackOrder) {
    //             MASCP.renderer.setTrackOrder(tweak_track_order(jQuery('#sequence_controllers').sortable('toArray')));
    //         }
    // });
    
    // if (MASCP.renderer.setTrackOrder) {
    //     MASCP.renderer.setTrackOrder(MASCP.renderer.trackOrder);                
    // }
    
    var rrend = function(e,reader) {
        if (rendering_readers && rendering_readers.length > 0) {
            rendering_readers.splice(rendering_readers.indexOf(reader),1);
            if (rendering_readers.length > 0) {                
                return;
            }
        }

        if (! rendering_readers) {
            return;
            
        }

        setTimeout(function() {
            jQuery('#agi').focus();            
        },1000);

        
        if (document._screen) {
            document._screen.hide();
        }
                
        MASCP.renderer.trackOrder = tweak_track_order([]);

        rendering_readers = null;

    };

    var seqchange = function() {
        if (MASCP.renderer.sequence == '') {
            return;
        }

        var agi = jQuery('#agi')[0].value;
    
        MASCP.renderer.reset();
    
        if (MASCP.renderer.createHydropathyLayer) {
            MASCP.renderer.createHydropathyLayer(6);
            MASCP.renderer.showLayer('hydropathy');
            jQuery('#hydropathy').show();
        }
    
        jQuery('#tissue_results').text('').append('<div><table id="tissue_tags"><thead><tr><th>tag</th><th>Experiment count</th></tr></thead><tbody></tbody></table></div>');
        document.getElementById('tissue_tags').updateTags = updateTags;

        all_readers = [];
        rendering_readers = [];
        var rdr,rdr_id,lay,i;
        for (rdr_id in READER_CONF) {
            if (READER_CONF.hasOwnProperty(rdr_id)) {
                rdr = READER_CONF[rdr_id];
                var clazz = rdr.definition;
                var reader = new clazz(agi, rdr.url);
                reader.bind('resultReceived', rdr.result);
                if (rdr.layers.length > 0) {
                    reader.registerSequenceRenderer(MASCP.renderer);
                    rendering_readers.push(reader);
                }
                all_readers.push(reader);
            }
        }

        for (rdr_id in READER_CONF) {
            if (READER_CONF.hasOwnProperty(rdr_id)) {
                rdr = READER_CONF[rdr_id];
                if (rdr.placeholder) {
                    for (i = 0; i < rdr.layers.length; i++ ) {
                        lay = rdr.layers[i];
                        var placeholder = lay+'';
                        placeholder = placeholder.replace(/_(.*)$/,'') + '_placeholder';
                        jQuery('#'+placeholder).hide();
                    }
                } else {
                    for (i = 0; i < rdr.layers.length; i++ ) {
                        lay = rdr.layers[i];
                        jQuery('#'+lay).hide();                
                    }            
                }
            }
        }

        var result_function = function() {
            var self_func = arguments.callee;
            var an_agi = this.agi;
            var a_locus = an_agi.replace(/\.\d+/,'');
            var rdr = READER_CONF[this.__class__];
            var indexing_id = (rdr.success_url || '').indexOf('locus=true') > 0 ? a_locus : an_agi;
            var success_url = (rdr.success_url || '').replace(/\#.*$/,'');
            var datestring = (this.result.retrieved instanceof Date) ? this.result.retrieved.toDateString() : 'Just now';
            jQuery('#links ul').append('<li><a href="'+success_url+a_locus+'">'+rdr.nicename+'</a><span class="timestamp data_reload">'+datestring+'</span></li>');
            var li = jQuery('#links ul li:last');
            jQuery('.data_reload', li).bind('click',function(e) {
                var clazz = rdr.definition;
                MASCP.Service.ClearCache(clazz,an_agi);
                var reader = new clazz(an_agi, rdr.url);
                MASCP.Service.registeredLayers(reader).forEach(function(lay) {
                    MASCP.renderer.removeTrack(lay);
                    delete MASCP.layers[lay.name];
                });
                MASCP.Service.registeredGroups(reader).forEach(function(group) {
                    delete MASCP.groups[group.name];
                });
                li.remove();
                
                reader.bind('resultReceived', rdr.result);
                reader.bind('error', error_function);
                
                if (rdr.layers.length > 0) {
                    reader.registerSequenceRenderer(MASCP.renderer);
                }
                jQuery(MASCP.renderer).one('resultsRendered',function(e,read) {
                    if (reader === read) {
                        (rdr.layers || []).forEach(function(lay) {
                            MASCP.renderer.showLayer(lay);
                            MASCP.renderer.showGroup(lay);
                        });
                        MASCP.renderer.refresh();                            
                    }
                });
                reader.bind('resultReceived', self_func);
                reader.retrieve();
            });
            
        };
        
        var error_function = function(resp,req,status) {
            var rdr = READER_CONF[this.__class__];
            var an_agi = this.agi;
            jQuery('#links ul').append('<li class="error"><span class="timestamp data_reload">Error</span><a href="'+rdr.error_url+'">'+rdr.nicename+'</a></li>');
            var li = jQuery('#links ul li:last');
            jQuery('.data_reload', li).bind('click',function(e) {
                var clazz = rdr.definition;
                MASCP.Service.ClearCache(clazz,an_agi);
                var reader = new clazz(an_agi, rdr.url);
                li.remove();
                
                reader.bind('resultReceived', rdr.result);
                if (rdr.layers.length > 0) {
                    reader.registerSequenceRenderer(MASCP.renderer);
                }
                jQuery(MASCP.renderer).one('resultsRendered',function(e,read) {
                    if (reader === read) {
                        (rdr.layers || []).forEach(function(lay) {
                            MASCP.renderer.showLayer(lay);
                            MASCP.renderer.showGroup(lay);
                        });
                        MASCP.renderer.refresh();                            
                    }
                });
                reader.bind('resultReceived', result_function);
                reader.retrieve();
            });

            jQuery(MASCP.renderer).trigger('resultsRendered',[this]);
        };

        jQuery('#links').text('');
        jQuery('#links').append('<ul></ul>');
        jQuery(all_readers).each(function(i) {

            this.bind('error',error_function);

            this.bind('resultReceived',result_function);
        
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
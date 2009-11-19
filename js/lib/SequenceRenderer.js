/**
 * @fileOverview    Read in sequences to be re-rendered in a block that can be easily annotated.
 */

if ( typeof MASCP == 'undefined' ) {
    MASCP = {};
}

/**
 * @class   Reformatter for sequences in html pages. The object retrieves the amino acid sequence from the 
 *          given element, and then reformats the display of the sequence so that rendering layers can be
 *          applied to it. 
 * @author  hjjoshi
 * @param   {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *                                      the container that data will be re-inserted into.
 */
MASCP.SequenceRenderer = function(sequenceContainer) {
    if (sequenceContainer != null) {

        this._container = sequenceContainer;
        this._container.style.position = 'relative';
        this._container.style.width = '100%';

        jQuery(this).bind('sequencechange', function(e){
            jQuery(sequenceContainer).text("");
            jQuery(sequenceContainer).append(this._sequence_els);
            jQuery(sequenceContainer).append(jQuery('<div style="clear: both; float: none; height: 0px; width: 100%;"></div>'));
            this.showRowNumbers();            
        });

        this.setSequence(jQuery(sequenceContainer).text());
    }
    return this;
};

/**
 *  @lends MASCP.SequenceRenderer.prototype
 *  @property   {String}  sequence  Sequence to mark up.
 */
MASCP.SequenceRenderer.prototype = {
    sequence: null 
};

/**
 * Set the sequence for this renderer
 * @param {String} sequence Sequence to render
 */
MASCP.SequenceRenderer.prototype.setSequence = function(sequence)
{
    this.sequence = this._cleanSequence(sequence);
    var sequence_els = [];
    var seq_chars = this.sequence.split('');
    for (var i =0; i < seq_chars.length; i++) {
        var aa = seq_chars[i];
        if (aa.match(/[A-Za-z]/)) {
            sequence_els.push(jQuery('<span>'+aa+'</span>')[0]);
        }
    }

    jQuery(sequence_els).each( function(i) {
        if ( (i % 10) == 0 && i > 0 && ((i % 50) != 0)) {
            this.style.margin = '0px 0px 0px 1em';
        }
        if ( (i % 50) == 0 && i > 0 ) {
            if (MASCP.IE7) {
                sequence_els[i-1].style.styleFloat = 'none';
                sequence_els[i-1].style.width = '1em';
            }
            this.style.clear = 'both';
        }
        
        this.style.display = 'block';
        this.style.cssFloat = 'left';
        this.style.styleFloat = 'left';
        this.style.height = '1.1em';
        this.style.position = 'relative';

        this.addToLayer = MASCP.SequenceRenderer.addElementToLayer;
        this.addBoxOverlay = MASCP.SequenceRenderer.addBoxOverlayToElement;
        this.addToLayerWithLink = MASCP.SequenceRenderer.addElementToLayerWithLink;
    });
    this._sequence_els = sequence_els;   
    jQuery(this).trigger('sequencechange');
};



MASCP.SequenceRenderer.prototype._cleanSequence = function(sequence) {
    if ( ! sequence ) {
        return sequence;
    }
    var cleaned_sequence = sequence;
    cleaned_sequence = cleaned_sequence.replace(new RegExp(String.fromCharCode(160),"g"),'');
    cleaned_sequence = cleaned_sequence.replace(/[\n\t\s\d]+/mgi,'');
    cleaned_sequence = cleaned_sequence.replace(/\(.*\)/g,'');
    return cleaned_sequence;
};

/**
 * Retrieve the HTML Elements that contain the amino acids at the given positions. The first amino acid is found at position 1.
 * @param {Array} indexes Indexes to retrieve elements for
 * @returns Elements representing each amino acid at the given positions
 * @type Array
 */
MASCP.SequenceRenderer.prototype.getAminoAcidsByPosition = function(indexes) {
    var sequence_els = this._sequence_els;
    return jQuery.map(indexes, function(index) {
        return sequence_els[index-1];
    });
};

/**
 * Retrieve the HTML Elements that contain the amino acids contained in the given peptide sequence.
 * @param {String} peptideSequence Peptide sequence used to look up the amino acids
 * @returns Elements representing each amino acid at the given positions
 * @type Array
 */
MASCP.SequenceRenderer.prototype.getAminoAcidsByPeptide = function(peptideSequence) {
    var start = this.sequence.indexOf(peptideSequence);
    var results = [];
    if (start < 0) {
        return results;
    }
    for (var i = 0; i < peptideSequence.length; i++) {
        results.push(this._sequence_els[start+i]);
    }
    return results;
};

/**
 * Show the row numbers on the display of the sequence.
 */
MASCP.SequenceRenderer.prototype.showRowNumbers = function() {
    var numbers = jQuery('<div style="position: absolute; top: 0px; left: 0px; width: 2em;"></div>');
    jQuery(this._sequence_els).each( function(i) {
        if ( (i % 50) == 0) {
            this.style.marginLeft = '3em';
            numbers.append(jQuery('<div style="text-align: right; height: 1.1em;">'+(i+1)+'</div>')[0]);
        }
    });
    jQuery(this._container).append(numbers);
    return this;
};

/**
 * Toggle the display of the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.SequenceRenderer.prototype.toggleLayer = function(layer) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.SequenceRenderer._layers[layer];
    }
    jQuery(this._container).toggleClass(layerName+'_active');
    jQuery(this._container).toggleClass(layerName+'_inactive');
    jQuery(layer).trigger('change',this);
    return this;
};

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.SequenceRenderer.prototype.showLayer = function(layer,consumeChange) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.SequenceRenderer._layers[layer];
    }
    jQuery(this._container).addClass(layerName+'_active');
    jQuery(this._container).addClass('active_layer');    
    jQuery(this._container).removeClass(layerName+'_inactive');
    if (! consumeChange ) {
        jQuery(layer).trigger('change',this);
    }
    return this;
};

/**
 * Hide the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.SequenceRenderer.prototype.hideLayer = function(layer,consumeChange) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.SequenceRenderer._layers[layer];
    }
    jQuery(this._container).removeClass(layerName+'_active');
    jQuery(this._container).removeClass('active_layer');
    jQuery(this._container).addClass(layerName+'_inactive');
    if (! consumeChange ) {
        jQuery(layer).trigger('change',this);
    }
    return this;
};

MASCP.SequenceRenderer.prototype.setGroupVisibility = function(group,visibility) {
    var groupName = group;
    if (typeof group != 'string') {
        groupName = group.name;
    } else {
        group = MASCP.SequenceRenderer._groups[group];
    }
    var renderer = this;
    jQuery(group._layers).each(function(i) {
        if (visibility == true) {
            renderer.showLayer(this.name);
        } else if (visibility == false) {
            renderer.hideLayer(this.name);                
        } else {
            renderer.toggleLayer(this.name);
        }
    });
};

MASCP.SequenceRenderer.prototype.hideGroup = function(group) {
    this.setGroupVisibility(group,false);
}

MASCP.SequenceRenderer.prototype.showGroup = function(group) {
    this.setGroupVisibility(group,true);
}

MASCP.SequenceRenderer.prototype.toggleGroup = function(group) {
    this.setGroupVisibility(group);
}

/**
 * Check if the given layer is active
 * @param {String|Object} layer Layer name, or layer object
 * @returns Whether this layer is active on this renderer
 * @type Boolean
 */
MASCP.SequenceRenderer.prototype.isLayerActive = function(layer) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    }
    return jQuery(this._container).hasClass(layerName+'_active');
};

/**
 * Create a layer controller for this sequence renderer. Attach the controller to the containing box, and shift the box across 20px.
 */
MASCP.SequenceRenderer.prototype.createLayerController = function() {
    var controller_box = jQuery('<div style="position: absolute; top: 0px; font-family: Helvetica, Arial, Sans-serif; margin-left: 20px; left: 100%; width: 250px;"></div>');
    var container = jQuery(this._container);
    container.append(controller_box);

    if ( ! this._controllers ) {
        this._controllers = [];
    }
    this._controllers.push(controller_box);

    var renderer = this;
    
    jQuery(MASCP).bind('layerRegistered', function(e) {
		jQuery(controller_box).accordion('destroy');
		jQuery(controller_box).accordion({header : 'h3', collapsible : true, autoHeight: true, active: false });
	});
    
    
    controller_box.add_layer = function(layer) {
        var layer_controller = jQuery('<div><input type="checkbox"/>'+layer.fullname+'</div>');
        if (layer.group) {
            jQuery(layer.group._layer_container).append(layer_controller);
        } else {
            jQuery(this).append(layer_controller);
        }
        
        renderer.createLayerCheckbox(layer,jQuery('input',layer_controller)[0]);
    };

    controller_box.add_group = function(group) {
        var layer_controller = jQuery('<h3><input style="margin-left: 25px;" type="checkbox"/>'+group.fullname+'</h3>');
        jQuery(this).append(layer_controller);
        var children_container = jQuery('<div style="max-height: 200px; overflow: auto;"></div>');
        jQuery(this).append(children_container);
        
        group._layer_container = children_container[0];
        group._controller = layer_controller;
        
        group._check_intermediate = function() {
            var checked = 0;
            jQuery(group._layers).each(function(i) {
                if (renderer.isLayerActive(this.name)) {
                    checked++;
                }
            });
            var input_el = jQuery('input',layer_controller)[0];
            input_el.indeterminate = (checked != 0 && checked != group._layers.length);
            if (! input_el.indeterminate ) {
                input_el.checked = (checked != 0);
            }
        };
        
        jQuery(jQuery('input',layer_controller)[0]).bind('mouseup',function(e) {
            if (this.indeterminate) {
                jQuery(this).trigger('change');
            }
        });

        renderer.createGroupCheckbox(group,jQuery('input',layer_controller)[0]);
        
    };

    
    jQuery(MASCP).bind("layerRegistered",function(e,layer) {
        if (layer.group && layer.group.hide_member_controllers) {
            return;
        }
        controller_box.add_layer(layer);
    });

    jQuery(MASCP).bind("groupRegistered",function(e,group) {
        if (group.hide_group_controller) {
            return;
        }
        controller_box.add_group(group);
    });

    
    if (MASCP.SequenceRenderer._layers) {
        for (var layerName in MASCP.SequenceRenderer._layers) {
            var layer = MASCP.SequenceRenderer._layers[layerName]
            if (layer.group && layer.group.hide_member_controllers) {
                continue;
            }
            controller_box.add_layer(layer); 
        };
    }
    return this;
};

MASCP.SequenceRenderer.prototype.getHydropathyPlot = function() {
    var base_url = 'http://www.plantenergy.uwa.edu.au/applications/hydropathy/hydropathy.php?title=Hydropathy&amp;sequence=';
    return jQuery('<img style="width: '+(this.sequence.length * 2)+'px;" src="'+base_url+this.sequence+'"/>')[0];
};

/**
 * Create a checkbox that is used to control the given layer
 * @param {String|Object} layer Layer name or layer object that a controller should be generated for
 * @param {Object} inputElement Optional input element to bind events to. If no element is given, a new one is created.
 * @returns Checkbox element that when checked will toggle on the layer, and toggle it off when unchecked
 * @type Object
 */
MASCP.SequenceRenderer.prototype.createLayerCheckbox = function(layer,inputElement) {
    var renderer = this;
    if (! MASCP.SequenceRenderer._layers[layer]) {
        return;
    }
    var the_input = inputElement || jQuery('<input type="checkbox" value="true"/>')[0];
    if (the_input._current_layer == layer) {
        return;
    }
    
    the_input.removeAttribute('checked');
    the_input.checked = this.isLayerActive(layer);
    
    the_input._current_layer = layer;
    
    jQuery(the_input).bind('change',function(e) {
        if (this.checked) {
            renderer.showLayer(layer,false);
        } else {
            renderer.hideLayer(layer,false);
        }
        if (renderer.getLayer(layer).group && renderer.getLayer(layer).group._check_intermediate) {
            renderer.getLayer(layer).group._check_intermediate();
        }
    });
    var layerObj = null;
    
    if (typeof layer == 'string' && MASCP.SequenceRenderer._layers ) {
        layerObj = MASCP.SequenceRenderer._layers[layer];
    } else if (typeof layer == 'object') {
        layerObj = layer;
    }
    
    if (layerObj) {
        jQuery(layerObj).bind("change",function(e) {
            the_input.checked = renderer.isLayerActive(layerObj);
        });
    }
    return the_input;    
};


MASCP.SequenceRenderer.prototype.getLayer = function(layer) {
    return (typeof layer == 'string') ? MASCP.SequenceRenderer._layers[layer] : layer;    
};

MASCP.SequenceRenderer.prototype.getGroup = function(group) {
    return (typeof group == 'string') ? MASCP.SequenceRenderer._groups[group] : group;
};



/**
 * Create a checkbox that is used to control the given group
 * @param {String|Object} group Group name or group object that a controller should be generated for
 * @param {Object} inputElement Optional input element to bind events to. If no element is given, a new one is created.
 * @returns Checkbox element that when checked will toggle on the group, and toggle it off when unchecked
 * @type Object
 */
MASCP.SequenceRenderer.prototype.createGroupCheckbox = function(group,inputElement) {
    var renderer = this;
    var the_input = inputElement ? jQuery(inputElement) : jQuery('<input type="checkbox" value="true"/>');

    if (group == the_input[0]._current_group) {
        return;
    }

    the_input[0].removeAttribute('checked');
//    the_input[0].checked = this.isLayerActive(layer);    
    the_input[0]._current_group = group;
    the_input.bind('change',function(e) {        
        group_obj = renderer.getGroup(group);
        if (! group_obj ) {
            return;
        }
        if (this.checked) {
            jQuery(group_obj._layers).each(function(i) {
                renderer.showLayer(this.name,false);
            });
        } else {
            jQuery(group_obj._layers).each(function(i) {
                renderer.hideLayer(this.name,false);
            });                
        }
    });

    the_input.bind('click',function(e) {
        e.stopPropagation();
    });
    
    return the_input;
};

/**
 * Function to be added to Amino acid elements to facilitate adding elements to layers
 * @private
 * @param {String} layerName The layer that this amino acid should be added to
 * @returns Itself
 * @type Element
 */
MASCP.SequenceRenderer.addElementToLayer = function(layerName)
{
    jQuery(this).addClass(layerName);
    return this;
};

/**
 * Function to be added to Amino acid elements to facilitate adding elements to layers with a link
 * @private
 * @param {String} layerName The layer that this amino acid should be added to
 * @param {String} url URL to link to
 * @returns Itself
 * @type Element
 */
MASCP.SequenceRenderer.addElementToLayerWithLink = function(layerName, url)
{
    jQuery(this).addClass(layerName);
    jQuery(this).append(jQuery('<a href="'+url+'" class="'+layerName+'_overlay" style="display: box; left: 0px; top: 0px; width: 100%; position: absolute; height: 100%;">&nbsp;</a>'));
    return this;    
};

/**
 * Function to be added to Amino acid elements to facilitate adding box overlays to elements
 * @private
 * @param {String} layerName The layer that this amino acid should be added to, as well as the fraction opacity to use for this overlay
 * @returns Itself
 * @type Element
 */
MASCP.SequenceRenderer.addBoxOverlayToElement = function(layerName, fraction)
{
    jQuery(this).addClass(layerName);
    jQuery(this).append(jQuery('<div class="'+layerName+'_overlay" style="top: 0px; width: 100%; position: absolute; height: 100%; opacity:'+fraction+';"></div>'));
    return this;
};

/**
 * Register a group with metadata for all sequence renderers.
 * @static
 * @param {String} groupName Name to give to this group
 * @param {String} options Options to give this group: name, and flags for hiding group member and whole group controllers: hide_member_controllers and hide_group_controller respectively
 */
MASCP.SequenceRenderer.registerGroup = function(groupName, options)
{
    if ( ! this._groups ) {
        this._groups = {};
    }
    if (this._groups[groupName]) {
        return;
    }
    
    var group = {};
    
    group['name'] = groupName;
    
    options = options || {};
    
    if (options['hide_member_controllers']) {
        group['hide_member_controllers'] = true;
    }

    if (options['hide_group_controller']) {
        group['hide_group_controller'] = true;
    }

    if (options['fullname']) {
        group['fullname'] = options['fullname'];
    }
    
    group._layers = [];
    
    this._groups[groupName] = group;
    
    jQuery(MASCP).trigger('groupRegistered',group);    
}

MASCP.SequenceRenderer.reset = function()
{
    MASCP.SequenceRenderer._groups = {};
    MASCP.SequenceRenderer._layers = {};
};

/**
 * Register a layer with metadata for all sequence renderers.
 * @static
 * @param {String} layerName Name to give to this layer
 * @param {String} options Options to give this layer: fullname, color and optional CSS block.
 */
MASCP.SequenceRenderer.registerLayer = function(layerName, options)
{
    if ( ! this._layers ) {
        this._layers = {};
    }
    if (this._layers[layerName]) {
        return;
    }
    
    var layer = {};
    
    layer['name'] = layerName;
    
    options = options || {};
    
    if (options['fullname']) {
        layer['fullname'] = options['fullname'];
    }
    
    if (options['color']) {
        layer['color'] = options['color'];
    }
    
    if (options['group']) {
        layer['group'] = this._groups ? this._groups[options['group']] : null;
        if ( ! layer['group'] ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
        layer['group']._layers.push(layer);
    }
    
    
    this._layers[layerName] = layer;
    
    if (options['css']) {
        layerCss = options['css'];
        layerCss = layerCss.replace(/\.inactive/g, '.'+layerName+'_inactive .'+layerName);
        layerCss = layerCss.replace(/\.tracks\s+\.active/g, '.'+layerName+'_active .track .'+layerName);
        layerCss = layerCss.replace(/\.active/g, '.'+layerName+'_active .'+layerName);
        layerCss = layerCss.replace(/\.overlay/g, '.'+layerName+'_overlay');
        jQuery('<style type="text/css">'+layerCss+'</style>').appendTo('head');
    }
    jQuery(MASCP).trigger('layerRegistered',layer);
};

MASCP.CondensedSequenceRenderer = function(sequenceContainer) {
    MASCP.SequenceRenderer.apply(this,arguments);
    var self = this;
    jQuery(MASCP).bind('layerRegistered', function(e,layer) {
        self.addTrack(layer);
        self.hideLayer(layer);
    });
    jQuery(this).unbind('sequencechange');    
    jQuery(this).bind('sequencechange',function() {
        for (var layername in MASCP.SequenceRenderer._layers) {
            self.addTrack(MASCP.SequenceRenderer._layers[layername]);
        }
        self.resizeTracks();
        self.resizeContainer();
    });
    return this;
};

MASCP.CondensedSequenceRenderer.prototype = new MASCP.SequenceRenderer();


MASCP.CondensedSequenceRenderer.prototype.resizeTracks = function() {
    if (this._track_container) {
        this._track_container.style.width = 2*this.sequence.length+'px';
    }    
};

MASCP.CondensedSequenceRenderer.prototype.resizeContainer = function() {
    if (this._container && this._canvas) {
        this._container.style.width = (this._zoomLevel || 1)*2*this.sequence.length+'px';
        this._container.style.height = (this._zoomLevel || 1)*2*(this._canvas._canv_height)+'px';
//        this._container.style.height = (this._zoomLevel || 1)*2*this._canvas.getAttribute('height')+'px';
    }    
};


MASCP.CondensedSequenceRenderer.prototype.showRowNumbers = function() {
    return this;
};

MASCP.CondensedSequenceRenderer.prototype.setSequence = function(sequence) {
    this.sequence = this._cleanSequence(sequence);
    var seq_chars = this.sequence.split('');
    var line_length = seq_chars.length;
    var canvas = null;
    var container = null;
    var mouse_events = null;

    if (this._object) {
        var track_el = this._object.parentNode;        
        svgweb.removeChild(this._object, this._object.parentNode);
        track_el.parentNode.removeChild(track_el);
        this._canvas = null;
        this._object = null;
    } 

    container = jQuery('<div class="track"></div>')[0];
    canvas = document.createElement('object',true);
    canvas.setAttribute('data','blank.svg');
    canvas.setAttribute('type','image/svg+xml');
    canvas.setAttribute('width','100%');
    canvas.setAttribute('height','100%');
    canvas.addEventListener('load',function() {
        renderer._canvas = this.contentDocument.rootElement;
        renderer._object = this;
        jQuery(renderer).trigger('svgready');
        jQuery(renderer).trigger('sequenceready');
    },false);        
    jQuery(this._container).append(container);        

    var renderer = this;
    var seq_els = [];
    
    jQuery(seq_chars).each( function(i) {
        var el = {};
        el._index = i;
        el._renderer = renderer;
        el.addToLayer = MASCP.CondensedSequenceRenderer.addElementToLayer;
        el.addBoxOverlay = MASCP.CondensedSequenceRenderer.addBoxOverlayToElement;
        el.addToLayerWithLink = MASCP.CondensedSequenceRenderer.addElementToLayerWithLink;
        seq_els.push(el);
    });

    this._sequence_els = seq_els;

    jQuery(this).unbind('svgready');
        
    jQuery(this).bind('svgready',function() {
    var canv = this._canvas;

    canv.setAttribute('viewBox', '0 0 '+(line_length+20)+' 100');
    canv.setAttribute('background', '#000000');

    
    canv.path = function(pathdesc) {
      var a_path = document.createElementNS(svgns,'path');
      a_path.setAttribute('d', pathdesc);
      a_path.setAttribute('stroke','#000000');
      this.appendChild(a_path);
      return a_path;
    };

    canv.rect = function(x,y,width,height) {
      var a_rect = document.createElementNS(svgns,'rect');
      a_rect.setAttribute('x', x);
      a_rect.setAttribute('y', y);
      a_rect.setAttribute('width', width);
      a_rect.setAttribute('height', height);
      a_rect.setAttribute('stroke','#000000');
      this.appendChild(a_rect);
      return a_rect;
    };

    canv.set = function() {
        var an_array = new Array();
        an_array.attr = function(hash) {
            for (var key in hash) {
                for (var i = 0; i < an_array.length; i++) {
                    an_array[i].setAttribute(key, hash[key]);
                }
            }
        };
        an_array.hide = function() {
            this.attr({ 'display' : 'none'});
        }
        an_array.show = function() {
            this.attr({ 'display' : 'block'});
        }
        return an_array;
    };
    
    canv.text = function(x,y,text) {
        var a_text = document.createElementNS(svgns,'text');
        a_text.textContent = text;
//        a_text.style.fontSize = '8pt';
        a_text.style.fontFamily = 'Helvetica, Verdana, Arial, Sans-serif';
        a_text.setAttribute('x',x);
        a_text.setAttribute('y',y);        
        this.appendChild(a_text);
        return a_text;
    };
    
    canv.setAttribute('preserveAspectRatio','xMinYMin meet');
    canv.path('M10 20l'+line_length+' 0');
    canv.path('M10 10 l0 20');
    canv.path('M'+(10+line_length)+' 10 l0 20');
    var x = 10;
    var graph_els = {};
    
    var big_ticks = canv.set();
    var little_ticks = canv.set();
    var big_labels = canv.set();
    var little_labels = canv.set();
    
    for (var i = 0; i < (line_length/5); i++ ) {

        if ( (x % 10) == 0) {
            big_ticks.push(canv.path('M'+x+' 14 l 0 12'));
        } else {
            little_ticks.push(canv.path('M'+x+' 16 l 0 8'));
        }

        if ( (x % 20) == 0 ) {
            big_labels.push(canv.text(x,5,""+(x-10)));
        } else if (( x % 10 ) == 0 && x != 10) {
            little_labels.push(canv.text(x,7,""+(x-10)));
        }

        x += 5;
    }
    
    for ( var i = 0; i < big_labels.length; i++ ) {
        big_labels[i].style.textAnchor = 'middle';
        big_labels[i].setAttribute('dominant-baseline','hanging');
        big_labels[i].setAttribute('font-size','7pt');
//        big_labels[i].childNodes[0].setAttribute('dominant-baseline','hanging');
    }

    for ( var i = 0; i < little_labels.length; i++ ) {
        little_labels[i].style.textAnchor = 'middle';
        little_labels[i].setAttribute('dominant-baseline','hanging');
        little_labels[i].setAttribute('font-size','2pt');        
        little_labels[i].style.fill = '#000000';
    }
    
    little_ticks.attr({ 'stroke':'#555555', 'stroke-width':'0.5pt'});
    little_ticks.hide();
    little_labels.hide();
    jQuery(renderer).bind('zoomchange', function() {
       if (renderer.zoom > 1.8) {
           big_labels.attr({'font-size':'4pt','y':'7'});
           little_labels.attr({'font-size':'4pt'});
           little_ticks.show();
           little_labels.show();
       } else {
           big_labels.attr({'font-size':'7pt','y':'5'});
           little_ticks.hide();
           little_labels.hide();
       }
    });
    graph_els['big_tickmarks'] = big_ticks;
    graph_els['little_tickmarks'] = little_ticks;
    });
    
    if (this._canvas) {
       jQuery(this).trigger('svgready');
    } else {
        svgweb.appendChild(canvas,container);        
    }
    jQuery(this).trigger('sequencechange');    
};


MASCP.CondensedSequenceRenderer.addElementToLayer = function(layerName) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(10+this._index,60,2,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);
};

MASCP.CondensedSequenceRenderer.addBoxOverlayToElement = function(layerName,fraction,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(10+this._index,60,width,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.style.strokeWidth = '0px';
    rect.setAttribute('display', 'none');
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
};

MASCP.CondensedSequenceRenderer.addElementToLayerWithLink = function(layerName,url,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(10+this._index,60,width,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';    
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);
};

MASCP.CondensedSequenceRenderer.prototype.clearTracks = function() {
    if ( this._layer_containers ) {
        this._layer_containers = null;
    }
};

MASCP.CondensedSequenceRenderer.prototype.addTrack = function(layer) {
    if ( ! this._canvas ) {
        log("No canvas to draw upon");
        return;
    }
    if ( ! this._layer_containers ) {
        this._layer_containers = {};
        this._track_order = [];
    }
    if ( ! this._layer_containers[layer.name]) {                
        this._layer_containers[layer.name] = this._canvas.set();
        this._track_order.push(layer.name);
        var self = this;
        jQuery(layer).bind('change',function(e,renderer) {
            if (renderer != self) {
                return;
            }
            self.reflowTracks();
            self.resizeContainer();
        });
    }
    this.hideLayer(layer);
};

MASCP.CondensedSequenceRenderer.prototype.reflowTracks = function() {
    var track_heights = 20;
    for (var i = 0; i < this._track_order.length; i++ ) {
        if (this.isLayerActive(this._track_order[i])) {
            track_heights += 10;
        }
        this._layer_containers[this._track_order[i]].attr({ 'y' : track_heights });
    }    
    var currViewBox = this._canvas.getAttribute('viewBox') ? this._canvas.getAttribute('viewBox').split(/\s/) : [0,0,(this.sequence.split('').length+20),0];
    this._canvas.setAttribute('viewBox', '0 0 '+currViewBox[2]+' '+(track_heights+10));
//    this._canvas.setAttribute('width',currViewBox[2]);
//    this._canvas.setAttribute('height', (track_heights+10));
    this._canvas._canv_height = (track_heights+10);
};

MASCP.CondensedSequenceRenderer.prototype.trackOrder = function() {
    return this._track_order;
};

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.CondensedSequenceRenderer.prototype.showLayer = function(layer,consumeChange) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.SequenceRenderer._layers[layer];
    }
    this._layer_containers[layerName].attr({ 'display' : 'block' });    

    jQuery(this._container).addClass(layerName+'_active');
    jQuery(this._container).addClass('active_layer');    
    jQuery(this._container).removeClass(layerName+'_inactive');
    if (! consumeChange ) {
        jQuery(layer).trigger('change',this);
    }
    return this;
};

/**
 * Hide the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.CondensedSequenceRenderer.prototype.hideLayer = function(layer,consumeChange) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.SequenceRenderer._layers[layer];
    }
    
    jQuery(this._container).removeClass(layerName+'_active');
    jQuery(this._container).removeClass('active_layer');
    jQuery(this._container).addClass(layerName+'_inactive');
    this._layer_containers[layerName].attr({ 'display' : 'none' });    
    if (! consumeChange ) {
        jQuery(layer).trigger('change',this);
    }
    return this;
};

MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("zoom", function(zoomLevel) {
   this._zoomLevel = zoomLevel;
   this.resizeContainer();
   jQuery(this).trigger('zoomchange');
//   this._container.style.width = 2*zoomLevel*this.sequence.split('').length+'px'; 
//   this._container.style.height = 'auto';
});

MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("zoom", function() {
   return this._zoomLevel;
});


//MASCP.CondensedSequenceRenderer.prototype.makeDraggable = GOMap.Diagram.prototype.makeDraggable;
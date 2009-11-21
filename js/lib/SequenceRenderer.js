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

        jQuery(this).bind('sequenceChange', function(e){
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
 * @name    MASCP.SequenceRenderer#sequenceChange
 * @event
 * @param   {Object}    e
 */

/**
 * @name    MASCP.SequenceRenderer#visibilityChange
 * @event
 * @param   {Object}    e
 * @param   {Object}    renderer
 * @param   {Boolean}   visibility
 */



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
    jQuery(this).trigger('sequenceChange');
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
    jQuery(layer).trigger('visibilityChange',[this,this.isLayerActive(layer)]);
    return this;
};

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.SequenceRenderer.prototype.showLayer = function(lay,consumeChange) {
    var layerName = lay;
    var layer;
    if (typeof lay != 'string') {
        layerName = lay.name;
        layer = lay;
    } else {
        layer = MASCP.SequenceRenderer._layers[lay];
        layerName = lay;
    }
    
    jQuery(this._container).addClass(layerName+'_active');
    jQuery(this._container).addClass('active_layer');    
    jQuery(this._container).removeClass(layerName+'_inactive');
    if (! consumeChange ) {
        jQuery(layer).trigger('visibilityChange',[this,true]);
    }
    return this;
};

/**
 * Hide the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.SequenceRenderer.prototype.hideLayer = function(lay,consumeChange) {
    var layerName = lay;
    var layer;
    if (typeof lay != 'string') {
        layerName = lay.name;
        layer = lay;
    } else {
        layer = MASCP.SequenceRenderer._layers[lay];
        layerName = lay;
    }
    
    jQuery(this._container).removeClass(layerName+'_active');
    jQuery(this._container).removeClass('active_layer');
    jQuery(this._container).addClass(layerName+'_inactive');
    if (! consumeChange ) {
        jQuery(layer).trigger('visibilityChange',[this,true]);
    }
    return this;
};

MASCP.SequenceRenderer.prototype.setGroupVisibility = function(grp,visibility) {
    var groupName = grp;
    var group;
    if (typeof grp != 'string') {
        groupName = group.name;
        group = grp;
    } else {
        group = MASCP.SequenceRenderer._groups[grp];
        groupName = group.name;
    }
    var renderer = this;
    jQuery(group._layers).each(function(i) {
        if (this.disabled) {
            return;
        }
        if (visibility == true) {
            renderer.showLayer(this.name);
        } else if (visibility == false) {
            renderer.hideLayer(this.name);                
        } else {
            renderer.toggleLayer(this.name);
        }
    });
    if (visibility != null) {
        jQuery(group).trigger('visibilityChange',[renderer,visibility]);
    }
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
    if (layer == the_input._current_layer) {
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
        jQuery(layerObj).bind("visibilityChange",function(e,rend,visibility) {
            if (rend != renderer) {
                return;
            }
            the_input.checked = visibility;
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
    var groupObject = this.getGroup(group);
    
    if (! groupObject ) {
        return;
    }
    
    if (groupObject == the_input[0]._current_group) {
        return;
    }

    the_input[0].removeAttribute('checked');
    the_input[0]._current_group = groupObject;
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

    if (groupObject) {
        jQuery(renderer.getGroup(group)).bind('visibilityChange', function(e,rend,visibility) {
            if (rend != renderer) {
                return;
            }
            the_input[0].checked = visibility;
        });
    } else {
        log("Too early for group bind");
    }

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

    group.group_id = new Date().getMilliseconds();
    
    this._groups[groupName] = group;
    
    jQuery(MASCP).trigger('groupRegistered',[group]);
}

MASCP.SequenceRenderer.prototype.reset = function()
{
    jQuery(this._container).attr('class',null);
    for ( var group in MASCP.SequenceRenderer._groups) {
        log("Hiding the group "+this.getGroup(group).group_id);
        this.hideGroup(group);
    }    
    for ( var layer in MASCP.SequenceRenderer._layers) {
        this.hideLayer(layer);
        MASCP.SequenceRenderer._layers[layer].disabled = true;
    }
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
        this._layers[layerName].disabled = false;
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
    layer.layer_id = new Date().getMilliseconds();
    
    jQuery(MASCP).trigger('layerRegistered',[layer]);
};
/**
 * @fileOverview    Read in sequences to be re-rendered in a block that can be easily annotated.
 */

if ( typeof MASCP == 'undefined' ) {
    MASCP = {};
    var ie = (function(){

        var undef,
            v = 3,
            div = document.createElement('div'),
            all = div.getElementsByTagName('i');

            do {
                div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->';
            } while (all[0]);

        return v > 4 ? v : undef;

    }());
    if (ie) {
        if (ie === 7) {
            MASCP.IE = true;
            MASCP.IE7 = true;
        }
        if (ie === 8) {
            MASCP.IE = true;
            MASCP.IE8 = true;
        }
    }
}


/**
 *  @lends MASCP.Group.prototype
 *  @property   {String}        name                        Name for this group to be used as an identifier
 *  @property   {String}        fullname                    The full (long) name for this group, that can be used in UI widgets for labelling
 *  @property   {String}        color                       Color string to apply to this group
 *  @property   {Boolean}       hide_member_controllers     For controllers for this group, do not show the layer controllers for this group
 *  @property   {Boolean}       hide_group_controller       For controllers for this group do not show the parent group controller
 */

/**
 * Register a group with metadata for all sequence renderers.
 * @static
 * @param {String} groupName    Name to give to this group
 * @param {Hash} options        Options to apply to this group - see MASCP.Group for all the fields
 * @returns New group object
 * @type MASCP.Group
 * @see MASCP.event:groupRegistered
 * @see MASCP.Group
 */
MASCP.registerGroup = function(groupName, options)
{
    if ( ! this.groups ) {
        this.groups = {};
    }
    if (this.groups[groupName]) {
        return;
    }
    
    var group = new MASCP.Group();
    
    group.name = groupName;
    
    options = options || {};
    
    if (options.hide_member_controllers) {
        group.hide_member_controllers = true;
    }

    if (options.hide_group_controller) {
        group.hide_group_controller = true;
    }

    if (options.fullname) {
        group.fullname = options.fullname;
    }
    
    if (options.color) {
        group.color = options.color;
    }

    if (options.group) {
        group.group = this.getGroup(options.group);
        if ( ! group.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
        group.group._layers.push(group);
    }

    group._layers = [];

    group.group_id = new Date().getMilliseconds();
    
    this.groups[groupName] = group;
    
    bean.fire(MASCP,'groupRegistered',[group]);
    
    return group;
};

/**
 *  @lends MASCP.Layer.prototype
 *  @property   {String}        name        Name for this layer to be used as an identifier
 *  @property   {String}        fullname    The full (long) name for this layer, that can be used in UI widgets for labelling
 *  @property   {String}        color       Color string to apply to this layer
 *  @property   {MASCP.Group}   group       Group that this layer is part of. Either a group object, or the name for the group.
 *  @property   {String}        css         CSS block for this layer. Active and inactive layers are children of the .active and .inactive classes respectively. To target a track-based rendering, use the .tracks class first, and to target overlays, use the .overlay class last
 *  @property   {Object}        data        Data for this layer
 */

/**
 * Register a layer with metadata for all sequence renderers.
 * @static
 * @param {String} layerName    Name to give to this layer
 * @param {Hash} options        Options to set field values for this layer - see the fields for MASCP.Layer.
 * @returns New layer object
 * @type MASCP.Layer
 * @see MASCP.Layer
 * @see MASCP.event:layerRegistered
 */
MASCP.registerLayer = function(layerName, options)
{
    if ( ! this.layers ) {
        this.layers = {};
    }
    if (this.layers[layerName]) {
        if (this.layers[layerName].disabled) {
            this.layers[layerName].disabled = false;
            bean.fire(MASCP,'layerRegistered',[this.layers[layerName]]);
        }
        return this.layers[layerName];
    }
    
    var layer = new MASCP.Layer();
    
    layer.name = layerName;
    
    options = options || {};
    
    if (options.fullname) {
        layer.fullname = options.fullname;
    }
    
    if (options.color) {
        layer.color = options.color;
    }
    
    if (options.group) {
        layer.group = this.getGroup(options.group);
        if ( ! layer.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
        layer.group._layers.push(layer);
    }
    
    if (options.data) {
        layer.data = options.data;
    }
    
    
    this.layers[layerName] = layer;
    
    if (options.css) {
        layerCss = options.css;
        layerCss = layerCss.replace(/\.inactive/g, '.'+layerName+'_inactive .'+layerName);
        layerCss = layerCss.replace(/\.tracks\s+\.active/g, '.'+layerName+'_active .track .'+layerName);
        layerCss = layerCss.replace(/\.active/g, '.'+layerName+'_active .'+layerName);
        layerCss = layerCss.replace(/\.overlay/g, '.'+layerName+'_overlay');
        jQuery('<style type="text/css">'+layerCss+'</style>').appendTo('head');
    }
    layer.layer_id = new Date().getMilliseconds();
    
    bean.fire(MASCP,'layerRegistered',[layer]);
    
    return layer;
};

/**
 * @class
 * Metadata for a group of layers to be rendered
 */
MASCP.Group = function() {
    return;
};

/**
 * Describe what this method does
 * @private
 * @param {String|Object|Array|Boolean|Number} paramName Describe this parameter
 * @returns Describe what it returns
 * @type String|Object|Array|Boolean|Number
 */
MASCP.Group.prototype.size = function() {
    var counter = 0;
    for (var i = 0 ; i < this._layers.length; i++ ) {
        if (! this._layers[i].disabled) {
            counter += 1;
        }
    }
    return counter;
};

MASCP.Group.prototype.eachLayer = function(func) {
    for (var i = 0 ; i < this._layers.length; i++ ) {
        if (! this._layers[i].disabled) {
            func.call(this._layers[i],this._layers[i]);
        }
    }    
};

/**
 * @class
 * Metadata for a single layer to be rendered
 */
MASCP.Layer = function() {
    return;
};

/**
 * @class   Reformatter for sequences in html pages. The object retrieves the amino acid sequence from the 
 *          given element, and then reformats the display of the sequence so that rendering layers can be
 *          applied to it. 
 * @author  hjjoshi
 * @param   {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *                                      the container that data will be re-inserted into.
 * @requires jQuery
 */
MASCP.SequenceRenderer = (function() {

    /**
     *  @lends MASCP.SequenceRenderer.prototype
     *  @property   {Array}     trackOrder  The order of tracks on the renderer, an array of layer/group names.
     */
    var setupTrackOrder = function(renderer) {
        var renderer_track_order = [];

        var accessors = {

            getTrackOrder: function() {
                return renderer_track_order;
            },

            setTrackOrder: function(in_order) {
                var track_order = [];
                var order = in_order;
                if ( ! order instanceof Array ) {
                    order = [ in_order ];
                }

                for (var i = 0; i < order.length; i++) {
                    var a_track = order[i];
                    if (MASCP.getLayer(a_track)) {
                        track_order.push(a_track);                        
                    } else if (MASCP.getGroup(a_track)) {
                        MASCP.getGroup(order[i]).eachLayer(function(grp_lay) {
                            order.splice(i+1,0,grp_lay.name);
                        });
                    }
                }
                for (i = ((renderer_track_order || []).length - 1); i >= 0; i--) {
                    if (track_order.indexOf(renderer_track_order[i]) < 0) {
                        this.hideLayer(renderer_track_order[i]);
                        this.hideGroup(renderer_track_order[i]);
                        jQuery(MASCP.getLayer(renderer_track_order[i])).trigger('removed');
                        jQuery(MASCP.getGroup(renderer_track_order[i])).trigger('removed');
                    }
                }
                renderer_track_order = track_order;

                if (this.refresh) {
                    this.refresh(true);
                }
                jQuery(renderer).trigger('orderChanged', [ track_order ] );

            }
        };

        if (MASCP.IE) {
            renderer.setTrackOrder = accessors.setTrackOrder;
        }

        if ((typeof Object.defineProperty == 'function') && ! MASCP.IE8 ) {
            Object.defineProperty(renderer,"trackOrder", {
                get : accessors.getTrackOrder,
                set : accessors.setTrackOrder
            });
        }
    };

    return function(sequenceContainer) {
        if (typeof sequenceContainer !== 'undefined') {
            this._container = sequenceContainer;
            this._container.style.position = 'relative';
    //        this._container.style.width = '100%';

            jQuery(this).bind('sequenceChange', function(e){
                jQuery(sequenceContainer).text("");
                jQuery(sequenceContainer).append(this._sequence_els);
                jQuery(sequenceContainer).append(jQuery('<div style="clear: both; float: none; height: 0px; width: 100%;"></div>'));
                sequenceContainer.style.width = (this._sequence_els.length)+'em';
    //            this.showRowNumbers();            
            });

            this.setSequence(jQuery(sequenceContainer).text());
        }
        
        setupTrackOrder(this);
        
        return this;
    };
})();

/**
 * Event fired when a layer is registered with the global layer registry
 * @name    MASCP.layerRegistered
 * @event
 * @param   {Object}    e
 * @param   {Object}    layer Layer just registered
 */

/**
 * Event fired when a group is registered with the global group registry
 * @name    MASCP.groupRegistered
 * @event
 * @param   {Object}    e
 * @param   {Object}    group Group just registered
 */

/**
 * Event fired when the sequence is changed in a sequence renderer
 * @name    MASCP.SequenceRenderer#sequenceChange
 * @event
 * @param   {Object}    e
 */

/**
 * Event fired when a result is rendered on this renderer
 * @name    MASCP.SequenceRenderer#resultsRendered
 * @event
 * @param   {Object}    e
 * @param   {MASCP.Service} reader  Reader that rendered the result.
 */

/**
 * @name    MASCP.Group#visibilityChange
 * @event
 * @param   {Object}    e
 * @param   {Object}    renderer
 * @param   {Boolean}   visibility
 */

/**
 * @name    MASCP.Layer#visibilityChange
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
 
if ( MASCP.IE ) {
    MASCP.SequenceRenderer.prototype.prototype = document.createElement('div');
}


/**
 * Set the sequence for this renderer. Fires the sequenceChange event when the sequence is set.
 * @param {String} sequence Sequence to render
 * @see MASCP.SequenceRenderer#event:sequenceChange
 */
MASCP.SequenceRenderer.prototype.setSequence = function(sequence)
{
    this.sequence = this._cleanSequence(sequence);
    var sequence_els = [];
    var renderer = this;
    if ( ! this.sequence ) {
        return;
    }
    var seq_chars = this.sequence.split('');
    for (var i =0; i < seq_chars.length; i++) {
        var aa = seq_chars[i];
        if (aa.match(/[A-Za-z]/)) {
            sequence_els.push(jQuery('<span>'+aa+'</span>')[0]);
        }
    }

    jQuery(sequence_els).each( function(i) {
        // if ( (i % 10) == 0 && i > 0 && ((i % 50) != 0)) {
        //     this.style.margin = '0px 0px 0px 1em';
        // }
        // if ( (i % 50) == 0 && i > 0 ) {
        //     if (MASCP.IE7) {
        //         sequence_els[i-1].style.styleFloat = 'none';
        //         sequence_els[i-1].style.width = '1em';
        //     }
        //     this.style.clear = 'both';
        // }
        
        this._index = i;
        
        this.style.display = 'block';
        this.style.cssFloat = 'left';
        this.style.styleFloat = 'left';
        this.style.height = '1.1em';
        this.style.position = 'relative';

        this.addToLayer = MASCP.SequenceRenderer.addElementToLayer;
        this.addBoxOverlay = MASCP.SequenceRenderer.addBoxOverlayToElement;
        this.addToLayerWithLink = MASCP.SequenceRenderer.addElementToLayerWithLink;
        this._renderer = renderer;
    });
    this._sequence_els = sequence_els;   
    jQuery(this).trigger('sequenceChange');
};

/**
 * Color some residues on this residue
 * @param {Array} indexes Indexes to apply the given color to
 * @param {String} color Color to use to highlight the residues
 * @returns ID for the layer that is created
 * @type String
 */
MASCP.SequenceRenderer.prototype.colorResidues = function(indexes, color) {
    var layer_id = Math.floor(Math.random()*1000).toString();
    MASCP.registerLayer(layer_id, { 'color' : (color || '#ff0000') });
    var aas = this.getAminoAcidsByPosition(indexes);
    for (var i = 0; i < aas.length; i++ ) {
        aas[i].addToLayer(layer_id);
    }
    return MASCP.getLayer(layer_id);
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

MASCP.SequenceRenderer.prototype.getAA = function(index) {
    return this.getAminoAcidsByPosition([index]).shift();
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
        results.addToLayer = function() {};
        return results;
    }
    results = results.concat(this._sequence_els.slice(start,start+(peptideSequence.length)));
    if (results.length) {
        results.addToLayer = function(layername, fraction) {
            return results[0].addBoxOverlay(layername,results.length,fraction);
        };
    } else {
        results.addToLayer = function() {};
    }
        
    return results;
};

/*
 * Show the row numbers on the display of the sequence.
 */
MASCP.SequenceRenderer.prototype.showRowNumbers = function() {
    var numbers = jQuery('<div style="position: absolute; top: 0px; left: 0px; width: 2em;"></div>');
    jQuery(this._sequence_els).each( function(i) {
        if ( (i % 50) === 0) {
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
 * @see MASCP.Layer#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.toggleLayer = function(layer,consumeChange) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.layers[layer];
    }
    jQuery(this._container).toggleClass(layerName+'_active');
    jQuery(this._container).toggleClass(layerName+'_inactive');
    if ( ! consumeChange ) {
        jQuery(layer).trigger('visibilityChange',[this,this.isLayerActive(layer)]);
    }
    return this;
};

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.showLayer = function(lay,consumeChange) {
    var layer = MASCP.getLayer(lay);

    if (! layer || layer.disabled) {
        return;
    }
    jQuery(this._container).addClass(layer.name+'_active');
    jQuery(this._container).addClass('active_layer');    
    jQuery(this._container).removeClass(layer.name+'_inactive');
    if ( ! consumeChange ) {
        jQuery(layer).trigger('visibilityChange',[this,true]);
    }
    return this;
};

/**
 * Hide the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.hideLayer = function(lay,consumeChange) {
    var layer = MASCP.getLayer(lay);

    if (! layer || layer.disabled) {
        return;
    }
        
    jQuery(this._container).removeClass(layer.name+'_active');
    jQuery(this._container).removeClass('active_layer');
    jQuery(this._container).addClass(layer.name+'_inactive');
    if (! consumeChange ) {
        jQuery(layer).trigger('visibilityChange',[this,false]);
    }
    return this;
};

/**
 * Register a layer with this renderer. Actually is a proxy on to the global registry method
 * @see MASCP#registerLayer
 */
MASCP.SequenceRenderer.prototype.registerLayer = function(layer,options) {
    return MASCP.registerLayer(layer,options);
};

/**
 * Hide or show a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @param {Boolean} visibility True for visible, false for hidden
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.setGroupVisibility = function(grp,visibility,consumeChange) {
    var group = MASCP.getGroup(grp);
    if ( ! group ) {
        return;
    }
    var groupName = group.name;
    
    var renderer = this;

    group.eachLayer(function(layer) {
        if (MASCP.getGroup(layer) === layer) {
            // We can skip explicitly setting the visibility of groups here, since
            // any sub-groups should have a controller.
            return;
        }
        if (this.disabled && visibility) {
            renderer.hideLayer(layer.name);
            return;
        }
        if (visibility === true) {
            renderer.showLayer(layer.name);
        } else if (visibility === false) {
            renderer.hideLayer(layer.name);                
        } else {
            renderer.toggleLayer(layer.name);
        }
    });
    if (visibility !== null && ! consumeChange) {
        jQuery(group).trigger('visibilityChange',[renderer,visibility]);
    }
};

/**
 * Hide a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.hideGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,false,consumeChange);
};

/**
 * Show a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.showGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,true,consumeChange);
};

/**
 * Toggle the visibility for a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
MASCP.SequenceRenderer.prototype.toggleGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,consumeChange);
};

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
    return (! layer.disabled) && jQuery(this._container).hasClass(layerName+'_active');
};

/**
 * Deprecated until there's a better implementation for the CondensedSequenceRenderer
 * @private
 */

MASCP.SequenceRenderer.prototype._setHighlight = function(layer,isHighlighted) {
    return;
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
            input_el.indeterminate = (checked !== 0 && checked != group._layers.length);
            if (! input_el.indeterminate ) {
                input_el.checked = (checked !== 0);
            }
        };
        
        jQuery(jQuery('input',layer_controller)[0]).bind('mouseup',function(e) {
            if (this.indeterminate) {
                jQuery(this).trigger('change');
            }
        });

        renderer.createGroupCheckbox(group,jQuery('input',layer_controller)[0]);
        
    };

    
    bean.add(MASCP,"layerRegistered",function(e,layer) {
        if (layer.group && layer.group.hide_member_controllers) {
            return;
        }
        controller_box.add_layer(layer);
    });

    bean.add(MASCP,"groupRegistered",function(e,group) {
        if (group.hide_group_controller) {
            return;
        }
        controller_box.add_group(group);
    });

    
    if (MASCP.layers) {
        for (var layerName in MASCP.layers) {
            if (MASCP.layers.hasOwnProperty(layerName)) {
                var layer = MASCP.layers[layerName];
                if (layer.group && layer.group.hide_member_controllers) {
                    continue;
                }
                controller_box.add_layer(layer);
            }
        }
    }
    return this;
};

/*
 * Create a hydropathy plot for this renderer
 * @returns Element with the hydropathy plot
 * @type Element
MASCP.SequenceRenderer.prototype.getHydropathyPlot = function() {
    var base_url = 'http://www.plantenergy.uwa.edu.au/applications/hydropathy/hydropathy.php?title=Hydropathy&amp;sequence=';
    return jQuery('<img style="width: '+(this.sequence.length * 2)+'px;" src="'+base_url+this.sequence+'"/>')[0];
};
*/

/**
 * Create a checkbox that is used to control the given layer
 * @param {String|Object} layer Layer name or layer object that a controller should be generated for
 * @param {Object} inputElement Optional input element to bind events to. If no element is given, a new one is created.
 * @returns Checkbox element that when checked will toggle on the layer, and toggle it off when unchecked
 * @type Object
 */
MASCP.SequenceRenderer.prototype.createLayerCheckbox = function(layer,inputElement,exclusive) {
    var renderer = this;

    if (! MASCP.layers[layer]) {
        return;
    }


    var layerObj = null;
    
    if (typeof layer == 'string' && MASCP.layers ) {
        layerObj = MASCP.layers[layer];
    } else if (typeof layer == 'object') {
        layerObj = layer;
    }

    if ( ! layerObj ) {
        return;
    }
    
    
    
    var the_input = inputElement || jQuery('<input type="checkbox" value="true"/>')[0];
    
    the_input._current_bindings = the_input._current_bindings || [];
    
    if (exclusive) {
        this._removeOtherBindings(layerObj,the_input);
    }
    
    for (var i = 0; i < the_input._current_bindings.length; i++) {
        if (    the_input._current_bindings[i].layer == layer && 
                the_input._current_bindings[i].renderer == renderer ) {
            return;
        }
    }
    
    the_input.removeAttribute('checked');
    the_input.checked = this.isLayerActive(layer);

    var layer_func = null;

    if (layerObj && the_input._current_bindings.length === 0) {
        layer_func = function(e,rend,visibility) {
            if (rend != renderer) {
                return;
            }
            if (visibility) {
                the_input.checked = visibility;
            } else {
                the_input.checked = false;
                the_input.removeAttribute('checked');
            }
        };
        jQuery(layerObj).bind("visibilityChange",layer_func);
        if (the_input.parentNode) {
            the_input.parentNode.insertBefore(jQuery('<div style="position: relative; left: 0px; top: 0px; float: left; background-color: '+layerObj.color+'; width: 1em; height: 1em;"></div>')[0],the_input);
        }
    }


    var input_func = function(e) {
        if (this.checked) {
            renderer.showLayer(layer,false);
        } else {
//            renderer.hideLayer(layer,false);
        }
        if (MASCP.getLayer(layer).group && MASCP.getLayer(layer).group._check_intermediate) {
            MASCP.getLayer(layer).group._check_intermediate();
        }
    };

    jQuery(the_input).bind( (MASCP.IE ? 'click' : 'change'),input_func);
    
    the_input._current_bindings.push({ 'layer' : layer , 'renderer' : renderer, 'input_function' : input_func, 'object_function' : layer_func });    
    
    return the_input;    
};

/**
 * Retrieve a layer object from the layer registry. If a layer object is passed to this method, the same layer is returned.
 * @param {String} layer    Layer name
 * @returns Layer object
 * @type Object
 * @see MASCP.Layer
 */
MASCP.getLayer = function(layer) {
    if ( ! MASCP.layers ) {
        return;
    }
    return (typeof layer == 'string') ? MASCP.layers[layer] : layer;    
};

/**
 * Retrieve a group object from the group registry. If a grop object is passed to this method, the same group is returned.
 * @param {String} group    Group name
 * @returns Group object
 * @type Object
 * @see MASCP.Group
 */
MASCP.getGroup = function(group) {
    if (typeof group == 'undefined') {
        return;
    }
    if ( ! MASCP.groups ) {
        return;
    }
    if (typeof group == 'string') {
        return MASCP.groups[group];
    }
    return (group == MASCP.groups[group.name]) ? group : null;
};

MASCP.SequenceRenderer.prototype._removeOtherBindings = function(object,inputElement) {
    var renderer = this;
    
    for (var i = 0; i < inputElement._current_bindings.length; i++) {
        if ( inputElement._current_bindings[i].renderer != renderer ) {
            continue;
        }
        var cb = inputElement._current_bindings[i];
        
        if ( cb.layer && cb.layer != object.name ) {
            jQuery(MASCP.getLayer(cb.layer)).unbind('visibilityChange',cb.object_function);
            jQuery(inputElement).unbind('change',cb.input_function);
        }
        
        if ( cb.group && cb.group != object.name ) {
            jQuery(MASCP.getGroup(cb.group)).unbind('visibilityChange',cb.object_function);
            jQuery(inputElement).unbind('change',cb.input_function);
        }
        cb.group = null;
        cb.layer = null;
    }
};

/**
 * Create a checkbox that is used to control the given group
 * @param {String|Object} group Group name or group object that a controller should be generated for
 * @param {Object} inputElement Optional input element to bind events to. If no element is given, a new one is created.
 * @returns Checkbox element that when checked will toggle on the group, and toggle it off when unchecked
 * @type Object
 */
MASCP.SequenceRenderer.prototype.createGroupCheckbox = function(group,inputElement,exclusive) {
    var renderer = this;
    var the_input = inputElement ? jQuery(inputElement) : jQuery('<input type="checkbox" value="true"/>');
    var groupObject = MASCP.getGroup(group);
    
    if (! groupObject ) {
        return;
    }

    the_input[0]._current_bindings = the_input[0]._current_bindings || [];

    if (exclusive) {
        this._removeOtherBindings(groupObject,the_input[0]);
    }
    
    for (var i = 0; i < the_input[0]._current_bindings.length; i++) {
        if (    the_input[0]._current_bindings[i].group == group && 
                the_input[0]._current_bindings[i].renderer == renderer ) {
            return;
        }
    }
    
    the_input[0].removeAttribute('checked');
    var input_func = function(e) {        
        group_obj = MASCP.getGroup(group);
        if (! group_obj ) {
            return;
        }
        if (this.checked) {
            jQuery(group_obj._layers).each(function(i) {
                renderer.showLayer(this.name,false);
            });
        } else {
            jQuery(group_obj._layers).each(function(i) {
//                renderer.hideLayer(this.name,false);
            });                
        }
    };
    
    the_input.bind((MASCP.IE ? 'click' : 'change'),input_func);

    var group_func = null;

    if (groupObject && the_input[0]._current_bindings.length === 0) {
        group_func = function(e,rend,visibility) {
            if (rend != renderer) {
                return;
            }
            the_input[0].checked = visibility;
            if ( ! visibility ) {
                the_input[0].removeAttribute('checked');
            }
        };
        jQuery(MASCP.getGroup(group)).bind('visibilityChange', group_func);
        
        if (the_input[0].parentNode) {
            the_input[0].parentNode.insertBefore(jQuery('<div style="position: relative; left: 0px; top: 0px; float: left; background-color: '+groupObject.color+'; width: 1em; height: 1em;"></div>')[0],the_input[0]);
        }
    }

    the_input[0]._current_bindings.push({ 'group' : group , 'renderer' : renderer, 'input_function' : input_func, 'object_function' : group_func });

    the_input.bind('click',function(e) {
        e.stopPropagation();
    });
    
    return the_input;
};

/**
 * Create a layer based controller for a group. This layer can act as a proxy for the other layers
 * @param {Object} lay Layer to turn into a group controller
 * @param {Object} grp Group to be controlled by this layer.
 */

MASCP.SequenceRenderer.prototype.createGroupController = function(lay,grp) {
    var layer = MASCP.getLayer(lay);
    var group = MASCP.getGroup(grp);

    var self = this;
    jQuery(layer).bind('visibilityChange',function(ev,rend,visible) {
        if (rend == self) {
            self.setGroupVisibility(group, visible);
            self.refresh();
        }
    });
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
    this.addBoxOverlay(layerName,1);
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
MASCP.SequenceRenderer.addElementToLayerWithLink = function(layerName, url, width)
{
    jQuery(this).addClass(layerName);
    var new_el = jQuery(this).append(jQuery('<a href="'+url+'" class="'+layerName+'_overlay" style="display: box; left: 0px; top: 0px; width: 100%; position: absolute; height: 100%;">&nbsp;</a>'))[0];
    while (width && width > 0) {
        this._renderer._sequence_els[this._index + width].addToLayerWithLink(layerName,url);
        width -= 1;
    }
    if (this._z_indexes && this._z_indexes[layerName]) {
        new_el.style.zIndex = this._z_indexes[layerName];
    }
    return this;    
};

/**
 * Function to be added to Amino acid elements to facilitate adding box overlays to elements
 * @private
 * @param {String} layerName The layer that this amino acid should be added to, as well as the fraction opacity to use for this overlay
 * @returns Itself
 * @type Element
 */
MASCP.SequenceRenderer.addBoxOverlayToElement = function(layerName, width, fraction)
{
    if (typeof fraction == 'undefined') {
        fraction = 1;
    }
    jQuery(this).addClass(layerName);
    var new_el = jQuery(this).append(jQuery('<div class="'+layerName+'_overlay" style="top: 0px; width: 100%; position: absolute; height: 100%; opacity:'+fraction+';"></div>'))[0];
    while (width && width > 1) {
        this._renderer._sequence_els[this._index + width - 1].addBoxOverlay(layerName,0,fraction);
        width -= 1;
    }
    if (this._z_indexes && this._z_indexes[layerName]) {
        new_el.style.zIndex = this._z_indexes[layerName];
    }
    var event_names = ['mouseover','mousedown','mousemove','mouseout','click','dblclick','mouseup','mouseenter','mouseleave'];
    for (var i = 0 ; i < event_names.length; i++) {
        jQuery(new_el).bind(event_names[i],function() { return function(e) {
            jQuery(MASCP.getLayer(layerName)).trigger(e.type,[e,'SequenceRenderer']);
        };}(i));
    }    
    return this;
};


/**
 * Reset this renderer. Hide all groups and layers, disabling them in the registry.
 */
MASCP.SequenceRenderer.prototype.reset = function()
{
    jQuery(this._container).attr('class',null);
    for ( var group in MASCP.groups) {
        if (MASCP.groups.hasOwnProperty(group)) {
            this.hideGroup(group);
        }
    }    
    for ( var layer in MASCP.layers) {
        if (MASCP.layers.hasOwnProperty(layer)) {
            this.hideLayer(layer,true);
            MASCP.layers[layer].disabled = true;
        }
    }
    
    if (this.resetAnnotations) {
        this.resetAnnotations();
    }
    
};

/**
 * Execute the given block of code (in the renderer context) moving the refresh method away so that it is not called
 * @param {Function} func Function that contains operations to run without refreshing the renderer
 */
MASCP.SequenceRenderer.prototype.withoutRefresh = function(func)
{
    var curr_refresh = this.refresh;
    this.refresh = function() {};
    this.refresh.suspended = true;
    func.apply(this);
    this.refresh = curr_refresh;
};

/**
 * Refresh the display for this sequence renderer
 */
MASCP.SequenceRenderer.prototype.refresh = function()
{
    var z_index = -2;
    if ( ! this._z_indexes) {
        this._z_indexes = {};
    }
    for (var i = 0; i < (this.trackOrder || []).length; i++ ) {
        if (! this.isLayerActive(this.trackOrder[i])) {
            continue;
        }
        jQuery('.'+this.trackOrder[i]+'_overlay').css('z-index',z_index);
        this._z_indexes[this.trackOrder[i]] = z_index;
        z_index -= 1;
    }
};

/**
 * Bind a function to execute on a particular event for this object
 * @param {String} ev Event name
 * @param {Function} func Function to execute
 */

MASCP.SequenceRenderer.prototype.bind = function(ev,func)
{
    jQuery(this).bind(ev,func);
};

MASCP.SequenceRenderer.prototype.trigger = function(ev,args)
{
    jQuery(this).trigger(ev,args);
};


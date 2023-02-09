/**
 * @fileOverview    Read in sequences to be re-rendered in a block that can be easily annotated.
 */

import MASCP from './MASCP';
import bean from '../bean';


/**
 * @class   Reformatter for sequences in html pages. The object retrieves the amino acid sequence from the 
 *          given element, and then reformats the display of the sequence so that rendering layers can be
 *          applied to it. 
 * @author  hjjoshi
 * @param   {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *                                      the container that data will be re-inserted into.
 */
const SequenceRenderer = (function() {

    /**
     *  @lends SequenceRenderer.prototype
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
                        while (track_order.indexOf(a_track) >= 0) {
                            track_order.splice(track_order.indexOf(a_track),1);
                        }
                        track_order.push(a_track);
                    }
                    if (MASCP.getGroup(a_track)) {
                        let insert_idx= i+1;
                        MASCP.getGroup(order[i]).eachLayer(function(grp_lay) {
                            while (track_order.indexOf(grp_lay.name) >= 0) {
                                track_order.splice(track_order.indexOf(grp_lay.name),1);
                            }
                            order.splice(insert_idx,0,grp_lay.name);
                            insert_idx += 1;
                        });
                    }
                }
                for (i = ((renderer_track_order || []).length - 1); i >= 0; i--) {
                    if (track_order.indexOf(renderer_track_order[i]) < 0) {
                        this.hideLayer(renderer_track_order[i]);
                        this.hideGroup(renderer_track_order[i]);
                        if (MASCP.getLayer(renderer_track_order[i])) {
                            bean.fire(MASCP.getLayer(renderer_track_order[i]),'removed',[renderer]);
                        }
                        if (MASCP.getGroup(renderer_track_order[i])) {
                            bean.fire(MASCP.getGroup(renderer_track_order[i]),'removed',[renderer]);
                        }
                    }
                }
                renderer_track_order = track_order;

                if (this.refresh) {
                    this.refresh(true);
                }
                bean.fire(renderer,'orderChanged', [ track_order ] );

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
        if (! sequenceContainer) {
            return this;
        }
        if (typeof sequenceContainer !== 'undefined') {
            this._container = sequenceContainer;
            if ( ! this._container.style.position) {
                this._container.style.position = 'relative';
            }
    //        this._container.style.width = '100%';

            bean.add(this,'sequenceChange', function(e){
                while (sequenceContainer.firstChild) {
                    sequenceContainer.removeChild(sequenceContainer.firstChild);
                }
                this._sequence_els.forEach(function(el) {
                    sequenceContainer.appendChild(el);
                });
                var float_clear = document.createElement('div');
                float_clear.setAttribute('style','clear: both; float: none; height: 0px; width: 100%;');
                sequenceContainer.appendChild(float_clear);
                sequenceContainer.style.width = (this._sequence_els.length)+'em';
    //            this.showRowNumbers();            
            });

            this.setSequence(sequenceContainer.textContent || '');
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
 * @name    SequenceRenderer#sequenceChange
 * @event
 * @param   {Object}    e
 */

/**
 * Event fired when a result is rendered on this renderer
 * @name    SequenceRenderer#resultsRendered
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
 *  @lends SequenceRenderer.prototype
 *  @property   {String}  sequence  Sequence to mark up.
 */
SequenceRenderer.prototype = {
    sequence: null 
};
 
if ( MASCP.IE ) {
    SequenceRenderer.prototype.prototype = document.createElement('div');
}


/**
 * Set the sequence for this renderer. Fires the sequenceChange event when the sequence is set.
 * @param {String} sequence Sequence to render
 * @see SequenceRenderer#event:sequenceChange
 */
SequenceRenderer.prototype.setSequence = function(sequence)
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
            var span_el = document.createElement('span');
            span_el.textContent = aa;
            sequence_els.push(span_el);
        }
    }

    sequence_els.forEach( function(el,i) {
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
        
        el._index = i;
        
        el.style.display = 'block';
        el.style.cssFloat = 'left';
        el.style.styleFloat = 'left';
        el.style.height = '1.1em';
        el.style.position = 'relative';

        el.addToLayer = SequenceRenderer.addElementToLayer;
        el.addBoxOverlay = SequenceRenderer.addBoxOverlayToElement;
        el.addToLayerWithLink = SequenceRenderer.addElementToLayerWithLink;
        el._renderer = renderer;
    });
    this._sequence_els = sequence_els;   
    bean.fire(this,'sequenceChange');
};

/**
 * Color some residues on this residue
 * @param {Array} indexes Indexes to apply the given color to
 * @param {String} color Color to use to highlight the residues
 * @returns ID for the layer that is created
 * @type String
 */
SequenceRenderer.prototype.colorResidues = function(indexes, color) {
    var layer_id = Math.floor(Math.random()*1000).toString();
    MASCP.registerLayer(layer_id, { 'color' : (color || '#ff0000') });
    var aas = this.getAminoAcidsByPosition(indexes);
    for (var i = 0; i < aas.length; i++ ) {
        aas[i].addToLayer(layer_id);
    }
    return MASCP.getLayer(layer_id);
};


SequenceRenderer.prototype._cleanSequence = function(sequence) {
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
SequenceRenderer.prototype.getAminoAcidsByPosition = function(indexes) {
    var sequence_els = this._sequence_els;
    return indexes.map(function(index) {
        if (index < 0) {
            return null;
        }
        return sequence_els[index-1];
    });
};

SequenceRenderer.prototype.getAA = function(index) {
    return this.getAminoAcidsByPosition([index]).shift();
};


/**
 * Retrieve the HTML Elements that contain the amino acids contained in the given peptide sequence.
 * @param {String} peptideSequence Peptide sequence used to look up the amino acids
 * @returns Elements representing each amino acid at the given positions
 * @type Array
 */
SequenceRenderer.prototype.getAminoAcidsByPeptide = function(peptideSequence) {
    var start = this.sequence.indexOf(peptideSequence);
    var results = [];

    if (start < 0) {
        results.addToLayer = function() {};
        return results;
    }
    results = results.concat(this._sequence_els.slice(start,start+(peptideSequence.length)));
    if (results.length) {
        results.addToLayer = function(layername, fraction, options) {
            return results[0].addBoxOverlay(layername,results.length,fraction,options);
        };
    } else {
        results.addToLayer = function() {};
    }
        
    return results;
};

/**
 * Toggle the display of the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
SequenceRenderer.prototype.toggleLayer = function(layer,consumeChange) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    } else {
        layer = MASCP.layers[layer];
    }
    this._container.classList.toggle(layerName+'_active');
    this._container.classList.toggle(layerName+'_inactive');
    if ( ! consumeChange ) {
        bean.fire(layer,'visibilityChange',[this,this.isLayerActive(layer)]);
    }
    return this;
};

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
SequenceRenderer.prototype.showLayer = function(lay,consumeChange) {
    var layer = MASCP.getLayer(lay);

    if (! layer || layer.disabled) {
        return;
    }
    this._container.classList.add(layer.name+'_active');
    this._container.classList.add('active_layer');    
    this._container.classList.remove(layer.name+'_inactive');
    if ( ! consumeChange ) {
        bean.fire(layer,'visibilityChange',[this,true]);
    }
    return this;
};

/**
 * Hide the given layer
 * @param {String|Object} layer Layer name, or layer object
 * @see MASCP.Layer#event:visibilityChange
 */
SequenceRenderer.prototype.hideLayer = function(lay,consumeChange) {
    var layer = MASCP.getLayer(lay);

    if (! layer || layer.disabled) {
        return;
    }
        
    this._container.classList.remove(layer.name+'_active');
    this._container.classList.remove('active_layer');
    this._container.classList.add(layer.name+'_inactive');
    if (! consumeChange ) {
        bean.fire(layer,'visibilityChange',[this,false]);
    }
    return this;
};

/**
 * Register a layer with this renderer. Actually is a proxy on to the global registry method
 * @see MASCP#registerLayer
 */
SequenceRenderer.prototype.registerLayer = function(layer,options) {
    return MASCP.registerLayer(layer,options);
};

/**
 * Hide or show a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @param {Boolean} visibility True for visible, false for hidden
 * @see MASCP.Group#event:visibilityChange
 */
SequenceRenderer.prototype.setGroupVisibility = function(grp,visibility,consumeChange) {
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
        bean.fire(group,'visibilityChange',[renderer,visibility]);
    }
};

/**
 * Hide a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
SequenceRenderer.prototype.hideGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,false,consumeChange);
};

/**
 * Show a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
SequenceRenderer.prototype.showGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,true,consumeChange);
};

/**
 * Toggle the visibility for a group. Fires an event when this method is called.
 * @param {Object} grp Group to set the visibility for
 * @see MASCP.Group#event:visibilityChange
 */
SequenceRenderer.prototype.toggleGroup = function(group,consumeChange) {
    this.setGroupVisibility(group,consumeChange);
};

/**
 * Check if the given layer is active
 * @param {String|Object} layer Layer name, or layer object
 * @returns Whether this layer is active on this renderer
 * @type Boolean
 */
SequenceRenderer.prototype.isLayerActive = function(layer) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    }
    return (! layer.disabled) && this._container.classList.contains(layerName+'_active');
};


SequenceRenderer.prototype.getLayer = function(layer) {
    var layerName = layer;
    if (typeof layer != 'string') {
        layerName = layer.name;
    }
    return MASCP.getLayer(layer);
};


/**
 * Deprecated until there's a better implementation for the CondensedSequenceRenderer
 * @private
 */

SequenceRenderer.prototype._setHighlight = function(layer,isHighlighted) {
    return;
};

/**
 * Create a layer controller for this sequence renderer. Attach the controller to the containing box, and shift the box across 20px.
 */
SequenceRenderer.prototype.createLayerController = function() {
    console.log("createLayerController is deprected");
    return;
};

/**
 * Create a checkbox that is used to control the given layer
 * @param {String|Object} layer Layer name or layer object that a controller should be generated for
 * @param {Object} inputElement Optional input element to bind events to. If no element is given, a new one is created.
 * @returns Checkbox element that when checked will toggle on the layer, and toggle it off when unchecked
 * @type Object
 */
SequenceRenderer.prototype.createLayerCheckbox = function(layer,inputElement,exclusive) {
    console.log("createLayerCheckbox is deprecated");
    return;
};


SequenceRenderer.prototype._removeOtherBindings = function(object,inputElement) {
    var renderer = this;
    
    for (var i = 0; i < inputElement._current_bindings.length; i++) {
        if ( inputElement._current_bindings[i].renderer != renderer ) {
            continue;
        }
        var cb = inputElement._current_bindings[i];
        
        if ( cb.layer && cb.layer != object.name ) {
            bean.remove(MASCP.getLayer(cb.layer),'visibilityChange',cb.object_function);
            bean.remove(inputElement,'change',cb.input_function);
        }
        
        if ( cb.group && cb.group != object.name ) {
            bean.remove(MASCP.getGroup(cb.group),'visibilityChange',cb.object_function);
            bean.remove(inputElement,'change',cb.input_function);
        }
        cb.group = null;
        cb.layer = null;
    }
};

/**
 * Create a layer based controller for a group. This layer can act as a proxy for the other layers
 * @param {Object} lay Layer to turn into a group controller
 * @param {Object} grp Group to be controlled by this layer.
 */

SequenceRenderer.prototype.createGroupController = function(lay,grp) {
    var layer = MASCP.getLayer(lay);
    var group = MASCP.getGroup(grp);

    var self = this;
    bean.add(layer,'visibilityChange',function(rend,visible) {
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
SequenceRenderer.addElementToLayer = function(layerName)
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
SequenceRenderer.addElementToLayerWithLink = function(layerName, url, width)
{
    this.classList.add(layerName);
    var anchor = document.createElement('a');
    anchor.setAttribute('href',url);
    anchor.classList.add(layerName+'_overlay');
    anchor.setAttribute('style','display: box; left: 0px; top: 0px; width: 100%; position: absolute; height: 100%;');
    anchor.textContent = '&nbsp;';
    this.appendChild(anchor);
    while (width && width > 0) {
        this._renderer._sequence_els[this._index + width].addToLayerWithLink(layerName,url);
        width -= 1;
    }
    if (this._z_indexes && this._z_indexes[layerName]) {
        anchor.style.zIndex = this._z_indexes[layerName];
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
SequenceRenderer.addBoxOverlayToElement = function(layerName, width, fraction)
{
    if (typeof fraction == 'undefined') {
        fraction = 1;
    }

    this.classList.add(layerName);
    var new_el = document.createElement('div');
    new_el.classList.add(layerName+'_overlay');
    new_el.setAttribute('style','top: 0px; width: 100%; position: absolute; height: 100%; opacity:'+fraction+';');
    this.appendChild(new_el);
    while (width && width > 1) {
        this._renderer._sequence_els[this._index + width - 1].addBoxOverlay(layerName,0,fraction);
        width -= 1;
    }
    if (this._z_indexes && this._z_indexes[layerName]) {
        new_el.style.zIndex = this._z_indexes[layerName];
    }
    var event_names = ['mouseover','mousedown','mousemove','mouseout','click','dblclick','mouseup','mouseenter','mouseleave'];
    for (var i = 0 ; i < event_names.length; i++) {
        bean.add(new_el,event_names[i],function() { return function(e) {
            bean.fire(MASCP.getLayer(layerName),e.type,[e,'SequenceRenderer']);
        };}(i));
    }    
    return this;
};


/**
 * Reset this renderer. Hide all groups and layers, disabling them in the registry.
 */
SequenceRenderer.prototype.reset = function()
{
    while(this._container.classList.length > 0) {
        this._container.classList.remove(this._container.classList.item(0));
    }
    for ( var group in MASCP.groups) {
        if (MASCP.groups.hasOwnProperty(group)) {
            this.hideGroup(group);
        }
    }    
    for ( var layer in MASCP.layers) {
        if (MASCP.layers.hasOwnProperty(layer)) {
            if ( ! this.keeptracks ) {
                this.hideLayer(layer,true);
                MASCP.layers[layer].disabled = true;
            }
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
SequenceRenderer.prototype.withoutRefresh = function(func)
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
SequenceRenderer.prototype.refresh = function()
{
    var z_index = -2;
    if ( ! this._z_indexes) {
        this._z_indexes = {};
    }
    for (var i = 0; i < (this.trackOrder || []).length; i++ ) {
        if (! this.isLayerActive(this.trackOrder[i])) {
            continue;
        }
        Array.prototype.slice.call(document.querySelectorAll('.'+this.trackOrder[i]+'_overlay')).forEach(function(el) {
            el.style.zIndex = z_index;
        });
        this._z_indexes[this.trackOrder[i]] = z_index;
        z_index -= 1;
    }
};

/**
 * Bind a function to execute on a particular event for this object
 * @param {String} ev Event name
 * @param {Function} func Function to execute
 */

SequenceRenderer.prototype.bind = function(ev,func)
{
    bean.add(this,ev,func);
};

SequenceRenderer.prototype.unbind = function(ev,func)
{
    bean.remove(this,ev,func);
};


SequenceRenderer.prototype.trigger = function(ev,args)
{
    bean.fire(this,ev,args);
};

export default SequenceRenderer;

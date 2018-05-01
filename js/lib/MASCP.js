import bean from '../bean';

/**
 *  @namespace MASCP namespace
 */
const MASCP = {};

/**
 *  @fileOverview   Basic classes and defitions for the MASCP services
 */

if (Object.defineProperty && ! MASCP.IE8 ) {
    (function() {
        var ready_callbacks = [];
        var is_ready = false;
        Object.defineProperty(MASCP,"ready", {
            get : function() {
                if ((ready_callbacks.length === 0) && (! is_ready )) {
                    return false;
                }
                return function() {
                    ready_callbacks.forEach(function(cb) {
                        cb.call();
                    });
                };
            },
            set : function(cb) {
                if (cb === false || cb === true) {
                    ready_callbacks = [];
                    if (cb) {
                        is_ready = true;
                    }
                    return is_ready;
                } else {
                    if (is_ready) {
                        cb.call();
                        return;
                    }
                    ready_callbacks.push(cb);
                }
            }
        });
    })();
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
MASCP.registerLayer = function(layerName, options, renderers)
{
    if ( ! this.layers ) {
        this.layers = {};
    }
    if ( ! renderers ) {
        renderers = [];
    }
    var layer;
    if (this.layers[layerName]) {
        if (this.layers[layerName].disabled || renderers.length > 0) {
            this.layers[layerName].disabled = false;
            bean.fire(MASCP,'layerRegistered',[this.layers[layerName]].concat(renderers));
        }
        layer = this.layers[layerName];
    }

    if (layer && options.group) {
        if (layer.group !== this.getGroup(options.group)) {
            layer.group = this.getGroup(options.group);
            layer.group._layers.push(layer);
        }
        if ( ! layer.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
    }
    
    if (layer) {
        return layer;
    }

    layer = new MASCP.Layer();
    
    layer.name = layerName;
    
    options = options || {};
    
    if (options.fullname) {
        layer.fullname = options.fullname;
    }
    
    if (options.color) {
        layer.color = options.color;
    }

    if (options.data) {
        layer.data = options.data;
    }
    
    if (layer && options.group) {
        layer.group = this.getGroup(options.group);
        if ( ! layer.group ) {
            throw "Cannot register this layer with the given group - the group has not been registered yet";
        }
        layer.group._layers.push(layer);
    }
    
    this.layers[layerName] = layer;
    
    if (options.css) {
        console.log("options.css is deprecated");
    }
    layer.layer_id = new Date().getMilliseconds();
    bean.fire(MASCP,'layerRegistered',[layer].concat(renderers));
    
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

export default MASCP;

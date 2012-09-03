/**
 *  @fileOverview   Basic classes and defitions for a Gene Ontology ID based map
 */


if ( typeof GOMap == 'undefined' ) {
 /**
  *  @namespace GOMap namespace
  */
  GOMap = {};
}

 /* 
  * Convenience environment detection – see if the browser is Internet Explorer and set variables to mark browser
  * version.
  */
 (function() {
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
          GOMap.IE = true;
          GOMap.IE7 = true;
      }
      if (ie === 8) {
          GOMap.IE = true;
          GOMap.IE8 = true;
      }
  }
 })();


/*
 *  Include the svgweb library when we include this script. Set the SVGWEB_PATH environment variable if
 *  you wish to retrieve svgweb from a relative path other than ./svgweb/src
 */
if (GOMap.IE && (typeof svgweb === 'undefined') && (typeof SVGWEB_LOADING === 'undefined') && ! window.svgns ) {

    var svg_path = 'svgweb/';
    if (typeof SVGWEB_PATH != 'undefined') {
        svg_path = SVGWEB_PATH;
    }
    var scriptTag = document.createElement("script");
    scriptTag.src = svg_path + 'svg.js';
    scriptTag.type="text/javascript";
    scriptTag.setAttribute('data-path',svg_path);
    document.getElementsByTagName("head")[0].insertBefore(scriptTag, document.getElementsByTagName("head")[0].firstChild);

    SVGWEB_LOADING = true;
}

/** Convenience logging function. If there is no log function defined, add a log method that simply
 *  forwards the message on to the console.log.
 *  @function
 *  @param  {Object}    message Message to log
 */
log = (typeof log == 'undefined') ? (typeof console == 'undefined') ? function() {} : function(msg) {    
    if (typeof msg == 'String' && arguments.length == 1) {
        console.log("%s", msg);
    } else {
        console.log("%o: %o", msg, this);
    }
    return this;
} : log ;


// shim layer with setTimeout fallback
window.requestAnimFrame = (function(){
return  window.requestAnimationFrame       || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame    || 
        window.oRequestAnimationFrame      || 
        window.msRequestAnimationFrame     || 
        function(/* function */ callback, /* DOMElement */ element){
          window.setTimeout(callback, 1000 / 60);
        };
})();


if (window.attachEvent) { //&& svgweb.getHandlerType() == 'flash') {
    window.onload = function() {
        GOMap.LOADED = true;
    };
} else {
    GOMap.LOADED = true;
}


/**
 * @class       A diagram that can be marked up with keywords.
 * @param       image   Image to be used for the diagram. Either an url to an svg file, an existing object element with a src attribute, or a reference to an SVG element if the SVG has been inlined.
 * @param       params  Params to be passed into initialisation. Possible values include 'load', which is a function to be executed when the diagram is loaded.
 * @author      hjjoshi
 * @requires    svgweb
 */
GOMap.Diagram = function(image,params) {
    if (image === null) {
        return;
    }
    this._highlighted = {};
    this._styles_cache = {};
    this.enabled = true;

    var self = this;
    
    var url = null;
    if (typeof image == 'string') {
        url = image;
        image = null;
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'object') {
        url = image.getAttribute('src') || image.getAttribute('data');
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'svg') {        
        (function() {
            if ( ! GOMap.LOADED ) {
                window.attachEvent('onload',arguments.callee);
                return;
            }
            self._container = image.parentNode;
            self.element = image;
            self._svgLoaded();
            self.loaded = true;
            if (params.load) {
                params.load.apply(self);
            }
            if ( self.onload ) {
                self.onload.apply(self);
            }
        })();
        return;
    }

    this.element = document.createElement('object',true);
    
    this.element.setAttribute('data',url);
    this.element.setAttribute('type','image/svg+xml');
    this.element.setAttribute('width','100%');
    this.element.setAttribute('height','100%');
    this.element.setAttribute('style','background: transparent;');
    
    if ( ! this.element.addEventListener ) {
        this.element.addEventListener = function(ev,func) {
            this.attachEvent(ev,func);
        };
    }

    var has_svgweb = typeof svgweb != 'undefined';

    this.element.addEventListener(has_svgweb ? 'SVGLoad' : 'load',function() {
        var object_el = this;
        if (! this.nodeName) {
            console.log("The SVG hasn't been loaded properly");
            return;
        }
        if (object_el.contentDocument !== null) {
            self.element = object_el.contentDocument.rootElement;
        } else {
            self.element = object_el.getAttribute('contentDocument').rootElement;
        }
        
        // Make the destroy function an anonymous function, so it can access this new
        // element without having to store it in a field
        
        var svg_object = object_el;
        self.destroy = function() {
            if ( svg_object && svg_object.parentNode) {
                if (typeof svgweb != 'undefined') {
                    svgweb.removeChild(svg_object, svg_object.parentNode);
                } else {
                    svg_object.parentNode.removeChild(svg_object);
                }
            }
        };

        self._svgLoaded();

        self.loaded = true;
        if (params.load) {
            params.load.apply(self);
        }
        if ( self.onload ) {
            self.onload.apply(self);
        }

    },false);

    if (image) {
        this.appendTo(image.parentNode);
        image.parentNode.removeChild(image);
    }
};

/**
 * Retrieve the SVG element for this diagram
 * @returns SVG element used to render the diagram
 * @type Element
 */

/**
 * Append this diagram to the given parent node
 * @param {Element} parent Parent node to append this element to
 */
GOMap.Diagram.prototype.appendTo = function(parent) {
    this._container = parent;
    if (typeof svgweb != 'undefined') {
        svgweb.appendChild(this.element,parent);
    } else {
        parent.appendChild(this.element);
    }
    return this;
};


/**
 * Highlight a given keyword on the diagram
 * @param {String} keyword  GO keyword to highlight
 * @param {String} color    CSS color string to use as the highlighting colour. Defaults to #ff0000.
 * @returns True if keyword is found, False if keyword is not in map
 * @type Boolean
 */
GOMap.Diagram.prototype.showKeyword = function(keyword,color) {
    var els = this._elementsForKeyword(keyword);
    
    if (els.length === 0) {
        return false;
    }
    
    if (this._highlighted[keyword] && ! color) {
        return true;
    }
    
    color = color || '#ff0000';
    
    this._highlighted[keyword] = true;

    for (var i = 0; i < els.length; i++ ) {
        els[i]._highlighted = els[i]._highlighted || {};
        els[i]._highlighted[color] = true;
        if (els[i].nodeName == 'path' || els[i].nodeName == 'circle' || els[i].nodeName == 'ellipse') {
            this._outlineElement(els[i]);
        }
    }
    var self = this;
    this._recurse(els, function(el) {
        self._highlightElement(el);
        return true;
    });
    
    return true;
};

/**
 * Set the viewport for the image to be centered around a single keyword. This method picks the first
 * group element matching the keyword, and modifies the viewBox attribute to center around that group
 * only. Using currentTranslate/currentScale yields unpredictable results, so viewBox manipulation has
 * to be performed.
 * @param {String} keyword Keyword to zoom in to
 */
GOMap.Diagram.prototype.zoomToKeyword = function(keyword) {
    var self = this;
    var root = this.element;
    
    var els = this._elementsForKeyword(keyword);
    var targetEl = null;
    for (var i = 0; i < els.length; i++ ) {
        if (els[i].nodeName == 'g') {
            targetEl = els[i];
            break;
        }
    }
    if ( ! targetEl ) {
        if (root._baseViewBox) {
            root.setAttribute('viewBox',root._baseViewBox);
        }
        return;
    }
    
    if (! targetEl.getBBox) {
        return;
    }
    
    var bbox = targetEl.getBBox();    
    var root_bbox = root.getBBox();
    
    if ( ! root._baseViewBox) {
        root._baseViewBox = root.getAttribute('viewBox');
    }
    var location = [bbox.x-10,bbox.y-10,bbox.width+20,bbox.height+20];
    root.setAttribute('viewBox',location.join(' '));
};

/**
 * Hide all the keywords currently being highlighted on this diagram
 */
GOMap.Diagram.prototype.hideAllKeywords = function() {    
    for (var key in this._highlighted) {
        if (this._highlighted.hasOwnProperty(key)) {
            this.hideKeyword(key);
        }
    }
};

/**
 * Hide a given keyword on the diagram
 * @param {String} keyword  GO keyword to turn highlighting off for
 */
GOMap.Diagram.prototype.hideKeyword = function(keyword,color) {
    var els = this._elementsForKeyword(keyword);
    var self = this;

    this._highlighted[keyword] = false;
    
    this._recurse(els, function(el) {
        if (color !== null && el._highlighted) {
            el._highlighted[color] = false;
        } else {
            el._highlighted = {};
        }

        for (var col in el._highlighted) {
            if (el._highlighted[col] === true) {
                if (el.nodeName == 'path' || el.nodeName == 'circle' || el.nodeName == 'ellipse') {
                    self._outlineElement(el);
                }
                return false;
            }
        }
        self._restoreStyle(el);
        return true;
    });
};


/**
 * Toggle the highlight for a given keyword on the diagram
 * @param {String} keyword  GO keyword to highlight
 * @param {String} color    CSS color string to use as the highlighting colour. Defaults to #ff0000.
 */
GOMap.Diagram.prototype.toggleKeyword = function(keyword,color) {
    if (this._highlighted[keyword]) {
        this.hideKeyword(keyword);
        return false;
    } else {
        return this.showKeyword(keyword,color);
    }
};

GOMap.Diagram.prototype.clearMarkers = function(keyword) {
    if ( ! this.markers ) {
        return;
    }
    if (keyword) {
        this._clearMarkers(this.markers[keyword]);
        return;
    }
    for (var key in this.markers) {
        if (this.markers.hasOwnProperty(key)) {
            this._clearMarkers(this.markers[key]);
        }
    }
    this.markers = {};
};

GOMap.Diagram.prototype._clearMarkers = function(elements) {
    if ( ! elements ) {
        return;
    }
    for (var i = 0 ; i < elements.length ; i++ ) {
        elements[i].parentNode.removeChild(elements[i]);
    }
};

GOMap.Diagram.prototype.addMarker = function(keyword,value) {
    if ( ! this.markers ) {
        this.markers = {};
    }
    
    if ( ! value ) {
        value = 1;
    }
    
    var root_svg = this.element,i;
    
    if ( this.markers[keyword]) {
        this.markers[keyword].current_radius += value;
        for (i = 0; i < this.markers[keyword].length ; i++ ) {
            this.markers[keyword][i].setAttribute('r',this.markers[keyword].current_radius);
        }
        return;
    }

    var els = this._elementsForKeyword(keyword);

    this.markers[keyword] = [];
    
    this.markers[keyword].current_radius = value;
    for ( i = 0 ; i < els.length; i++ ) {
        var node = els[i];
        if ( node.nodeName != 'g' ) {
            continue;
        }
        var bbox = node.getBBox();
        var mid_x = bbox.x + (bbox.width / 2);
        var mid_y = bbox.y + (bbox.height / 2);
        circle = document.createElementNS(svgns,'circle');
        circle.setAttribute('cx',mid_x);
        circle.setAttribute('cy',mid_y);
        circle.setAttribute('r',this.markers[keyword].current_radius);
        circle.setAttribute('fill','#ff0000');
        this.markers[keyword].push(circle);
        root_svg.appendChild(circle);
    }
};


/**
 *  Register a function callback for an event with this object. Actually binds the event to the container
 *  element associated with this Diagram using addEventListener
 *  @param  {Object}    evt     Event name to bind to
 *  @param  {Function}  func    Function to call when event occurs
 */
GOMap.Diagram.prototype.addEventListener = function(evt,func) {
    if ( ! this._events ) {
        this._events = {};
    }
    if ( ! this._events[evt] ) {
        this._events[evt] = [];
    }
    
    this._events[evt].push(func);
};

/**
 * Event fired when the zoom property is changed
 * @name    GOMap.Diagram#zoomChange
 * @param   {Object}    e
 * @event
 * @see     #zoom
 */

/**
 *  @lends GOMap.Diagram.prototype
 *  @property   {Number}    zoom        The zoom level for a diagram. Minimum zoom level is zero, and defaults to 1
 *  @see GOMap.Diagram#event:zoomChange
 */
(function() {

var zoomChange = function() {
    if ( ! this._events || ! this._events.zoomChange ) {
        return;
    }
    for ( var i = 0; i < this._events.zoomChange.length; i++ ) {
        this._events.zoomChange[i].apply(this,[{'type' : 'zoomChange'}]);
    }        
};

var accessors = {
        
    setZoom: function(zoomLevel) {
        if (zoomLevel < 0) {
            zoomLevel = 0;
        }
        // if (zoomLevel > 2) {
        //     zoomLevel = 2;
        // }
        
        if (this.element) {
            this.element.currentScale = zoomLevel;
        }
        
        zoomChange.apply(this);

    },

    getZoom: function() {
        return this.element.currentScale;
    }
};



if (Object.defineProperty && ! MASCP.IE8) {
    Object.defineProperty(GOMap.Diagram.prototype,"zoom", {
        get : accessors.getZoom,
        set : accessors.setZoom
    });
}

})();

/**
 * Allow for zooming and panning on the diagram
 */
GOMap.Diagram.prototype.makeInteractive = function() {
    
    var root = this.element;
    var container = this._container;
    
    var diagram = this;
    
    try {
        var foo = root.addEventListener;
    } catch(err) {
        console.log("Browser does not support addEventListener");
        return;
    }
    (new GOMap.Diagram.Dragger()).applyToElement(root);
    var controls = GOMap.Diagram.addZoomControls(this,0.1,2,0.1,1);
    container.appendChild(controls);
    controls.style.position = 'absolute';
    controls.style.top = '0px';
    controls.style.left = '0px';
    controls.style.height = '30%';
};

/*
 * Set the opacity of all the elements for the diagram to translucent
 */
GOMap.Diagram.prototype._svgLoaded = function() {
    this._forceOpacity();
};

/*
 * Retrieve all the SVG elements that match the given keyword. The SVG document
 * should have elements marked up with a keyword attribute.
 * @param {String}  keyword     Keyword to use to search for elements
 */
GOMap.Diagram.prototype._elementsForKeyword = function(keyword) {
    var root_svg = this.element;
    var els = [];

    if (! GOMap.IE ) {
        els = this._execute_xpath(root_svg,"//*[@keyword = '"+keyword+"']",root_svg.ownerDocument);
    } else {
        var some_els = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'*');
        for (var i = 0; i < some_els.length; i++) {
            var el_key = some_els[i].getAttribute('keyword');
            if (el_key == keyword) {                
                els.push(some_els[i]);
            }
        }
    }
    return els;
};

/* 
 * Execute an xpath query upon a document, pulling the results into an array of elements
 * @param {Element} element Start element
 * @param {String} xpath Xpath query to execute
 * @param {Document} document Parent document
 */
GOMap.Diagram.prototype._execute_xpath = function(element, xpath, doc) {
    var results = [],i=0;
    if (doc.evaluate) {
        xpath_result = doc.evaluate(xpath,element,null,XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,null);
        while ( (a_result = xpath_result.snapshotItem(i)) !== null ) {
            results.push(a_result);
            i++;
        }
    } else {
        xpath_result = element.selectNodes(xpath);
        for (i = 0; i < xpath_result.length; i++ ){
            results[i] = xpath_result.item(i);
        }
    }
    return results;
};
/*
 * Perform a breadth-first traversal of the nodelist.
 * @param {Array} nodelist Starting list of nodes to perform traversal over
 * @param {Function} function Callback for this traversal. Callback function takes a single argument, which is the currently inspected node.
 */
GOMap.Diagram.prototype._recurse = function(nodelist,callback) {
    for (var i = 0; i < nodelist.length; i++) {
        var return_val = callback.call(this,nodelist[i]);
        if ( ! return_val ) {
            continue;
        }
        if (nodelist[i].childNodes.length > 0) {
            this._recurse(nodelist[i].childNodes,callback);
        }
    }
};
/*
 * Cache the old style for this element. We need to cache the style for the element so that we can restore the
 * element style when it is active.
 * @param {Element} el Element to store the style for
 */
GOMap.Diagram.prototype._cacheStyle = function(el) {    
    if ( ! el.id ) {
        var an_id = 'svg'+(new Date()).getTime().toString()+Math.floor(Math.random()*1000);
        el.setAttribute('id',an_id);
    }

    if (this._styles_cache[el.id] !== null || ! el.style || ! el.id ) {
        return;
    }
    
    if (el.style.stroke && ! el.style.strokeWidth && ! el.style.getPropertyValue('stroke-width')) {
        el.style.strokeWidth = '1';
    }
    
    this._styles_cache[el.id] = {
        'stroke'         : el.style.stroke || el.style.getPropertyValue('stroke'),
        'stroke-width'   : el.style.strokeWidth || el.style.getPropertyValue('stroke-width') || '0px',
        'opacity'        : el.style.getPropertyValue('opacity'),
        'fill-opacity'   : el.style.fillOpacity || el.style.getPropertyValue('fill-opacity'),
        'stroke-opacity' : el.style.strokeOpacity || el.style.getPropertyValue('stroke-opacity')
    };
};

/*
 * Restore the style for an element from the cache
 * @param {Element} element Element to restore the style for. This element must have cache data.
 */

GOMap.Diagram.prototype._restoreStyle = function(element) {
    if ( ! element.style ) {
        return;
    }
    if (this._styles_cache[element.id]) {
        var cacher = this._styles_cache[element.id];
        for (var prop in {'stroke-width':null,'opacity':null,'stroke':null,'fill-opacity':null,'stroke-opacity':null}) {
            // We don't set null properties in IE because they cause the wrong styles to be displayed
            if ( (! GOMap.IE) || cacher[prop] ) {
                element.style.setProperty(prop,cacher[prop],null);
            }
        }
    }
};

/*
 * Draw an outline around the given element
 * @param {Element} element Element to outline
 */
GOMap.Diagram.prototype._outlineElement = function(element) {
    if ( ! element.style ) {
        return;
    }
    this._cacheStyle(element);
    
    var target_color = this._calculateColorForElement(element);
    
    element.style.setProperty('stroke',target_color,null);
    element.style.setProperty('stroke-width',1,null);
    element.style.setProperty('stroke-opacity',1,null);
};

/*
 * Calculate the color fill. Since there may be more than one color highlighted
 * on this element, we build the pattern if needed, and return a reference to 
 * that pattern if a pattern is to be used.
 */

GOMap.Diagram.prototype._calculateColorForElement = function(element) {
    var pattern = "pat";
    var total_keywords = 0,i;
    
    if (element._animates) {
        for (i = 0; i < element._animates.length; i++ ) {
            element.removeChild(element._animates[i]);
        }
        element._animates = null;
    }
    
    for (var col in element._highlighted) {
        if (element._highlighted && element._highlighted[col] === true) {
            pattern += "_"+col;
            total_keywords++;
        }
    }
    
    // Internet Explorer is waiting on support for this http://code.google.com/p/svgweb/issues/detail?id=145
    // Firefox needs at least v 3.7 to support this
    
    var animation_supported = document.createElementNS(svgns,'animate').beginElement;
    
    if (total_keywords == 1) {
        return pattern.split(/_/)[1];
    } else {        
        if (animation_supported) {        
            var animates = this._buildAnimatedColor(pattern,element.id);
            for (i = 0 ; i < animates.length; i++ ) {            
                element.appendChild(animates[i]);
            }
            animates[0].beginElement();
            element._animates = animates;
            return pattern.split(/_/)[1];
        } else {
            return this._buildPattern(pattern);
        }
    }
    
};
/*
 * Create a pattern element under the defs element for the svg. If there isn't a defs element
 * there already, create one and append it to the document.
 * @param {String} pattern_name Underscore separated pattern name - each component of the pattern should be represented. e.g. ff0000_00ff00_0000ff
 * @returns The color name that can be used to reference this pattern
 * @type String
 */
GOMap.Diagram.prototype._buildPattern = function(pattern_name) {
    var pattern_els = pattern_name.split('_');
    pattern_els.shift();
    this._cached_patterns = this._cached_patterns || {};
    var cleaned_name = pattern_name.replace(/#/g,'');
    if (this._cached_patterns[cleaned_name]) {
        return 'url(#'+cleaned_name+')';
    }
    
    var root_svg = this.element;
    var defs_el = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'defs')[0];

    if ( ! defs_el ) {
        defs_el = document.createElementNS(svgns,'defs');
        root_svg.appendChild(defs_el);
    }

    var new_pattern = document.createElementNS(svgns,'pattern');
    new_pattern.setAttribute('x','0');
    new_pattern.setAttribute('y','0');
    new_pattern.setAttribute('width','30');
    new_pattern.setAttribute('height','30');
    new_pattern.setAttribute('viewBox', '0 0 100 100');
    new_pattern.setAttribute('patternUnits','userSpaceOnUse');
    new_pattern.setAttribute('patternTransform','rotate(45)');
    new_pattern.setAttribute('id',cleaned_name);
    
    var pattern_width = 100.0 / (pattern_els.length);
    var start_pos = 0;
    
    for (var i = 0; i < pattern_els.length; i++ ) {
        var a_box = document.createElementNS(svgns, 'rect');
        a_box.setAttribute('x', start_pos);
        start_pos += pattern_width;
        a_box.setAttribute('y', 0);
        a_box.setAttribute('width', pattern_width);
        a_box.setAttribute('height', 100);
        a_box.setAttribute('fill', pattern_els[i]);
        new_pattern.appendChild(a_box);
    }

    defs_el.appendChild(new_pattern);
    this._cached_patterns[cleaned_name] = true;
    return 'url(#'+cleaned_name+')';
};

GOMap.Diagram.prototype._buildAnimatedColor = function(pattern_name,id_prefix) {
    var pattern_els = pattern_name.split('_');
    pattern_els.shift();
    this._cached_patterns = this._cached_patterns || {};
    var cleaned_name = pattern_name.replace(/#/g,'');
    if (this._cached_patterns[cleaned_name]) {
        return 'url(#'+cleaned_name+')';
    }
    
    cleaned_name = id_prefix+cleaned_name;
    
    var root_svg = this.element;
    var defs_el = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'defs')[0];

    if ( ! defs_el ) {
        defs_el = document.createElementNS(svgns,'defs');
        root_svg.appendChild(defs_el);
    }
    
    var animates = [];

    for ( var i = 0; i < pattern_els.length; i++ ) {
        var an_anim = document.createElementNS(svgns,'animate');
        an_anim.setAttribute('id',cleaned_name+i);
        an_anim.setAttribute('from',pattern_els[i]);
        var to_string = '';
        if ( pattern_els.length <= (i+1) ) {
            to_string = pattern_els[0];
        } else {
            to_string = pattern_els[i+1];
        }
        an_anim.setAttribute('to',to_string);
        var begin_string = '';
        if ( i === 0 ) {
            begin_string = 'SVGLoad;indefinite;'+(cleaned_name+(pattern_els.length-1))+'.end';
        } else {
            begin_string = cleaned_name+(i-1)+'.end';
        }
        an_anim.setAttribute('attributeType','CSS');
        an_anim.setAttribute('attributeName','stroke');
        an_anim.setAttribute('begin',begin_string);
        an_anim.setAttribute('dur','1s');
        animates.push(an_anim);
    }

    return animates;
};

/* Highlight an element by making it opaque
 * @param {Element} element Element to make opaque
 */
GOMap.Diagram.prototype._highlightElement = function(element) {
    // Skip this if we don't have a style or has no id and isn't a group
    if ( (! element.style) || (element.nodeName != 'g' && element.id === null)) {
        return;
    }
    
    this._cacheStyle(element);

    if (element.nodeName == 'path' || element.nodeName == 'circle' || element.nodeName == 'ellipse') {
        element.setAttribute('opacity','1');
        element.style.setProperty('opacity',1,null);
    }
    element.setAttribute('fill-opacity','1');
    element.setAttribute('stroke-opacity','1');
    if (element.style.setProperty) {
        element.style.setProperty('fill-opacity',1,null);
        element.style.setProperty('stroke-opacity',1,null);
    }
};

/* Go through all the elements in the svg document and force the opacity to be translucent. Since
 * svgweb doesn't support the referencing of extrinsic stylesheets, we need to go through and 
 * explicitly set the opacity for all the elements. This is really slow on Internet Explorer.
 * We've got different behaviour for the different svg element types as they all react differently
 * to having their opacity set.
 */
GOMap.Diagram.prototype._forceOpacity = function() {
    var root_svg = this.element;
    var suspend_id = root_svg.suspendRedraw(5000);
    var els = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'*');
    for (var i = 0; i < els.length; i++ ) {
        if (els[i].nodeName == 'svg') {
            continue;
        }
        if (els[i].parentNode && els[i].parentNode.parentNode && els[i].parentNode.parentNode.nodeName == 'defs') {
            continue;
        }
        if (els[i].nodeName == 'defs' || (els[i].parentNode && els[i].parentNode.nodeName == 'defs')) {
            continue;
        }
        if (els[i].nodeName == 'path') {
            els[i].setAttribute('opacity','0.4');
            els[i].style.opacity = 0.4;
        } else {
            els[i].setAttribute('fill-opacity','0.3');
            els[i].setAttribute('stroke-opacity','0.2');
            if (els[i].style) {
                els[i].style.fillOpacity = 0.3;
                els[i].style.strokeOpacity = 0.2;
            }
        }
    }
    root_svg.unsuspendRedraw(suspend_id);
};


/**
 * @class       State class for adding panning functionality to an element. Each element that is to be panned needs a new instance
 *              of the Dragger to store state.
 * @author      hjjoshi
 * @requires    svgweb
 */
GOMap.Diagram.Dragger = function() {
  this.oX = 0;
  this.oY = 0;
  this.dX = 0;
  this.dY = 0;
  this.dragging = false;
  this.targetElement = null;
};

/**
 * Connect this dragger to a particular element. If an SVG element is given, panning occurs within the bounding box of the SVG, and
 * the image is shifted by using the currentTranslate property. If a regular HTML element is given, the scrollLeft and scrollTop attributes
 * are used to move the viewport around. 
 * @param {Element} targetElement Element to enable panning upon.
 */
GOMap.Diagram.Dragger.prototype.applyToElement = function(targetElement) {
    var self = this;
    self.enabled = true;
    
    var momentum = [];

    if (targetElement.nodeName == 'svg') {
        targetElement.getPosition = function() {
            var dX = targetElement.currentTranslate.x;
            var dY = targetElement.currentTranslate.y;

            return [dX, dY];
        };
        
        targetElement.shiftPosition = function(x,y) {
            var p = {'x' : x, 'y' : y };
            var viewBoxScale = 1;
            var vbox = this.getAttribute('viewBox');

            var min_x,min_y,width,height;

            if (vbox) {
                var viewBox = this.getAttribute('viewBox').split(' ');
                viewBoxScale = parseFloat(this.width.baseVal.value) / parseFloat(viewBox[2]);
                min_x = 0;
                min_y = parseInt(viewBox[1],10);
                width = parseInt(viewBox[2],10);
                height = parseInt(viewBox[3],10);
            } else {
                min_x = 0;
                min_y = 0;
                width = targetElement.width;
                height = targetElement.height;
            }

            if (targetElement.style.GomapScrollLeftMargin) {
                min_x += targetElement.style.GomapScrollLeftMargin;
            }
            
            if ( self.dragging ) {
                p.x = viewBoxScale*(p.x - self.oX);
                p.y = viewBoxScale*(p.y - self.oY);

                p.x += self.dX;
                p.y += self.dY;
                p.y = 0;
            }

            if (targetElement._snapback) {
                clearTimeout(targetElement._snapback);
                targetElement._snapback = null;
            }
            
            if (p.x > viewBoxScale * min_x) {
                /* Element has shifted too far to the right
                   Induce some gravity towards the left side
                   of the screen
                */
                targetElement._snapback = setTimeout(function() {
                    var evObj;
                    if (Math.abs(targetElement.currentTranslate.x - (viewBoxScale * min_x)) > 35 ) {
                        var new_pos = 0.95*(targetElement.currentTranslate.x - (viewBoxScale * min_x));
                        if (new_pos < (viewBoxScale * min_x)) {
                            new_pos = (viewBoxScale * min_x);
                        }
                        
                        targetElement.setCurrentTranslateXY( new_pos, 0);
                        window.requestAnimFrame(arguments.callee, targetElement);
//                        targetElement._snapback = setTimeout(arguments.callee,10);
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('panstart',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                    } else {
                        targetElement.setCurrentTranslateXY( (viewBoxScale * min_x), 0 );
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('pan',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                        if (! self.dragging) {
                            bean.fire(targetElement,'panend');
                        }
                        targetElement._snapback = null;
                    }
                },300);
            }
            
            var min_val = viewBoxScale * ( width - 2 * min_x );
            
            if (min_x === 0) {
                min_val *= 0.90;
            }
            if (p.x < 0 && Math.abs(p.x) > min_val) {
                /* Element has shifted too far to the left
                   Induce some gravity to the right side of the screen
                */
                targetElement._snapback = setTimeout(function() {
                    var evObj;
                    
                    if (Math.abs(targetElement.currentTranslate.x - (-1 * min_val)) > 35 ) {
                        var new_pos = 0.95*(targetElement.currentTranslate.x);
                        if (new_pos > (-1*min_val)) {
                            new_pos = -1*min_val;
                        }
                        targetElement.setCurrentTranslateXY( new_pos, 0);
                        window.requestAnimFrame(arguments.callee, targetElement);
//                        targetElement._snapback = setTimeout(arguments.callee,10);
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('panstart',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                    } else {
                        targetElement.setCurrentTranslateXY( -1*min_val, 0);                        
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('pan',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                        if (! self.dragging) {
                            bean.fire(targetElement,'panend');
                        }
                        targetElement._snapback = null;
                    }
                },300);
            }

            if (p.y > viewBoxScale * min_y) {
                p.y = viewBoxScale * min_y;
            }
            if (Math.abs(p.y) > 0.50*viewBoxScale * height ) {
                p.y = -0.50 * viewBoxScale * height;
            }
            if (this.setCurrentTranslateXY) {
                this.setCurrentTranslateXY(p.x,p.y);
            } else if (this.currentTranslate.setXY) {
                this.currentTranslate.setXY(p.x,p.y);
            } else {
                this.currentTranslate.x = p.x;
                this.currentTranslate.y = p.y;          
            }            

            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('pan',false,true);
                this.dispatchEvent(evObj);
            }
        };
    } else {
        targetElement.getPosition = function() {
            return [this.scrollLeft, this.scrollTop];
        };
        targetElement.shiftPosition = function(x,y) {
            this.scrollLeft = self.dX + (self.oX - x);
            this.scrollTop = self.dY + (self.oY - y);

            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('pan',false,true);
                this.dispatchEvent(evObj);
            }
        };
    }

    var stationary;

    var svgMouseDown = function(evt) {
      if ( ! self.enabled ) {
          return true;
      }

      var targ = self.targetElement ? self.targetElement : targetElement;
      var positions = mousePosition(evt);
      self.dragging = true;

      if (self.targetElement) {

          self.oX = positions[0];
          self.oY = positions[1];
          self.dX = self.targetElement.scrollLeft;
          self.dY = self.targetElement.scrollTop;
          evt.preventDefault(true);
          return;
      }

      var p = targetElement.createSVGPoint();
      positions = mousePosition(evt);
      p.x = positions[0];
      p.y = positions[1];

      var rootCTM = this.getScreenCTM();
      self.matrix = rootCTM.inverse();
      
      p = p.matrixTransform(self.matrix);

      self.dX = targetElement.getPosition()[0];
      self.dY = targetElement.getPosition()[1];

      self.oX = p.x;
      self.oY = p.y;

      evt.preventDefault(true);
      
      if (document.createEvent) {
          self.clicktimeout = setTimeout(function() {
              var evObj = document.createEvent('Events');
              evObj.initEvent('panstart',false,true);
              targ.dispatchEvent(evObj);
          },200);
      }

    };
    
    var mousePosition = function(evt) {
        var posx = 0;
        var posy = 0;
        if (!evt) {
            evt = window.event;
        }
        if (evt.pageX || evt.pageY)     {
            posx = evt.pageX;
            posy = evt.pageY;
        } else if (evt.clientX || evt.clientY)  {
            posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        if (self.targetElement) {
            posx = evt.screenX;
            posy = evt.screenY;
        }
        return [ posx, posy ];
    };
    
    var mouseMove = function(evt) {
        this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/openhand_8_8.cur)';
        var positions = mousePosition(evt);
        if (self.clicktimeout && Math.abs(positions[0] - self.oX) < 10 ) {
            mouseUp();
        }
        if (!self.dragging) {
           return;
        }
        this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/closedhand_8_8.cur)';

        targetElement.shiftPosition(positions[0],positions[1]);
        
        evt.preventDefault(true);
    };
    
    var mouseDown = function(evt) {
        self.dragging = true;
        var positions = mousePosition(evt);
        self.oX = positions[0];
        self.oY = positions[1];
        self.dX = targetElement.getPosition()[0];
        self.dY = targetElement.getPosition()[1];
        evt.preventDefault(true);
        var targ = self.targetElement ? self.targetElement : targetElement;
        if (document.createEvent) {
            var evObj = document.createEvent('Events');
            evObj.initEvent('panstart',false,true);
            targ.dispatchEvent(evObj);
        }
    };
    
    var svgMouseMove = function(evt) {
        if (!self.enabled) {
            this.style.cursor = 'pointer';
            return true;
        }
        this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/openhand_8_8.cur), move';
        if (!self.dragging) {
            return;
        }

        // if (stationary) {
        //     clearTimeout(stationary);
        //     stationary = null;
        // }
        // 
        // stationary = window.setTimeout(function() {
        //     self.dragging = false;
        // },200);        
        
        doMouseMove.call(this,evt);
    };

    var doMouseMove = function(evt) {        
        var positions = mousePosition(evt);
        this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/closedhand_8_8.cur), -moz-grabbing';

        if (self.targetElement) {
            self.targetElement.shiftPosition(positions[0],positions[1]);
            return;
        }

        
        var p = targetElement._cachedpoint || targetElement.createSVGPoint();
        targetElement._cachedpoint = p;
        
        positions = mousePosition(evt);

        p.x = positions[0];
        p.y = positions[1];

        var rootCTM = targetElement._cachedrctm || targetElement.getScreenCTM();
        targetElement._cachedrctm = rootCTM;
        
        p = p.matrixTransform(self.matrix);
        targetElement.shiftPosition(p.x,p.y);
//        momentum = p.x;        
    };

    var mouseUp = function(evt) { 
      if (self.clicktimeout) {
          clearTimeout(self.clicktimeout);
          self.clicktimeout = null;
      }
      if ( ! self.enabled ) {
          return true;
      }
      self.oX = 0;
      self.oY = 0;
      self.dX = null;
      self.dY = null;
      self.dragging = false;
      evt.preventDefault(true);
      
      var targ = self.targetElement ? self.targetElement : targetElement;      
      
      if (! targ._snapback) {
        bean.fire(targ,'panend',true);
      }
    };

    var mouseOut = function(e) {
        if (!self.dragging || ! self.enabled) {
            return true;
        }
        if (this == self.targetElement) {
            mouseUp(e);
        }
        
        
        if ( e.target != this && ! e.currentTarget ) {
            return;
        }

        var toTarget = e.relatedTarget ? e.relatedTarget : e.toElement;
        
        while (toTarget !== null) {
            if (toTarget == this) {
                return;
            }
            toTarget = toTarget.parentNode;
        }
        mouseUp(e);
    };
        
    targetElement.setAttribute('cursor','pointer');    
    
    if ( ! targetElement.addEventListener) {
        targetElement.addEventListener = function(name,func,bool) {
            this.attachEvent(name,func);
        };
    }
    
    targetElement.addEventListener('touchstart',function(e) {
        var targ = self.targetElement ? self.targetElement : targetElement;
        if (self.momentum) {
            window.clearTimeout(self.momentum);
            self.momentum = null;
        }
        if (e.touches.length == 1) {
            var positions = mousePosition(e.touches[0]);
            var p;
            if (targ.nodeName == 'svg') {
                p = targ.createSVGPoint();
                p.x = positions[0];
                p.y = positions[1];
                var rootCTM = this.getScreenCTM();
                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
            } else {
                p.x = positions[0];
                p.y = positions[1];
            }
            self.oX = p.x;
            self.oY = p.y;
            
            self.dragging = true;
            self.dX = targ.getPosition()[0];
            self.dY = targ.getPosition()[1];
            
            self._momentum_shrinker = setInterval(function() {
                momentum.shift();
            },20);
            
            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('panstart',false,true);
                targ.dispatchEvent(evObj);
            }
        }
    },false);


    // document.addEventListener('touchmove',function(e) {
    //     console.log('touchmove for the document');
    //     console.log(self.dragging);
    //     if ( ! self.dragging ) {
    //         return;
    //     }
    //     console.log("Ending the drag for document move");
    //     self.oX = 0;
    //     self.oY = 0;
    //     self.dX = null;
    //     self.dY = null;
    //     self.dragging = false;
    // 
    //     var targ = self.targetElement ? self.targetElement : targetElement;      
    // 
    //     if (document.createEvent) {
    //         var evObj = document.createEvent('Events');
    //         evObj.initEvent('panend',false,true);
    //         targ.dispatchEvent(evObj);
    //     }      
    // },false);

    targetElement.addEventListener('touchmove',function(e) {
        if (self.momentum) {
            window.clearTimeout(self.momentum);
            self.momentum = null;
        }

        if (e.touches.length != 1) {
            self.dragging = false;
        }

        var targ = self.targetElement ? self.targetElement : targetElement;

        var positions = mousePosition(e.touches[0]);

        var p;
        if (targ.nodeName == 'svg') {
            p = targ.createSVGPoint();
            p.x = positions[0];
            p.y = positions[1];
            p = p.matrixTransform(self.matrix);
        } else {
            p.x = positions[0];
            p.y = positions[1];
        }
        
        if (self.dragging && ((6*Math.abs(self.oX - p.x)) > Math.abs(self.oY - p.y))) {
            e.preventDefault();
        }

        if (!self.dragging) {
            self.oX = 0;
            self.oY = 0;
            self.dX = null;
            self.dY = null;
            return;
        }
        if (momentum.length > 3) {
            momentum.splice(2);
        }
        targ.shiftPosition(p.x,p.y);
        momentum.push(targ.getPosition()[0] - self.dX);
    },false);
    
    var momentum_func = function(e) {
        if ( ! self.enabled ) {
            return true;
        }
        if ( ! self.dragging ) {
            mouseUp(e);
            return;
        }
        var targ = self.targetElement ? self.targetElement : targetElement;
        var delta = 0;
        
        if (momentum.length > 0) {
            var last_val = momentum[0];
            momentum.forEach(function(m) {
                if ((typeof last_val) != 'undefined') {
                    delta += m - last_val;
                }
                last_val = m;
            });
            delta = delta / momentum.length;
        }
        var start = targ.getPosition()[0];
        var start_delta = delta;
        self.dragging = false;
        if (self.momentum) {
            window.clearTimeout(self.momentum);
        }
        self.momentum = 1;
        (function() {
            start = targ.getPosition()[0];
            if (self.dragging) {
                start += self.oX - self.dX;
            } else {
                self.oX = 0;
                self.dX = 0;
            }
            targ.shiftPosition(start+delta,0);
            start = start+delta;
            delta = delta * 0.5;
            
            if (Math.abs(start_delta / delta) < 10) {
                window.requestAnimFrame(arguments.callee, targ);
//                window.setTimeout(arguments.callee,50);
            } else {
                self.momentum = null;
                clearInterval(self._momentum_shrinker);
                mouseUp(e);
            }
        })();
    };
    
    targetElement.addEventListener('touchend',momentum_func,false);


    if (targetElement.nodeName == 'svg') {
        targetElement.addEventListener('mousedown', svgMouseDown, false);
        targetElement.addEventListener('mousemove', svgMouseMove, false);        
        targetElement.addEventListener('mouseup',mouseUp,false);
        targetElement.addEventListener('mouseout',mouseOut, false); 
        if (self.targetElement) {
            self.targetElement.addEventListener('mouseout',mouseOut,false);
        }
    } else {
        targetElement.addEventListener('mousedown', mouseDown, false);
        targetElement.addEventListener('mousemove', mouseMove, false);        
        targetElement.addEventListener('mouseup', mouseUp, false);        
        targetElement.addEventListener('mouseout',mouseOut, false);
    }

};


GOMap.Diagram.addTouchZoomControls = function(zoomElement,touchElement) {

    var mousePosition = function(evt) {
        var posx = 0;
        var posy = 0;
        if (!evt) {
            evt = window.event;
        }
        if (evt.pageX || evt.pageY)     {
            posx = evt.pageX;
            posy = evt.pageY;
        } else if (evt.clientX || evt.clientY)  {
            posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        if (self.targetElement) {
            posx = evt.screenX;
            posy = evt.screenY;
        }
        return [ posx, posy ];
    };
    touchElement.addEventListener('touchstart',function(e) {
        if (e.touches.length == 2) {
            var positions = mousePosition(e.touches[0]);
            var positions2 = mousePosition(e.touches[1]);
            var p;
            if (touchElement.nodeName == 'svg') {
                p = touchElement.createSVGPoint();
                p.x = 0.5*(positions[0] + positions2[0]);
                p.y = 0.5*(positions[1] + positions2[1]);
                var rootCTM = this.getScreenCTM();
                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
            } else {
                p.x = 0.5*(positions[0] + positions2[0]);
                p.y = 0.5*(positions[1] + positions2[1]);
            }
            zoomElement.zoomCenter = p;  
            e.preventDefault();
        }
    },false);

    touchElement.addEventListener('gesturestart',function(e) {
        zoomElement.zoomLeft = null;
        var zoomStart = zoomElement.zoom;

        var zoomscale = function(ev) {
            if ( zoomElement.zoomCenter ) {
                zoomElement.zoom = zoomStart * ev.scale;
            }
            ev.preventDefault();
        };
        this.addEventListener('gesturechange',zoomscale,false);
        this.addEventListener('gestureend',function(ev) {
            touchElement.removeEventListener('gesturechange',zoomscale);
            touchElement.removeEventListener('gestureend',arguments.callee);
            zoomElement.zoomCenter = null;
            zoomElement.zoomLeft = null;
            if (zoomElement.trigger) {
                zoomElement.trigger('gestureend');
            }
        },false);  
        e.preventDefault();
    },false);

};

/**
 * Given an element that implements a zoom attribute, creates a div that contains controls for controlling the zoom attribute. The
 * zoomElement must have a zoom attribute, and can fire the zoomChange event whenever the zoom value is changed on the object. The
 * scrollwheel is connected to this element so that when the mouse hovers over the controls, it can control the zoom using only
 * the scroll wheel.
 * @param {Object} zoomElement Element to control the zooming for.
 * @param {Number} min Minimum value for the zoom attribute (default 0)
 * @param {Number} max Maximum value for the zoom attribute (default 10)
 * @param {Number} precision Step precision for the zoom control (default 0.5)
 * @param {Number} value Default value for this control
 * @returns DIV element containing the controls
 * @type Element
 * @see GOMap.Diagram#event:zoomChange
 */
GOMap.Diagram.addZoomControls = function(zoomElement,min,max,precision,value) {
    min = min || 0;
    max = max || 10;
    precision = precision || 0.5;
    value = value || zoomElement.zoom || min; 
    
    var controls_container = document.createElement('div');
    
    var zoomIn = document.createElement('input');
    zoomIn.setAttribute('type','button');
    zoomIn.setAttribute('value','+');
    var zoomOut = document.createElement('input');
    zoomOut.setAttribute('type','button');
    zoomOut.setAttribute('value','-');
    var reset = document.createElement('input');
    reset.setAttribute('type','button');
    reset.setAttribute('value','Reset');

    controls_container.appendChild(reset);    

    reset.addEventListener('click',function() {
        zoomElement.zoom = zoomElement.defaultZoom || value;
    },false);
    
    var range = document.createElement('input');
    range.setAttribute('min',min);
    range.setAttribute('max',max);
    range.setAttribute('step',precision);
    range.setAttribute('value',value); 
    range.setAttribute('type','range');
    range.setAttribute('style','-webkit-appearance: slider-horizontal; width: 100%; position: absolute; top: 0px; bottom: 0px; margin-top: 0.5em; left: 100%; margin-left: -0.5em;');

    if (range.type == 'range') {
        
        range.addEventListener('change',function() {
            zoomElement.zoom = this.value;
        },false);
        
        var evFunction = null;
        if (zoomElement.addEventListener) {
            evFunction = zoomElement.addEventListener;
        } else if (zoomElement.bind){
            evFunction = zoomElement.bind;
        }
        
        evFunction.apply(zoomElement,['zoomChange',function() {
            range.value = zoomElement.zoom;
        },false]);
        

        reset.style.margin = '0px';
        reset.style.display = 'block';
        reset.style.position = 'absolute';
        reset.style.top = '0px';
        
        controls_container.appendChild(range);
        controls_container.style.height = '100%';
    } else {
        if (! zoomIn.addEventListener) {
            var addevlis = function(name,func) {
                this.attachEvent(name,func);
            };
            zoomIn.addEventListener = addevlis;
            reset.addEventListener = addevlis;
            zoomOut.addEventListener = addevlis;        
        }
        zoomIn.addEventListener('click',function() {
            zoomElement.zoom += precision;
        },false);
        zoomOut.addEventListener('click',function() {
            zoomElement.zoom -= precision;
        },false);

        zoomIn.style.margin = '0px';
        zoomIn.style.display = 'block';
        zoomIn.style.position = 'absolute';
        zoomIn.style.top = '0px';
        zoomIn.style.left = '29px';

        zoomOut.style.margin = '0px';
        zoomOut.style.display = 'block';
        zoomOut.style.position = 'absolute';
        zoomOut.style.top = '0px';

        reset.style.margin = '0px';
        reset.style.display = 'block';
        reset.style.position = 'absolute';
        reset.style.top = '23px';
        reset.style.left = '3px';

        controls_container.appendChild(zoomOut);
        controls_container.appendChild(zoomIn);
        controls_container.appendChild(reset);
    }

    this.addScrollZoomControls(zoomElement,controls_container,precision);

    return controls_container;
};

/**
 * Connect the scroll wheel to the controls to control zoom
 */
GOMap.Diagram.addScrollZoomControls = function(target,controlElement,precision) {
    precision = precision || 0.5;

    var self = this;

    var hookEvent = function(element, eventName, callback) {
      if (typeof(element) == 'string') {
        element = document.getElementById(element);
      }

      if (element === null) {
        return;
      }

      if (element.addEventListener) {
        if (eventName == 'mousewheel') {
          element.addEventListener('DOMMouseScroll', callback, false);  
        }
        element.addEventListener(eventName, callback, false);
      } else if (element.attachEvent) {
        element.attachEvent("on" + eventName, callback);
      }
    };


    var mousePosition = function(evt) {
          var posx = 0;
          var posy = 0;
          if (!evt) {
              evt = window.event;
          }
          if (evt.pageX || evt.pageY)   {
              posx = evt.pageX;
              posy = evt.pageY;
          } else if (evt.clientX || evt.clientY)    {
              posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
              posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
          }

          var p = {};

          if (controlElement.nodeName == 'svg') {
              p = controlElement.createSVGPoint();
              p.x = posx;
              p.y = posy;
              var rootCTM = controlElement.getScreenCTM();
              self.matrix = rootCTM.inverse();
              p = p.matrixTransform(self.matrix);
          } else {
              p.x = posx;
              p.y = posy;
          }

          return p;
    };

    var mouseWheel = function(e) {

      e = e ? e : window.event;
      var wheelData = e.detail ? e.detail * -1 : e.wheelDelta;
      target.zoomCenter = mousePosition(e);
      
      if (wheelData > 0) {
        target.zoom = target.zoom += precision;
      } else {
        target.zoom = target.zoom -= precision;
      }
      
      
      if (e.preventDefault) {
        e.preventDefault();
      }
      return false;
    };

    var isFF = false;

    if (navigator.userAgent.indexOf('Gecko') >= 0) {
      isFF = parseFloat(navigator.userAgent.split('Firefox/')[1]) || undefined;
    }                         

    if (isFF && (typeof svgweb != 'undefined')&& svgweb.getHandlerType() == 'native') {
      hookEvent(controlElement, 'mousewheel',
                mouseWheel);
    } else {
      hookEvent(controlElement, 'mousewheel', mouseWheel);
    }

    hookEvent(controlElement,'mousemove', function(e) {
        if (target.zoomCenter && Math.abs(target.zoomCenter.x - mousePosition(e).x) > 100) {
            target.zoomCenter = null;
            target.zoomLeft = null;
        }
    });
};


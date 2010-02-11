/**
 *  @fileOverview   Basic classes and defitions for a Gene Ontology ID based map
 */

/*
 *  Include the svgweb library when we include this script. Set the SVGWEB_PATH environment variable if
 *  you wish to retrieve svgweb from a relative path other than ./svgweb/src
 */
if (document.write && (typeof svgweb == 'undefined')) {
    if (typeof SVGWEB_PATH != 'undefined') {
        document.write('<script src="'+SVGWEB_PATH+'svg.js" data-path="'+SVGWEB_PATH+'"></script>');        
    } else {
        document.write('<script src="svgweb/src/svg.js" data-path="svgweb/src/"></script>');
    }
}

/** Convenience logging function. If there is no log function defined, add a log method that simply
 *  forwards the message on to the console.log.
 *  @function
 *  @param  {Object}    message Message to log
 */
log = (typeof log == 'undefined') ? function(msg) {
    if (typeof msg == 'String' && arguments.length == 1) {
        console.log("%s", msg);
    } else {
        console.log.apply(console,arguments);
    }
    return this;
} : log ;


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

if (document.write) {
    document.write('<!--[if IE 7]><script type="text/javascript">GOMap.IE = true; GOMap.IE7 = true; GOMap.IELTE7 = true;</script><![endif]-->');
    document.write('<!--[if IE 8]><script type="text/javascript">GOMap.IE = true; GOMap.IE8 = true; GOMap.IELTE8 = true;</script><![endif]-->');
}


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
    this._highlighted = {};
    this._styles_cache = {};
    var url = null;
    if (typeof image == 'string') {
        url = image;
        image = null;
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'object') {
        url = image.getAttribute('src') || image.getAttribute('data');
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'svg') {        
        var self = this;
        (function() {
            if ( ! GOMap.LOADED ) {
                window.attachEvent('onload',arguments.callee);
                return;
            }
            self._container = image.parentNode;
            self.element = image;
            self._svgLoaded();
            
            if (params['load']) {
                params['load'].apply(self);
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
    
    var self = this;
    this.element.addEventListener('load',function() {
        if (this.contentDocument != null) {
            self.element = this.contentDocument.rootElement;
        } else {
            self.element = this.getAttribute('contentDocument').rootElement
        }
        
        // Make the destroy function an anonymous function, so it can access this new
        // element without having to store it in a field
        
        var svg_object = this;
        self.destroy = function() {
            svgweb.removeChild(svg_object, svg_object.parentNode);
        };

        self._svgLoaded();
        
        if (params['load']) {
            params['load'].apply(self);
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
    svgweb.appendChild(this.element,parent);
    return this;
}


/**
 * Highlight a given keyword on the diagram
 * @param {String} keyword  GO keyword to highlight
 * @param {String} color    CSS color string to use as the highlighting colour. Defaults to #ff0000.
 */
GOMap.Diagram.prototype.showKeyword = function(keyword,color) {
    var els = this._elementsForKeyword(keyword);
    
    if (this._highlighted[keyword] && ! color) {
        return;
    }
    
    color = color || '#ff0000';
    
    this._highlighted[keyword] = true;

    for (var i = 0; i < els.length; i++ ) {
        els[i]._highlighted = els[i]._highlighted || {};
        els[i]._highlighted[color] = true;
        if (els[i].nodeName == 'path' || els[i].nodeName == 'circle') {
            this._outlineElement(els[i]);
        }
    }
    var self = this;
    this._recurse(els, function(el) {
        self._highlightElement(el);
    });
        
};

/**
 * Hide all the keywords currently being highlighted on this diagram
 */
GOMap.Diagram.prototype.hideAllKeywords = function() {    
    for (var key in this._highlighted) {
        this.hideKeyword(key);
    }
}

/**
 * Hide a given keyword on the diagram
 * @param {String} keyword  GO keyword to turn highlighting off for
 */
GOMap.Diagram.prototype.hideKeyword = function(keyword,color) {
    var els = this._elementsForKeyword(keyword);
    var self = this;

    this._highlighted[keyword] = false;
    
    this._recurse(els, function(el) {
        if (color != null && el._highlighted) {
            el._highlighted[color] = false;
        } else {
            el._highlighted = {};
        }
        for (var col in el._highlighted) {
            if (el._highlighted[col] == true) {
                self._outlineElement(el);
                return;
            }
        }
        self._restoreStyle(el);
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
    } else {
        this.showKeyword(keyword,color);
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
    if ( ! this._events || ! this._events['zoomChange'] ) {
        return;
    }
    for ( var i = 0; i < this._events['zoomChange'].length; i++ ) {
        this._events['zoomChange'][i].apply(this,[{'type' : 'zoomChange'}]);
    }        
};

var accessors = {
        
    setZoom: function(zoomLevel) {
        if (zoomLevel < 0) {
            zoomLevel = 0;
        }
        if (zoomLevel > 2) {
            zoomLevel = 2;
        }
        
        if (this.element) {
            this.element.currentScale = zoomLevel;
        }
        
        zoomChange.apply(this);

    },

    getZoom: function() {
        return this.element.currentScale;
    }
};



if (GOMap.Diagram.prototype.__defineSetter__) {
    GOMap.Diagram.prototype.__defineSetter__("zoom", accessors.setZoom);
    GOMap.Diagram.prototype.__defineGetter__("zoom", accessors.getZoom);
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
        log("Browser does not support addEventListener");
        return;
    }
    
    new GOMap.Diagram.Dragger().applyToElement(root);
    var controls = GOMap.Diagram.addZoomControls(this,0.1,2,0.1,1);
    container.appendChild(controls);
    controls.style.position = 'absolute';
    controls.style.top = '0px';
    controls.style.left = '0px';
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
    var results = [];
    if (doc.evaluate) {
        xpath_result = doc.evaluate(xpath,element,null,XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,null);
        var i = 0;
        while ( (a_result = xpath_result.snapshotItem(i)) != null ) {
            results.push(a_result);
            i++;
        }
    } else {
        xpath_result = element.selectNodes(xpath);
        for (var i = 0; i < xpath_result.length; i++ ){
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
        callback.call(this,nodelist[i]);        
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
        var an_id = 'svg'+(new Date).getTime().toString();
        el.setAttribute('id',an_id);
    }

    if (this._styles_cache[el.id] != null || ! el.style || ! el.id ) {
        return;
    }
    this._styles_cache[el.id] = {
        'stroke'         : el.style.getPropertyValue('stroke'),
        'stroke-width'   : el.style.getPropertyValue('stroke-width') || '0px',
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
        var properties = {'stroke-width':null,'opacity':null,'stroke':null,'fill-opacity':null,'stroke-opacity':null};
        for (var prop in properties) {
            // We don't set null properties in IE because they cause the wrong styles to be displayed
            if ( GOMap.IE && ! cacher[prop] ) {
                continue;
            }
            element.style.setProperty(prop,cacher[prop],null);
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
    element.style.setProperty('stroke-width',4,null);
    element.style.setProperty('stroke-opacity',1,null);
};

/*
 * Calculate the color fill. Since there may be more than one color highlighted
 * on this element, we build the pattern if needed, and return a reference to 
 * that pattern if a pattern is to be used.
 */

GOMap.Diagram.prototype._calculateColorForElement = function(element) {
    var pattern = "pat";
    var total_keywords = 0;
    for (var col in element._highlighted) {
        if (element._highlighted && element._highlighted[col] == true) {
            pattern += "_"+col;
            total_keywords++;
        }
    }
    if (total_keywords == 1) {
        return pattern.split(/_/)[1];
    } else {
        return this._buildPattern(pattern);
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
    var pattern_width = 100.0 / (pattern_els.length - 1);
    var start_pos = 0;
    
    for (var i = 1; i < pattern_els.length; i++ ) {
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

/* Highlight an element by making it opaque
 * @param {Element} element Element to make opaque
 */
GOMap.Diagram.prototype._highlightElement = function(element) {
    // Skip this if we don't have a style or has no id and isn't a group
    if (! element.style || (! element.id && ! element.nodeName == 'g') ) {
        return;
    }
    
    this._cacheStyle(element);

    if (element.nodeName == 'path' || element.nodeName == 'circle') {
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
    var svgMouseDown = function(evt) {
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
      var positions = mousePosition(evt);
      p.x = positions[0];
      p.y = positions[1];

      var rootCTM = targetElement.getScreenCTM();
      self.inverseRootCTM = rootCTM.inverse();

      p = p.matrixTransform(self.inverseRootCTM);

      var cur_x = targetElement.currentTranslate.x || targetElement.currentTranslate.getX();
      var cur_y = targetElement.currentTranslate.y || targetElement.currentTranslate.getY();

      self.oX = p.x - self.dX - cur_x;
      self.oY = p.y - self.dY - cur_y;

      evt.preventDefault(true);
    };
    
    var mousePosition = function(evt) {
        var posx = 0;
        var posy = 0;
        if (!evt) var evt = window.event;
        if (evt.pageX || evt.pageY) 	{
            posx = evt.pageX;
            posy = evt.pageY;
        } else if (evt.clientX || evt.clientY) 	{
            posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }
        if (self.targetElement) {
            posx = evt.screenX;
            posy = evt.screenY;
        }
        return [ posx, posy ];
    }
    
    var mouseMove = function(evt) {
        this.style.cursor = 'all-scroll';
        var positions = mousePosition(evt);
        if (!self.dragging) {
           return;
        }
        this.style.cursor = '-moz-grabbing';
        targetElement.scrollLeft = self.dX + (self.oX - positions[0]);
        targetElement.scrollTop = self.dY + (self.oY - positions[1]);
        evt.preventDefault(true);
    };
    
    var mouseDown = function(evt) {
        self.dragging = true;
        var positions = mousePosition(evt);
        self.oX = positions[0];
        self.oY = positions[1];
        self.dX = targetElement.scrollLeft;
        self.dY = targetElement.scrollTop;
        evt.preventDefault(true);
    };
    
    var svgMouseMove = function(evt) {
        this.style.cursor = 'all-scroll';
        var positions = mousePosition(evt);
        if (!self.dragging) {
            return;
        }
        this.style.cursor = '-moz-grabbing';        
        if (self.targetElement) {
            self.targetElement.scrollLeft = self.dX + (self.oX - positions[0]);
            self.targetElement.scrollTop = self.dY + (self.oY - positions[1]);
            evt.preventDefault(true);
          return;
        }
        evt.preventDefault(true);


        var p = targetElement.createSVGPoint();
        var positions = mousePosition(evt);



        p.x = positions[0];
        p.y = positions[1];
        
        p = p.matrixTransform(self.inverseRootCTM);
        p.x -= self.oX;
        p.y -= self.oY;

        self.dX = p.x;
        self.dY = p.y;

        if (p.x > 0 || p.y > 0) {
            return;
        }

        if (targetElement.currentTranslate.setXY) {
            targetElement.currentTranslate.setXY(p.x,p.y);
        } else {
            targetElement.currentTranslate.x = p.x;
            targetElement.currentTranslate.y = p.y;          
        }
    };

    var mouseOut = function(e) {
        var toTarget = e.relatedTarget || e.toElement;
        e.preventDefault(true);

        while (toTarget != null) {
            if (toTarget == this) {
                return;
            }
            toTarget = toTarget.parentNode;
        }
        self.dragging = false;
    };
    
    var mouseUp = function(evt) { 
      self.oX = 0;
      self.oY = 0;
      self.dX = null;
      self.dY = null;
      self.dragging = false;
      evt.preventDefault(true);
    };
    
    targetElement.setAttribute('cursor','pointer');    
    
    if ( ! targetElement.addEventListener) {
        targetElement.addEventListener = function(name,func,bool) {
            this.attachEvent(name,func);
        }
    }

    if (targetElement.nodeName == 'svg') {
        targetElement.addEventListener('mousedown', svgMouseDown, false);
        targetElement.addEventListener('mousemove', svgMouseMove, false);        
        targetElement.addEventListener('mouseup', mouseUp, false);
    } else {
        targetElement.addEventListener('mousedown', mouseDown, false);
        targetElement.addEventListener('mousemove', mouseMove, false);        
        targetElement.addEventListener('mouseup', mouseUp, false);        
        targetElement.addEventListener('mouseout',mouseOut, false);
    }

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
    value = value || min; 
    
    var controls_container = document.createElement('div');
    controls_container.style.height = '30%';   
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
        zoomElement.zoom = value;
    },false);
    
    var range = document.createElement('input');
    range.setAttribute('min',min);
    range.setAttribute('max',max);
    range.setAttribute('step',precision);
    range.setAttribute('value',value); 
    range.setAttribute('type','range');
    range.setAttribute('style','-webkit-appearance: slider-vertical; height: 100%; width: 1em; position: absolute; top: 0px; margin-top: 2em; left: 50%; margin-left: -0.5em;');

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
        controls_container.appendChild(range);
        
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

        controls_container.appendChild(zoomOut);
        controls_container.appendChild(zoomIn);
    }

    this._scrollZoomControls(controls_container,zoomElement,precision);

    return controls_container;
};

/**
 * Connect the scroll wheel to the controls to control zoom
 */
GOMap.Diagram._scrollZoomControls = function(controlElement,target,precision) {
    var hookEvent = function(element, eventName, callback) {
      if (typeof(element) == 'string') {
        element = document.getElementById(element);
      }

      if (element == null) {
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

    var mouseWheel = function(e) {
      e = e ? e : window.event;
      var wheelData = e.detail ? e.detail * -1 : e.wheelDelta;
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

    if (isFF && svgweb.getHandlerType() == 'native') {
      hookEvent(controlElement, 'mousewheel',
                mouseWheel);
    } else {
      hookEvent(controlElement, 'mousewheel', mouseWheel);
    }
};


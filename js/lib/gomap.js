/**
 *  @fileOverview   Basic classes and defitions for a Gene Ontology ID based map
 */

/*
 *  Include the svgweb library when we include this script. Set the SVGWEB_PATH environment variable if
 *  you wish to retrieve svgweb from a relative path other than ./svgweb/src
 */
if (document.write && (typeof svgweb == 'undefined')) {
    if (typeof SVGWEB_PATH != 'undefined') {
        document.write('<script src="'+SVGWEB_PATH+'svg-uncompressed.js" data-path="'+SVGWEB_PATH+'"></script>');        
    } else {
        document.write('<script src="svgweb/src/svg-uncompressed.js" data-path="svgweb/src/"></script>');
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


/**
 * @class   A diagram that can be marked up with keywords.
 * @param   image   Image to be used for the diagram. Either an url to an svg file, an existing object element with a src attribute, or a reference to an SVG element if the SVG has been inlined.
 * @author hjjoshi
 * @requires svgweb
 */
GOMap.Diagram = function(image) {

    this._highlighted = {};
    this._styles_cache = {};

    var url = null;
    if (typeof image == 'string') {
        url = image;
        image = null;
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'object') {
        url = image.getAttribute('src') || image.getAttribute('data');
    } else if (image.nodeName && image.nodeName.toLowerCase() == 'svg') {
        this.element = image;
        this._svgLoaded();
        var evt = document.createEvent('load');
        evt.initEvent('ready',false,true);
        image.dispatchEvent(evt);
        return;
    }

    
    this.element = document.createElement('object',true);
    
    this.element.setAttribute('data',url);
    this.element.setAttribute('type','image/svg+xml');
    this.element.setAttribute('width','100%');
    this.element.setAttribute('height','100%');

    var self = this;
    this.element.addEventListener('load',function() {
        self.element = (this.contentDocument || this.getAttribute('contentDocument')).rootElement;
        
        // Make the destroy function an anonymous function, so it can access this new
        // element without having to store it in a field
        
        var svg_object = this;
        self.destroy = function() {
            svgweb.removeChild(svg_object, svg_object.parentNode);
        };

        self._svgLoaded();
        if (self._container) {
            var evt = document.createEvent('Events');
            evt.initEvent('load',false,true);
            self._container.dispatchEvent(evt);
        }
    },false);
    
    if (image) {
        this.appendTo(image.parentNode);
        image.parentNode.removeChild(image);
    }
};


//GOMap.Diagram.prototype = document.createElement('div',false);

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


GOMap.Diagram.prototype._svgLoaded = function() {
    if (true || GOMap.IE) {
        this._forceOpacity();
    }
};

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

GOMap.Diagram.prototype._recurse = function(nodelist,callback) {
    for (var i = 0; i < nodelist.length; i++) {
        callback.call(this,nodelist[i]);        
        if (nodelist[i].childNodes.length > 0) {
            this._recurse(nodelist[i].childNodes,callback);
        }
    }
};

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

GOMap.Diagram.prototype._restoreStyle = function(element) {
    if ( ! element.style ) {
        return;
    }
    if (this._styles_cache[element.id]) {
        var cacher = this._styles_cache[element.id];
        var properties = {'stroke-width':null,'opacity':null,'stroke':null,'fill-opacity':null,'stroke-opacity':null};
        for (var prop in properties) {
            if ( GOMap.IE && ! cacher[prop] ) {
                continue;
            }
            element.style.setProperty(prop,cacher[prop],null);
        }
    }
};


GOMap.Diagram.prototype._outlineElement = function(element,color) {
    if ( ! element.style ) {
        return;
    }
    this._cacheStyle(element);
    
    var target_color = this._calculateColorForElement(element);
    
    element.style.setProperty('stroke',target_color,null);
    element.style.setProperty('stroke-width',4,null);
    element.style.setProperty('stroke-opacity',1,null);
};

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

GOMap.Diagram.prototype._buildPattern = function(pattern_name) {
    var pattern_els = pattern_name.split('_');
    this._cached_patterns = this._cached_patterns || {};
    var cleaned_name = pattern_name.replace(/#/g,'');
    if (this._cached_patterns[cleaned_name]) {
        return 'url(#'+cleaned_name+')';
    }
    
    var root_svg = this.element;
    var defs_el = root_svg.ownerDocument.getElementsByTagNameNS(svgns,'defs')[0];

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


GOMap.Diagram.prototype._highlightElement = function(element) {
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
    element.style.setProperty('fill-opacity',1,null);
    element.style.setProperty('stroke-opacity',1,null);
};

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

GOMap.Diagram.Dragger = function() {
  this.oX = 0;
  this.oY = 0;
  this.dX = 0;
  this.dY = 0;
  this.dragging = false;
  this.targetElement = null;
};

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

GOMap.Diagram.addZoomControls = function(zoomElement) {
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
        zoomElement.zoom = 1;
    },false);
    
    var range = document.createElement('input');
    range.setAttribute('min','0.5');
    range.setAttribute('max','10');
    range.setAttribute('precision','0.5');
    range.setAttribute('value','1'); 
    range.setAttribute('type','range');
    range.setAttribute('style','-webkit-appearance: slider-vertical; height: 100%; width: 1em; position: absolute; top: 0px; margin-top: 2em; left: 50%; margin-left: -0.5em;');

    if (range.type == 'range') {
        range.addEventListener('change',function() {
            zoomElement.zoom = this.value;
        },false);
        zoomElement.registerEvent('zoomChange',function() {
            range.value = zoomElement.zoom;
        },false);
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
            zoomElement.zoom += 0.1;
        },false);
        zoomOut.addEventListener('click',function() {
            zoomElement.zoom -= 0.1;
        },false);

        controls_container.appendChild(zoomOut);
        controls_container.appendChild(zoomIn);
    }

    return controls_container;
};

GOMap.Diagram.prototype.makeDraggable = function() {
    
    var root = this.element;
    var container = this._container;

    try {
        var foo = root.addEventListener;
    } catch(err) {
        log("Browser does not support addEventListener");
        return;
    }
    
    new GOMap.Diagram.Dragger().applyToElement(root);
//    GOMap.Diagram.createDragEvents(root);

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
        root.currentScale = root.currentScale * 1.1;
      } else {
        root.currentScale = root.currentScale / 1.1;
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
      hookEvent(root, 'mousewheel',
                mouseWheel);
    } else {
      hookEvent(container, 'mousewheel', mouseWheel);
    }    
};

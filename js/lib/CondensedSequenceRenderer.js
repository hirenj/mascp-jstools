/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
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


/** Default class constructor
 *  @class      Renders a sequence using a condensed track-based display
 *  @param      {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *              the container that data will be re-inserted into.
 *  @extends    MASCP.SequenceRenderer
 */
MASCP.CondensedSequenceRenderer = function(sequenceContainer) {
    MASCP.SequenceRenderer.apply(this,arguments);
    var self = this;
    
    
    this.__class__ = MASCP.CondensedSequenceRenderer;
    
    // When we have a layer registered with the global MASCP object
    // add a track within this rendererer.
    jQuery(MASCP.SequenceRenderer).bind('layerRegistered', function(e,layer) {
        self.addTrack(layer);
        self.hideLayer(layer);
    });
    
    // We want to unbind the default handler for sequence change that we get from
    // inheriting from CondensedSequenceRenderer
    jQuery(this).unbind('sequenceChange');
    jQuery(this).bind('sequenceChange',function() {
        for (var layername in MASCP.SequenceRenderer._layers) {
            self.addTrack(MASCP.SequenceRenderer._layers[layername]);
            MASCP.SequenceRenderer._layers[layername].disabled = true;
        }
        self.zoom = self.zoom;
    });
    return this;
};

MASCP.CondensedSequenceRenderer.prototype = new MASCP.SequenceRenderer();

MASCP.CondensedSequenceRenderer.prototype._createCanvasObject = function() {
    var renderer = this;

    if (this._object) {
        var track_el = this._object.parentNode;        
        svgweb.removeChild(this._object, this._object.parentNode);
        track_el.parentNode.removeChild(track_el);
        this._canvas = null;
        this._object = null;
        this._layer_containers = null;
    }

    var canvas = document.createElement('object',true);

    canvas.setAttribute('data','blank.svg');
    canvas.setAttribute('type','image/svg+xml');
    canvas.setAttribute('width','100%');
    canvas.setAttribute('height','100%');
    
    canvas.addEventListener('load',function() {
        renderer._canvas = (this.contentDocument || this.getAttribute('contentDocument')).rootElement;
        renderer._canvas._canvas_height = 0;
        renderer._object = this;
        jQuery(renderer).trigger('svgready');
    },false);
    
    return canvas;
};

MASCP.CondensedSequenceRenderer._extendWithSVGApi = function(canvas) {

    canvas.path = function(pathdesc) {
      var a_path = document.createElementNS(svgns,'path');
      a_path.setAttribute('d', pathdesc);
      a_path.setAttribute('stroke','#000000');
      a_path.setAttribute('stroke-width','1');
      this.appendChild(a_path);
      return a_path;
    };

    canvas.rect = function(x,y,width,height) {
      var a_rect = document.createElementNS(svgns,'rect');
      a_rect.setAttribute('x', x);
      a_rect.setAttribute('y', y);
      a_rect.setAttribute('width', width);
      a_rect.setAttribute('height', height);
      a_rect.setAttribute('stroke','#000000');
      this.appendChild(a_rect);
      return a_rect;
    };

    canvas.set = function() {
        var an_array = new Array();
        an_array.attr = function(hash) {
            for (var key in hash) {
                for (var i = 0; i < an_array.length; i++) {
                    an_array[i].setAttribute(key, hash[key]);
                    if (key == 'y' && an_array[i].hasAttribute('d')) {
                        var curr_path = an_array[i].getAttribute('d');
                        var re = /M(\d+) (\d+)/;
                        curr_path = curr_path.replace(re,'');
                        an_array[i].setAttribute('d', 'M0 '+parseInt(hash[key])+' '+curr_path);
                    }
                }
            }
        };
        an_array.hide = function() {
            this.attr({ 'display' : 'none'});
        };
        an_array.show = function() {
            this.attr({ 'display' : 'block'});
        };
        an_array._old_push = an_array.push;
        an_array._event_proxy = new Object();
        
        var event_func = function(ev) {
            jQuery(an_array._event_proxy).trigger(ev.type);
        };
        
        an_array.push = function(new_el) {
            this._old_push(new_el);
            var event_names = ['mouseover','mousedown','mousemove','mouseout','click','mouseup'];
            for (var i = 0 ; i < event_names.length; i++) {
                jQuery(new_el).bind(event_names[i], event_func);
            }
        };
        return an_array;
    };
    
    canvas.text = function(x,y,text) {
        var a_text = document.createElementNS(svgns,'text');
        a_text.textContent = text;
        a_text.style.fontFamily = 'Helvetica, Verdana, Arial, Sans-serif';
        a_text.setAttribute('x',x);
        a_text.setAttribute('y',y);        
        this.appendChild(a_text);
        return a_text;
    };    
};

MASCP.CondensedSequenceRenderer.prototype._drawAminoAcids = function(canvas) {
    var seq_chars = this.sequence.split('');
    var renderer = this;
    var amino_acids = canvas.set();
    var x = 0;
    
    for (var i = 0; i < seq_chars.length; i++) {
        amino_acids.push(canvas.text(x,12,seq_chars[i]));
        x += 1;
    }
    amino_acids.attr( { 'display':'none','width': '1','text-anchor':'start','dominant-baseline':'hanging','height': '1','font-size':'1','fill':'#000000', 'font-family':'monospace'});

    try {
        var foo = canvas.addEventListener;
    } catch(err) {
        log("Browser does not support addEventListener");
        return;
    }
    jQuery(canvas).bind('zoomChange', function() {
       if (renderer.zoom < 3.8 && renderer.zoom > 3.5 ) {
           renderer.zoom = 4;
           return;
       }
       if (renderer.zoom > 3.8 && renderer.zoom < 4 ) {
           renderer.zoom = 3.5;
           return;
       }
       if (canvas.zoom > 3.5) {
           renderer._axis_height = 14;
           amino_acids.attr({'display':'block'});
       } else {
           renderer._axis_height = 30;
           amino_acids.attr({'display':'none'});           
       }
       renderer.refresh();
       renderer._resizeContainer();
   });
};

MASCP.CondensedSequenceRenderer.prototype._drawAxis = function(canvas,lineLength) {
    var x = 0;
    var axis = canvas.set();
    axis.push(canvas.path('M0 10 l0 20'));
    axis.push(canvas.path('M'+(lineLength)+' 10 l0 20'));

    this._axis_height = 30;

    var big_ticks = canvas.set();
    var little_ticks = canvas.set();
    var big_labels = canvas.set();
    var little_labels = canvas.set();
    for (var i = 0; i < (lineLength/5); i++ ) {

        if ( (x % 10) == 0) {
            big_ticks.push(canvas.path('M'+x+' 14 l 0 12'));
        } else {
            little_ticks.push(canvas.path('M'+x+' 16 l 0 8'));
        }

        if ( (x % 20) == 0 && x != 0) {
            big_labels.push(canvas.text(x,5,""+(x)));
        } else if (( x % 10 ) == 0 && x != 0) {
            little_labels.push(canvas.text(x,7,""+(x)));
        }

        x += 5;
    }
    
    for ( var i = 0; i < big_labels.length; i++ ) {
        big_labels[i].style.textAnchor = 'middle';
        big_labels[i].setAttribute('dominant-baseline','hanging');
        big_labels[i].setAttribute('font-size','7pt');
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

    try {
        var foo = canvas.addEventListener;
    } catch(err) {
        log("Browser does not support addEventListener");
        return;
    }
    jQuery(canvas).bind('zoomChange', function() {
           if (this.zoom > 3.6) {
               little_ticks.hide();
               big_ticks.hide();
               little_labels.attr({'font-size':'2pt'});
               big_labels.attr({'font-size': '2pt'});
               axis.hide();
               if (this.tracers) {
                   this.tracers.show();
               }
           } else if (this.zoom > 1.8) {
               axis.show();
               big_ticks.show();
               axis.attr({'stroke-width':'0.5pt'});
               big_ticks.attr({'stroke-width':'0.5pt'});
               big_labels.show();
               big_labels.attr({'font-size':'4pt','y':'7'});
               little_labels.attr({'font-size':'4pt'});
               little_ticks.attr({'stroke-width':'0.3pt'});
               little_ticks.show();
               little_labels.show();
               if (this.tracers) {
                this.tracers.hide();
                }
           } else {
                if (this.tracers) {
                this.tracers.hide();
                }
               axis.show();
               axis.attr({'stroke-width':'1pt'});
               big_ticks.show();
               big_ticks.attr({'stroke-width':'1pt'});
               big_labels.show();
               big_labels.attr({'font-size':'7pt','y':'5'});
               little_ticks.hide();
               little_labels.hide();
           }
    });
};

MASCP.CondensedSequenceRenderer.prototype.setSequence = function(sequence) {
    this.sequence = this._cleanSequence(sequence);
    var seq_chars = this.sequence.split('');
    var line_length = seq_chars.length;

    if (line_length == 0) {
        return;
    }

    var renderer = this;

    var seq_els = [];
    
    jQuery(seq_chars).each( function(i) {
        var el = {};
        el._index = i;
        el._renderer = renderer;
        renderer._extendElement(el);
        el.amino_acid = this;
        seq_els.push(el);
    });

    this._sequence_els = seq_els;

    var container = jQuery('<div class="track"></div>')[0];
    container.style.height = '100%';
    
    jQuery(this._container).append(container);

    var canvas = this._createCanvasObject();


    jQuery(this).unbind('svgready').bind('svgready',function(canv) {
        var canv = renderer._canvas;
        MASCP.CondensedSequenceRenderer._extendWithSVGApi(canv);
        canv.setAttribute('viewBox', '-1 0 '+(line_length+(this.padding))+' '+(100+(this.padding)));
        canv.setAttribute('background', '#000000');
        canv.setAttribute('preserveAspectRatio','xMinYMin meet');
        
        var defs = document.createElementNS(svgns,'defs');
        canv.appendChild(defs);
        var gradient = document.createElementNS(svgns,'linearGradient');
        gradient.setAttribute('id','track_shine');
        gradient.setAttribute('x1','0%');
        gradient.setAttribute('x2','0%');
        gradient.setAttribute('y1','0%');
        gradient.setAttribute('y2','100%');
        defs.appendChild(gradient);
        var stop1 = document.createElementNS(svgns,'stop');
        var stop2 = document.createElementNS(svgns,'stop');
        var stop3 = document.createElementNS(svgns,'stop');
        stop1.setAttribute('offset','0%');
        stop2.setAttribute('offset','50%');
        stop3.setAttribute('offset','100%');
        stop1.setAttribute('style','stop-color:#111111;stop-opacity:0.5');
        stop3.setAttribute('style','stop-color:#111111;stop-opacity:0.5');
        stop2.setAttribute('style','stop-color:#aaaaaa;stop-opacity:0.5');
        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        gradient.appendChild(stop3);
        
        renderer._drawAxis(canv,line_length);
        renderer._drawAminoAcids(canv);
        jQuery(renderer).trigger('sequenceChange');
    });
    
    if (this._canvas) {
       jQuery(this).trigger('svgready');
    } else {
        svgweb.appendChild(canvas,container);        
    }
};

/**
 * Create a Hydropathy plot, and add it to the renderer as a layer.
 * @param {Number}  windowSize  Size of the sliding window to use to calculate hydropathy values
 * @returns Hydropathy values for each of the residues
 * @type Array
 */
MASCP.CondensedSequenceRenderer.prototype.getHydropathyPlot = function(windowSize) {
    MASCP.SequenceRenderer.registerLayer('hydropathy',{ 'fullname' : 'Hydropathy plot','color' : '#990000' });
    var kd = { 'A': 1.8,'R':-4.5,'N':-3.5,'D':-3.5,'C': 2.5,
           'Q':-3.5,'E':-3.5,'G':-0.4,'H':-3.2,'I': 4.5,
           'L': 3.8,'K':-3.9,'M': 1.9,'F': 2.8,'P':-1.6,
           'S':-0.8,'T':-0.7,'W':-0.9,'Y':-1.3,'V': 4.2 };
    var plot_path = 'm'+(windowSize-1)+' 0 ';
    var last_value = null;
    var max_value = -100;
    var min_value = null;
    var scale_factor = 2.5;
    var values = [];
    for (var i = windowSize; i < (this._sequence_els.length - windowSize); i++ ) {
        var value = 0;
        for (var j = -1*windowSize; j <= windowSize; j++) {
            value += kd[this._sequence_els[i+j].amino_acid[0]] / (windowSize * 2 + 1);
        }        
        
        if (scale_factor*value > max_value) {
            max_value = scale_factor*value;
        }
        if (! min_value || scale_factor*value < min_value) {
            min_value = scale_factor*value;
        }
        values[i] = value;
        if ( ! last_value ) {
            plot_path += ' m1 '+(-1*scale_factor*value);
        } else {
            plot_path += ' l1 '+(-1 * scale_factor * (last_value + value));
        }
        last_value = value * -1;
    }
    
    var plot = this._canvas.path('M0 0 m0 '+max_value+' '+plot_path);
    plot.setAttribute('stroke','#ff0000');
    plot.setAttribute('stroke-width', '0.35');
    plot.setAttribute('fill', 'none');
    plot.setAttribute('display','none');
    var axis = this._canvas.path('M0 0 m0 '+-1*min_value+' l'+this._sequence_els.length+' 0');
    axis.setAttribute('stroke-width','0.2');
    axis.setAttribute('display','none');
    this._layer_containers['hydropathy'].push(plot);    
    this._layer_containers['hydropathy'].push(axis);
    this._layer_containers['hydropathy'].fixed_track_height = -1 * min_value + max_value;
    
    return values;
};

(function() {
var addElementToLayer = function(layerName) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,1,4);    
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);

    var shine = canvas.rect(-0.25+this._index,60,1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');

    var tracer = canvas.rect(this._index+0.25,10,0.1,0);
    tracer.style.strokeWidth = '0px';
    tracer.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
    tracer.setAttribute('display','none');
    
    if ( ! this._renderer._layer_containers[layerName].tracers) {
        this._renderer._layer_containers[layerName].tracers = canvas.set();
    }
    if ( ! canvas.tracers ) {
        canvas.tracers = canvas.set();
    }
    
    this._renderer._layer_containers[layerName].tracers.push(tracer);
    canvas.tracers.push(tracer);
};

var addBoxOverlayToElement = function(layerName,fraction,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.style.strokeWidth = '0px';
    rect.setAttribute('display', 'none');
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;

    var shine = canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');

};

var addElementToLayerWithLink = function(layerName,url,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';    
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);

    var shine = canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');

};

MASCP.CondensedSequenceRenderer.prototype._extendElement = function(el) {
    el.addToLayer = addElementToLayer;
    el.addBoxOverlay = addBoxOverlayToElement;
    el.addToLayerWithLink = addElementToLayerWithLink;
};
})();

/**
 * Add a layer to this renderer.
 * @param {Object} layer    Layer object to add. The layer data is used to create a track that can be independently shown/hidden.
 *                          The track itself is by default hidden.
 */
MASCP.CondensedSequenceRenderer.prototype.addTrack = function(layer) {
    if ( ! this._canvas ) {
        throw "No canvas, cannot add track";
        return;
    }
    if ( ! this._layer_containers ) {
        this._layer_containers = {};
        this._track_order = [];
    }
    
    if ( ! this._layer_containers[layer.name] ) {                
        this._layer_containers[layer.name] = this._canvas.set();
        this._track_order = this._track_order.concat([layer.name]);
        if ( ! this._layer_containers[layer.name].track_height) {
            this._layer_containers[layer.name].track_height = 4;
        }
        var self = this;
        var containers = this._layer_containers;
        jQuery(layer).bind('visibilityChange',function(e,renderer,visibility) {
            if (renderer != self) {
                return;
            }
            
            if (visibility) {
                containers[layer.name].attr({'display' : 'block'});
            } else {
                containers[layer.name].attr({'display' : 'none'});                
            }
            
            renderer.refresh();
            renderer._resizeContainer();
        });
        var event_names = ['mouseover','mousedown','mousemove','mouseout','click','mouseup'];
        for (var i = 0 ; i < event_names.length; i++) {
            jQuery(this._layer_containers[layer.name]._event_proxy).bind(event_names[i],function(ev) {
                jQuery(layer).trigger(ev.type);
            });
        }
    }
    this.hideLayer(layer);
};

MASCP.CondensedSequenceRenderer.prototype._resizeContainer = function() {
    if (this._container && this._canvas) {
        this._container.style.width = (this._zoomLevel || 1)*2*this.sequence.length+'px';
        this._container.style.height = (this._zoomLevel || 1)*2*(this._canvas._canvas_height)+'px';
    }
};

/**
 * Cause a refresh of the renderer, re-arranging the tracks on the canvas, and resizing the canvas if necessary.
 */
MASCP.CondensedSequenceRenderer.prototype.refresh = function() {
    var track_heights = 0;
    if ( ! this._track_order ) {
        return;
    }
    for (var i = 0; i < this._track_order.length; i++ ) {
        if (! this.isLayerActive(this._track_order[i])) {
            continue;
        }
        track_heights += (this.trackGap / this.zoom);
        this._layer_containers[this._track_order[i]].attr({ 'y' : (this._axis_height + track_heights), 'height' :  this._layer_containers[this._track_order[i]].track_height / this.zoom });
        if (this._layer_containers[this._track_order[i]].tracers) {
            var disp_style = (this.isLayerActive(this._track_order[i]) && (this.zoom > 3.6)) ? 'block' : 'none';
            this._layer_containers[this._track_order[i]].tracers.attr({'display' : disp_style ,'height' : this._axis_height + track_heights - this.trackGap });
        }
        if (this._layer_containers[this._track_order[i]].fixed_track_height) {
            track_heights += this._layer_containers[this._track_order[i]].fixed_track_height;
        }
    }
    var viewBox = [-1,0,0,0];
    viewBox[2] = this.sequence.split('').length+(this.padding);
    viewBox[3] = this._axis_height + track_heights + (this.padding);
    this._canvas.setAttribute('viewBox', viewBox.join(' '));
    this._canvas._canvas_height = viewBox[3];
};

/**
 *  @lends MASCP.CondensedSequenceRenderer.prototype
 *  @property   {Number}    zoom        The zoom level for a renderer. Minimum zoom level is zero, and defaults to 1
 *  @property   {Array}     trackOrder  The order of tracks on the renderer, an array of layer/group names.
 *  @property   {Number}    padding     Padding to apply to the right and top of plots (default 10).
 *  @property   {Number}    trackGap    Vertical gap between tracks (default 10)
 */
(function() {
var accessors = { 
    getTrackOrder: function() {
        return this._track_order;
    },

    setTrackOrder: function(order) {
        var track_order = [];
        for (var i = 0; i < order.length; i++) {
            if (this.getLayer(order[i])) {
                track_order.push(order[i]);
            } else if (this.getGroup(order[i])) {
                var group_layers = this.getGroup(order[i])._layers;
                for (var j = 0; j < group_layers.length; j++ ) {
                    track_order.push(group_layers[j].name);
                }
            }
        }
        this._track_order = track_order;
        this.refresh();
    },

    setZoom: function(zoomLevel) {
        if (zoomLevel < 0.5) {
            zoomLevel = 0.5;
        }
        if (zoomLevel > 10) {
            zoomLevel = 10;
        }

        this._zoomLevel = zoomLevel;
        if (this._canvas) {
            this._canvas.zoom = zoomLevel;
            jQuery(this._canvas).trigger('zoomChange');
        }
        jQuery(this).trigger('zoomChange');
    },

    getZoom: function() {
        return this._zoomLevel || 1;
    },

    getPadding: function() {
        return this._padding || 10;
    },

    setPadding: function(padding) {
        this._padding = padding;
        this.refresh();
    },

    getTrackGap: function() {
        return this._track_gap || 10;
    },

    setTrackGap: function(trackGap) {
        this._track_gap = trackGap;
        this.refresh();
    }
};

if (MASCP.CondensedSequenceRenderer.prototype.__defineSetter__) {    
    MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("zoom", accessors.setZoom);
    MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("zoom", accessors.getZoom);
    MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("trackOrder", accessors.setTrackOrder);
    MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("trackOrder", accessors.getTrackOrder);
    MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("padding", accessors.setPadding);
    MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("padding", accessors.getPadding);
    MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("trackGap", accessors.setTrackGap);
    MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("trackGap", accessors.getTrackGap);
}

})();


/* We can't use defineProperty in Internet Explorer since it doesn't support defineProperty on Objects
Object.defineProperty(MASCP.CondensedSequenceRenderer.prototype,"zoom",{
    get : MASCP.CondensedSequenceRenderer.getZoom,
    set : MASCP.CondensedSequenceRenderer.setZoom
});
*/

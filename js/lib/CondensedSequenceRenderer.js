MASCP.CondensedSequenceRenderer = function(sequenceContainer) {
    MASCP.SequenceRenderer.apply(this,arguments);
    var self = this;
    
    
    this.__class__ = MASCP.CondensedSequenceRenderer;
    
    // When we have a layer registered with the global MASCP object
    // add a track within this rendererer.
    jQuery(MASCP).bind('layerRegistered', function(e,layer) {
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
        self.resizeContainer();
        self.zoom = self.zoom;
    });
    return this;
};

MASCP.CondensedSequenceRenderer.prototype = new MASCP.SequenceRenderer();

MASCP.CondensedSequenceRenderer.prototype.resizeContainer = function() {
    if (this._container && this._canvas) {
        this._container.style.width = (this._zoomLevel || 1)*2*this.sequence.length+'px';
        this._container.style.height = (this._zoomLevel || 1)*2*(this._canvas._canvas_height)+'px';
    }    
};


MASCP.CondensedSequenceRenderer.prototype.showRowNumbers = function() {
    return this;
};

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
        }
        an_array.show = function() {
            this.attr({ 'display' : 'block'});
        }
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
    jQuery(canvas).bind('zoomchange', function() {
       if (renderer.zoom < 3.8 && renderer.zoom > 3.5 ) {
           renderer.zoom = 4;
           return;
       }
       if (renderer.zoom > 3.8 && renderer.zoom < 4 ) {
           renderer.zoom = 3.5;
           return;
       }
       if (canvas.zoom > 3.5) {
           renderer._axis_height = 6;
           amino_acids.attr({'display':'block'});
       } else {
           renderer._axis_height = 20;
           amino_acids.attr({'display':'none'});           
       }
       renderer.reflowTracks();
       renderer.resizeContainer();
   });
};

MASCP.CondensedSequenceRenderer._drawAxis = function(canvas,lineLength) {
    var x = 0;
    var axis = canvas.set();
//    axis.push(canvas.path('M0 10l'+lineLength+' 0'));
    axis.push(canvas.path('M0 10 l0 20'));
    axis.push(canvas.path('M'+(lineLength)+' 10 l0 20'));
    
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
    jQuery(canvas).bind('zoomchange', function() {
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
        el.addToLayer = MASCP.CondensedSequenceRenderer.addElementToLayer;
        el.addBoxOverlay = MASCP.CondensedSequenceRenderer.addBoxOverlayToElement;
        el.addToLayerWithLink = MASCP.CondensedSequenceRenderer.addElementToLayerWithLink;
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
        canv.setAttribute('viewBox', '0 0 '+(line_length+20)+' 100');
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
        
        // <defs>
        // <linearGradient id="track_shine" x1="0%" y1="0%" x2="0%" y2="100%">
        // <stop offset="0%" style=""/>
        // <stop offset="50%" style="stop-color:#aaaaaa;stop-opacity:1"/>
        // <stop offset="100%" style="stop-color:#111111;stop-opacity:1"/>
        // </linearGradient>
        // </defs>
        
        
        
        renderer._axis_height = 20;
        MASCP.CondensedSequenceRenderer._drawAxis(canv,line_length);
        renderer._drawAminoAcids(canv);
        jQuery(renderer).trigger('sequenceChange');
    });
    
    if (this._canvas) {
       jQuery(this).trigger('svgready');
    } else {
        svgweb.appendChild(canvas,container);        
    }
};

MASCP.CondensedSequenceRenderer.prototype.getHydropathyPlot = function(window_size) {
    MASCP.SequenceRenderer.registerLayer('hydropathy',{ 'fullname' : 'Hydropathy plot','color' : '#990000' });
    var kd = { 'A': 1.8,'R':-4.5,'N':-3.5,'D':-3.5,'C': 2.5,
           'Q':-3.5,'E':-3.5,'G':-0.4,'H':-3.2,'I': 4.5,
           'L': 3.8,'K':-3.9,'M': 1.9,'F': 2.8,'P':-1.6,
           'S':-0.8,'T':-0.7,'W':-0.9,'Y':-1.3,'V': 4.2 };
//    var window_size = 5;
    var plot_path = 'm'+(window_size-1)+' 0 ';
    var last_value = null;
    var max_value = -100;
    var min_value = null;
    var scale_factor = 2.5;
    
    for (var i = window_size; i < (this._sequence_els.length - window_size); i++ ) {
        var value = 0;
        for (var j = -1*window_size; j <= window_size; j++) {
            value += kd[this._sequence_els[i+j].amino_acid[0]] / (window_size * 2 + 1);
        }        
        
        if (scale_factor*value > max_value) {
            max_value = scale_factor*value;
        }
        if (! min_value || scale_factor*value < min_value) {
            min_value = scale_factor*value;
        }
//        this._sequence_els[i].hydropathy = value;
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
    log(plot.getAttribute('d'));
    log(axis.getAttribute('d'));
    this._layer_containers['hydropathy'].push(plot);    
    this._layer_containers['hydropathy'].push(axis);
    this._layer_containers['hydropathy'].track_height = -1 * min_value + max_value;
};


MASCP.CondensedSequenceRenderer.addElementToLayer = function(layerName) {
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

MASCP.CondensedSequenceRenderer.addBoxOverlayToElement = function(layerName,fraction,width) {
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

MASCP.CondensedSequenceRenderer.addElementToLayerWithLink = function(layerName,url,width) {
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
        this._track_order.push(layer.name);
        var self = this;
        jQuery(layer).bind('visibilityChange',function(e,renderer,visibility) {
            if (renderer != self) {
                return;
            }
            renderer.reflowTracks();
            renderer.resizeContainer();
        });
    }
    this.hideLayer(layer);
};

MASCP.CondensedSequenceRenderer.prototype.reflowTracks = function() {
    var track_heights = 10.0;
    if ( ! this._track_order ) {
        return;
    }
    for (var i = 0; i < this._track_order.length; i++ ) {
        if (this.isLayerActive(this._track_order[i])) {
            track_heights += (10.0 / this.zoom);
        }
        this._layer_containers[this._track_order[i]].attr({ 'y' : (this._axis_height + track_heights), 'height' : 4 / this.zoom });
        if (this._layer_containers[this._track_order[i]].tracers) {
            var disp_style = (this.isLayerActive(this._track_order[i]) && (this.zoom > 3.6)) ? 'block' : 'none';
            this._layer_containers[this._track_order[i]].tracers.attr({'display' : disp_style ,'height' : this._axis_height + track_heights - 10 });
        }
        if (this._layer_containers[this._track_order[i]].track_height) {
            track_heights += this._layer_containers[this._track_order[i]].track_height;
        }
    }
    var currViewBox = this._canvas.getAttribute('viewBox') ? this._canvas.getAttribute('viewBox').split(/\s/) : [0,0,(this.sequence.split('').length+20),0];
    this._canvas.setAttribute('viewBox', '0 0 '+currViewBox[2]+' '+(this._axis_height + track_heights+10));
    this._canvas._canvas_height = (this._axis_height + track_heights+10);
};

MASCP.CondensedSequenceRenderer.prototype.trackOrder = function() {
    return this._track_order;
};

MASCP.CondensedSequenceRenderer.prototype.setTrackOrder = function(order) {
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
}

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.CondensedSequenceRenderer.prototype.showLayer = function(lay,consumeChange) {
    log("In here for show layer %o",lay);
    var layerName = lay;
    var layer;
    if (typeof lay != 'string') {
        layerName = lay.name;
        layer = lay;
    } else {
        layer = MASCP.SequenceRenderer._layers[lay];
        layerName = lay;
    }
    log("I am here!! %o",layer);
    if (layer.disabled) {
        return;
    }
    log("Showing layer "+layerName);
    this._layer_containers[layerName].attr({ 'display' : 'block' });    

    jQuery(this._container).addClass(layerName+'_active');
    jQuery(this._container).addClass('active_layer');    
    jQuery(this._container).removeClass(layerName+'_inactive');
    if ( ! consumeChange ) {
        jQuery(layer).trigger('visibilityChange',[this,true]);
    }
    return this;
};

/**
 * Hide the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.CondensedSequenceRenderer.prototype.hideLayer = function(lay,consumeChange) {
    var layerName = lay;
    var layer;
    if (typeof lay != 'string') {
        layerName = lay.name;
        layer = lay;
    } else {
        layer = MASCP.SequenceRenderer._layers[lay];
        layerName = lay;
    }

    if (layer.disabled) {
        return;
    }
        
    jQuery(this._container).removeClass(layerName+'_active');
    jQuery(this._container).removeClass('active_layer');
    jQuery(this._container).addClass(layerName+'_inactive');
    this._layer_containers[layerName].attr({ 'display' : 'none' });    
    if (! consumeChange ) {
        jQuery(layer).trigger('visibilityChange',[this,false]);
    }
    return this;
};

MASCP.CondensedSequenceRenderer.setZoom = function(zoomLevel) {
   this._zoomLevel = zoomLevel;
   this.resizeContainer();
   if (this._canvas) {
       this._canvas.zoom = zoomLevel;
       jQuery(this._canvas).trigger('zoomchange');
   }
   jQuery(this).trigger('zoomchange');
};

MASCP.CondensedSequenceRenderer.getZoom = function() {
    return this._zoomLevel;
};

if (MASCP.CondensedSequenceRenderer.prototype.__defineSetter__) {    
MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("zoom", MASCP.CondensedSequenceRenderer.setZoom);
MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("zoom", MASCP.CondensedSequenceRenderer.getZoom);
} else {
    // Object.defineProperty(MASCP.CondensedSequenceRenderer.prototype,"zoom",{
    //     get : MASCP.CondensedSequenceRenderer.getZoom,
    //     set : MASCP.CondensedSequenceRenderer.setZoom
    // });
}
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
        this._container.style.height = (this._zoomLevel || 1)*2*(this._canvas._canv_height)+'px';
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
        renderer._canvas = this.contentDocument.rootElement;
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


MASCP.CondensedSequenceRenderer.addElementToLayer = function(layerName) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,1,4);    
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);

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
};

MASCP.CondensedSequenceRenderer.addElementToLayerWithLink = function(layerName,url,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';    
    rect.style.fill = MASCP.SequenceRenderer._layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);
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
    var track_heights = this._axis_height;
    if ( ! this._track_order ) {
        return;
    }
    for (var i = 0; i < this._track_order.length; i++ ) {
        if (this.isLayerActive(this._track_order[i])) {
            track_heights += 10;
        }
        this._layer_containers[this._track_order[i]].attr({ 'y' : track_heights });
        if (this._layer_containers[this._track_order[i]].tracers) {
            var disp_style = (this.isLayerActive(this._track_order[i]) && (this.zoom > 3.6)) ? 'block' : 'none';
            this._layer_containers[this._track_order[i]].tracers.attr({'display' : disp_style ,'height' : track_heights - 10 });
        }
    }
    var currViewBox = this._canvas.getAttribute('viewBox') ? this._canvas.getAttribute('viewBox').split(/\s/) : [0,0,(this.sequence.split('').length+20),0];
    this._canvas.setAttribute('viewBox', '0 0 '+currViewBox[2]+' '+(track_heights+10));
    this._canvas._canv_height = (track_heights+10);
};

MASCP.CondensedSequenceRenderer.prototype.trackOrder = function() {
    return this._track_order;
};

/**
 * Show the given layer
 * @param {String|Object} layer Layer name, or layer object
 */
MASCP.CondensedSequenceRenderer.prototype.showLayer = function(lay,consumeChange) {
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
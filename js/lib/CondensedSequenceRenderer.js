/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
 */

/*
 *  Include the svgweb library when we include this script. Set the SVGWEB_PATH environment variable if
 *  you wish to retrieve svgweb from a relative path other than ./svgweb/src
 */
if (document.write && (typeof svgweb == 'undefined') && (typeof SVGWEB_LOADING == 'undefined')) {

    // var svg_path = 'svgweb/';
    // if (typeof SVGWEB_PATH != 'undefined') {
    //     svg_path = SVGWEB_PATH;
    // }
    // var scriptTag = document.createElement("script");
    // scriptTag.src = svg_path + 'svg.js';
    // scriptTag.type="text/javascript";
    // scriptTag.setAttribute('data-path',svg_path);
    // document.getElementsByTagName("head")[0].insertBefore(scriptTag, document.getElementsByTagName("head")[0].firstChild);

    if (typeof SVGWEB_PATH != 'undefined') {
        document.write('<script src="'+SVGWEB_PATH+'svg.js" data-path="'+SVGWEB_PATH+'"></script>');        
    } else {
        document.write('<script src="svgweb/svg.js" data-path="svgweb/"></script>');
    }
    
    SVGWEB_LOADING = true;
}


/** Default class constructor
 *  @class      Renders a sequence using a condensed track-based display
 *  @param      {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *              the container that data will be re-inserted into.
 *  @extends    MASCP.SequenceRenderer
 */
MASCP.CondensedSequenceRenderer = function(sequenceContainer) {
    this._RS = 50;
    MASCP.SequenceRenderer.apply(this,arguments);
    var self = this;
    
    
    this.__class__ = MASCP.CondensedSequenceRenderer;
    
    // Render Scale


    // When we have a layer registered with the global MASCP object
    // add a track within this rendererer.
    jQuery(MASCP).bind('layerRegistered', function(e,layer) {
        self.addTrack(layer);
    });
    
    // We want to unbind the default handler for sequence change that we get from
    // inheriting from CondensedSequenceRenderer
    jQuery(this).unbind('sequenceChange');
    jQuery(this).bind('sequenceChange',function() {
        for (var layername in MASCP.layers) {
            self.addTrack(MASCP.layers[layername]);
            MASCP.layers[layername].disabled = true;
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
        var container_canv = (this.contentDocument || this.getAttribute('contentDocument')).rootElement;
        renderer._nav_canvas = document.createElementNS(svgns,'svg');
        var group = document.createElementNS(svgns,'g');        
        renderer._canvas = document.createElementNS(svgns,'svg');
        var canvas_rect = document.createElementNS(svgns,'rect');
        canvas_rect.setAttribute('x','-10%');
        canvas_rect.setAttribute('y','-10%');
        canvas_rect.setAttribute('width','120%');
        canvas_rect.setAttribute('height','120%');
        canvas_rect.setAttribute('style','fill: #ffffff;');
        renderer._canvas.appendChild(canvas_rect);
        
        container_canv.appendChild(group);        
        group.appendChild(renderer._canvas);
        
        container_canv.appendChild(renderer._nav_canvas);
        renderer._canvas.currentTranslate.__proto__.setXY = function(x,y) {
                group.setAttribute('transform','translate('+x+' '+y+')');            
                this.x = x;
                this.y = y;
        };

        renderer._addNav();
        
        renderer._container_canvas = container_canv;
        renderer._canvas._canvas_height = 0;
        renderer._object = this;
        jQuery(renderer).trigger('svgready');
    },false);
    
    return canvas;
};

MASCP.CondensedSequenceRenderer.prototype._addNav = function() {
    this._extendWithSVGApi(this._nav_canvas);
    var rect = this._nav_canvas.rect(0,0,1,1);
    rect.setAttribute('width','25%');
    rect.setAttribute('height','100%');
    rect.setAttribute('x','-10');
    rect.setAttribute('rx','10');
    rect.setAttribute('ry','10');    
    rect.setAttribute('opacity','0.8');
    rect.style.fill = '#000000';
    var button_canvas = document.createElementNS(svgns,'svg');
    this._nav_canvas.appendChild(button_canvas);
    this._nav_canvas._buttons = button_canvas;
    this._extendWithSVGApi(this._nav_canvas._buttons);
    
};

MASCP.CondensedSequenceRenderer.prototype._extendWithSVGApi = function(canvas) {
    // We're going to use a render scale
    
    var RS = this._RS;
    
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
      a_rect.setAttribute('x', x * RS);
      a_rect.setAttribute('y', y * RS);
      a_rect.setAttribute('width', width * RS);
      a_rect.setAttribute('height', height * RS);
      a_rect.setAttribute('stroke','#000000');
      this.appendChild(a_rect);
      return a_rect;
    };

    canvas.set = function() {
        var an_array = new Array();
        an_array.attr = function(hsh,animated) {
            
            var hash = jQuery.extend({},hsh);
            
            if (animated && typeof hash['y'] != 'undefined') {
                var counter = 0;
                if (an_array.length == 0) {
                    return;
                }
                var curr_y = an_array[0] ? parseInt(an_array[0].getAttribute('y')) : 0;
                var curr_disp = an_array[0].getAttribute('display') || 'none';
                var target_y = parseInt(hash['y']);
                var target_disp = hash['display'];
                if (curr_disp == target_disp && target_disp == 'none') {
                    an_array.attr(hsh);
                    return;
                }

                delete hash['y'];                

                if (curr_disp == target_disp && target_disp == 'block' ) {
                    delete hash['display'];
                    target_disp = null;                    
                    an_array.attr({'display' : 'block'});
                }

                if (hash['display'] == 'none') {
                    delete hash['display'];
                    hash['opacity'] = 0.9;
                }

                if (hash['display'] == 'block') {
                    hash['opacity'] = 0;
                }

                an_array.attr(hash);                
                if (target_y != curr_y) {
                    var diff = (target_y - curr_y) / 10;
                    hash['y'] = curr_y || 0;
                    var orig_func = arguments.callee;
                    jQuery(an_array).trigger('_anim_begin');
                    window.setTimeout(function() {
                        orig_func.apply(an_array,[hash]);
                        counter += 1;
                        if (target_disp == 'none') {
                            hash['opacity'] -= 0.1;
                        }
                        if (target_disp == 'block') {
                            hash['opacity'] += 0.1;
                        }
                        if (counter <= 10) {
                            hash['y'] += diff;
                            window.setTimeout(arguments.callee,10);
                        } else if (target_disp) {
                            an_array.attr({'display' : target_disp});
                            jQuery(an_array).trigger('_anim_end');
                        }
                    },10);
                }
                return;
            }
            for (var key in hash) {
                for (var i = 0; i < an_array.length; i++) {
                    var value = hash[key];
                    if (key == 'style' && an_array[i].hasAttribute('style')) {
                        var curr_style = an_array[i].getAttribute('style');
                        curr_style += '; '+hash[key];
                        value = curr_style;
                    }
                    an_array[i].setAttribute(key, value);
                    if (key == 'y' && an_array[i].hasAttribute('d')) {
                        var curr_path = an_array[i].getAttribute('d');
                        var re = /M([\d\.]+) ([\d\.]+)/;
                        curr_path = curr_path.replace(re,'');
                        an_array[i].setAttribute('d', 'M0 '+parseInt(value)+' '+curr_path);
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
        
        var click_func = function(ev) {
            var target_el = this;
            
            if (target_el._consume_click) {
                target_el._consume_click = false;
                return;
            }
            
            if (target_el._first_click) {
                window.clearTimeout(target_el._first_click);
                target_el._first_click = null;
                jQuery(an_array._event_proxy).trigger('dblclick',[ev]);
                return;
            }
            
            target_el._first_click = window.setTimeout(function() {
                target_el._first_click = null;
                jQuery(an_array._event_proxy).trigger('click',[ev]);
            },250);
            
            return;            
        };
        
        var event_func = function(ev) {
            var target_el = this;
            
            if ((ev.type != 'mousemove' && ev.type != 'touchmove') && target_el._longclick) {
                window.clearTimeout(target_el._longclick);
                target_el._longclick = null;
            }

            if (ev.type == 'mousedown' || (ev.type == 'touchstart' && ev.touches.length == 1)) {
                target_el._longclick = window.setTimeout(function() {
                    target_el._longclick = null;
                    jQuery(an_array._event_proxy).trigger('longclick',[ev]);
                    target_el._consume_click = true;
                },500);
            }

            jQuery(an_array._event_proxy).trigger(ev.type,[ev]);
        };
        
        an_array.push = function(new_el) {
            this._old_push(new_el);
            if ( ! new_el || typeof new_el == 'undefined' ) {
                return;
            }
            if (new_el._has_proxy) {
                return;
            }
            var event_names = ['mouseover','mousedown','mousemove','mouseout','mouseup','mouseenter','mouseleave'];
            for (var i = 0 ; i < event_names.length; i++) {
                jQuery(new_el).bind(event_names[i], event_func);
            }
            jQuery(new_el).bind('click',click_func,false);
            if (new_el.addEventListener) {
                new_el.addEventListener('touchstart',event_func,false);
                new_el.addEventListener('touchmove',event_func,false);
                new_el.addEventListener('touchend',event_func,false);
            }
            new_el._has_proxy = true;
        };
        return an_array;
    };
    
    canvas.text = function(x,y,text) {
        var a_text = document.createElementNS(svgns,'text');
        a_text.textContent = text;
        a_text.style.fontFamily = 'Helvetica, Verdana, Arial, Sans-serif';
        a_text.setAttribute('x',x * RS);
        a_text.setAttribute('y',y * RS);        
        this.appendChild(a_text);
        return a_text;
    };    
};

MASCP.CondensedSequenceRenderer.prototype._drawAminoAcids = function(canvas) {
    var RS = this._RS;
    var seq_chars = this.sequence.split('');
    var renderer = this;
    var amino_acids = canvas.set();
    var x = 0;
    
    for (var i = 0; i < seq_chars.length; i++) {
        amino_acids.push(canvas.text(x,12,seq_chars[i]));
        x += 1;
    }
    amino_acids.attr( { 'display':'none','width': RS,'text-anchor':'start','dominant-baseline':'hanging','height': RS,'font-size':RS,'fill':'#000000', 'font-family':'monospace'});

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
   });
};

MASCP.CondensedSequenceRenderer.prototype._drawAxis = function(canvas,lineLength) {
    var RS = this._RS;
    var x = 0;
    var axis = canvas.set();
    axis.push(canvas.path('M0 '+10*RS+' l0 '+20*RS));
    axis.push(canvas.path('M'+(lineLength*RS)+' '+10*RS+' l0 '+20*RS));

    this._axis_height = 30;

    var big_ticks = canvas.set();
    var little_ticks = canvas.set();
    var big_labels = canvas.set();
    var little_labels = canvas.set();
    for (var i = 0; i < (lineLength/5); i++ ) {

        if ( (x % 10) == 0) {
            big_ticks.push(canvas.path('M'+x*RS+' '+14*RS+' l 0 '+12*RS));
        } else {
            little_ticks.push(canvas.path('M'+x*RS+' '+16*RS+' l 0 '+8*RS));
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
        big_labels[i].setAttribute('font-size',7*RS+'pt');
    }

    for ( var i = 0; i < little_labels.length; i++ ) {
        little_labels[i].style.textAnchor = 'middle';
        little_labels[i].setAttribute('dominant-baseline','hanging');
        little_labels[i].setAttribute('font-size',2*RS+'pt');        
        little_labels[i].style.fill = '#000000';
    }
    
    little_ticks.attr({ 'stroke':'#555555', 'stroke-width':0.5*RS+'pt'});
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
               little_labels.attr({'font-size':2*RS+'pt'});
               big_labels.attr({'font-size': 2*RS+'pt'});
               axis.hide();
               if (this._visibleTracers && this._visibleTracers()) {
                   this._visibleTracers().show();
               }
           } else if (this.zoom > 1.8) {
               axis.show();
               big_ticks.show();
               axis.attr({'stroke-width':0.5*RS+'pt'});
               big_ticks.attr({'stroke-width':0.5*RS+'pt'});
               big_labels.show();
               big_labels.attr({'font-size':4*RS+'pt','y':7*RS});
               little_labels.attr({'font-size':4*RS+'pt'});
               little_ticks.attr({'stroke-width':0.3*RS+'pt'});
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
               axis.attr({'stroke-width':RS+'pt'});
               big_ticks.show();
               big_ticks.attr({'stroke-width':RS+'pt'});
               big_labels.show();
               big_labels.attr({'font-size':7*RS+'pt','y':5*RS});
               little_ticks.hide();
               little_labels.hide();
           }
    });
};

MASCP.CondensedSequenceRenderer.prototype.setSequence = function(sequence) {
    var new_sequence = this._cleanSequence(sequence);
    if (new_sequence == this.sequence && new_sequence != null) {
        jQuery(this).trigger('sequenceChange');
        return;
    }
    
    this.sequence = new_sequence;
    
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

    var RS = this._RS;

    jQuery(this).unbind('svgready').bind('svgready',function(canv) {
        var canv = renderer._canvas;
        renderer._extendWithSVGApi(canv);
//        canv.setAttribute('viewBox', ''+(-2*RS)+' 0 '+(line_length+(this.padding)+2)*RS+' '+(100+(this.padding))*RS);
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
        
        var makeEl = function(name,attributes) {
            var result = document.createElementNS(svgns,name);
            for (var attribute in attributes) {
                result.setAttribute(attribute, attributes[attribute]);
            }
            return result;
        };

        var glow = makeEl('filter',{
            'id':'track_glow',
            'filterUnits':'objectBoundingBox',
            'x':'-2%',
            'y':'-2%',
            'width':'105%',
            'height':'105%'
        });
        glow.appendChild(makeEl('feFlood',{'result':'flooded','style':'flood-color:rgb(255,0,0);'}));        
        defs.appendChild(glow);

        // 
        // 'filterUnits':'objectBoundingBox',
        // 'x':'-2%',
        // 'y':'-2%',
        // 'width':'120%',
        // 'height':'120%'

        var shadow = makeEl('filter',{
            'id':'drop_shadow',
            'filterUnits':'objectBoundingBox',
            'x': '-100%',
            'y': '-100%',
            'width': '300%',
            'height': '300%'
        });
        shadow.appendChild(makeEl('feGaussianBlur',{'in':'SourceAlpha', 'stdDeviation':'50','result':'blur_out'}));        
        shadow.appendChild(makeEl('feOffset',{'in':'blur_out', 'result':'the_shadow', 'dx':'50','dy':'50'}));
        shadow.appendChild(makeEl('feBlend',{'in':'SourceGraphic', 'in2':'the_shadow', 'mode':'normal'}));
        
        defs.appendChild(shadow);


        
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
MASCP.CondensedSequenceRenderer.prototype.createHydropathyLayer = function(windowSize) {
    var RS = this._RS;
    MASCP.registerLayer('hydropathy',{ 'fullname' : 'Hydropathy plot','color' : '#990000' });
    var kd = { 'A': 1.8,'R':-4.5,'N':-3.5,'D':-3.5,'C': 2.5,
           'Q':-3.5,'E':-3.5,'G':-0.4,'H':-3.2,'I': 4.5,
           'L': 3.8,'K':-3.9,'M': 1.9,'F': 2.8,'P':-1.6,
           'S':-0.8,'T':-0.7,'W':-0.9,'Y':-1.3,'V': 4.2 };
    var plot_path = 'm'+RS*(windowSize-1)+' 0 ';
    var last_value = null;
    var max_value = -100;
    var min_value = null;
    var scale_factor = 2.5 * RS;
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
            plot_path += ' m'+RS+' '+(-1*scale_factor*value);
        } else {
            plot_path += ' l'+RS+' '+(-1 * scale_factor * (last_value + value));
        }
        last_value = value * -1;
    }
    
    var plot = this._canvas.path('M0 0 m0 '+max_value+' '+plot_path);
    plot.setAttribute('stroke','#ff0000');
    plot.setAttribute('stroke-width', 0.35*RS);
    plot.setAttribute('fill', 'none');
    plot.setAttribute('display','none');
    var axis = this._canvas.path('M0 0 m0 '+(-1*min_value)+' l'+this._sequence_els.length*RS+' 0');
    axis.setAttribute('stroke-width',0.2*RS);
    axis.setAttribute('display','none');
    this._layer_containers['hydropathy'].push(plot);    
    this._layer_containers['hydropathy'].push(axis);
    this._layer_containers['hydropathy'].fixed_track_height = (-1*min_value+max_value) / RS;
    return values;
};

(function() {
var addElementToLayer = function(layerName) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,1,4);    
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';
    rect.style.fill = MASCP.layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);

    var shine = canvas.rect(-0.25+this._index,60,1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');
    shine._is_shine = true;

    var tracer = canvas.rect(this._index+0.25,10,0.1,0);
    tracer.style.strokeWidth = '0px';
    tracer.style.fill = MASCP.layers[layerName].color;
    tracer.setAttribute('display','none');
    
    var renderer = this._renderer;
    
    if ( ! this._renderer._layer_containers[layerName].tracers) {
        this._renderer._layer_containers[layerName].tracers = canvas.set();
    }
    if ( ! canvas.tracers ) {
        canvas.tracers = canvas.set();
        canvas._visibleTracers = function() {
            return renderer._visibleTracers();
        }
    }
    
    this._renderer._layer_containers[layerName].tracers.push(tracer);
    canvas.tracers.push(tracer);
    return rect;
};

var addBoxOverlayToElement = function(layerName,fraction,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.style.strokeWidth = '0px';
    rect.setAttribute('display', 'none');
    rect.style.fill = MASCP.layers[layerName].color;

//    rect.setAttribute('filter','url(#drop_shadow)');

    var shine = canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');
    shine._is_shine = true;
    return rect;
};

var addElementToLayerWithLink = function(layerName,url,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';    
    rect.style.fill = MASCP.layers[layerName].color;
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);

    var shine = canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');
    shine._is_shine = true;

    return rect;
};

MASCP.CondensedSequenceRenderer.prototype._extendElement = function(el) {
    el.addToLayer = addElementToLayer;
    el.addBoxOverlay = addBoxOverlayToElement;
    el.addToLayerWithLink = addElementToLayerWithLink;
};
})();

/**
 * Mouseover event for a layer
 * @name    MASCP.Layer#mouseover
 * @event
 * @param   {Object}    e
 */
 
/**
 * Mouseout event for a layer
 * @name    MASCP.Layer#mouseout
 * @event
 * @param   {Object}    e
 */
  
/**
 * Mousemove event for a layer
 * @name    MASCP.Layer#mousemove
 * @event
 * @param   {Object}    e
 */

/**
 * Mousedown event for a layer
 * @name    MASCP.Layer#mousedown
 * @event
 * @param   {Object}    e
 */
 
/**
 * Mouseup event for a layer
 * @name    MASCP.Layer#mouseup
 * @event
 * @param   {Object}    e
 */

/**
 * Click event for a layer
 * @name    MASCP.Layer#click
 * @event
 * @param   {Object}    e
 */

 /**
  * Long click event for a layer
  * @name    MASCP.Layer#longclick
  * @event
  * @param   {Object}    e
  */


/**
 * Add a layer to this renderer.
 * @param {Object} layer    Layer object to add. The layer data is used to create a track that can be independently shown/hidden.
 *                          The track itself is by default hidden.
 */
MASCP.CondensedSequenceRenderer.prototype.addTrack = function(layer) {
    var RS = this._RS;
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
            
            if (! visibility) {
                if (containers[layer.name].tracers) {
                    containers[layer.name].tracers.hide();
                }
            }
            renderer.refresh();
        });
        var event_names = ['mouseover','mousedown','mousemove','mouseout','click','dblclick','longclick','mouseup','mouseenter','mouseleave'];
        for (var i = 0 ; i < event_names.length; i++) {
            jQuery(this._layer_containers[layer.name]._event_proxy).bind(event_names[i],function(ev,original_event) {
                jQuery(layer).trigger(ev.type,[original_event]);
            });
        }
    }
    this.refresh();
};
/**
 * Describe what this method does
 * @private
 * @param {String|Object|Array|Boolean|Number} paramName Describe this parameter
 * @returns Describe what it returns
 * @type String|Object|Array|Boolean|Number
 */
MASCP.CondensedSequenceRenderer.prototype.applyStyle = function(layer,style) {
    if ( ! this._layer_containers ) {
        return;
    }
    if (typeof layer != 'string') {
        layer = layer.name;
    }
    if ( this._layer_containers[layer] ) {
        var layer_container = this._layer_containers[layer];
        layer_container.attr({'style' : style});
    }
};

MASCP.CondensedSequenceRenderer.prototype.setHighlight = function(layer,doHighlight) {
    var self = this;
    if ( ! this._layer_containers ) {
        return;
    }
    var layerObj = layer;
    if (typeof layer != 'string') {
        layer = layer.name;        
    } else {
        layerObj = MASCP.getLayer(layer);
    }

    if ( ! this._layer_containers[layer] ) {
        return;
    }

    var layer_container = this._layer_containers[layer];

    if ( ! layerObj._highlight_event_bound ) {
        jQuery(layer_container).bind('_anim_begin',function() {
            if (layerObj._highlight_filter) {
                return;
            }
            layerObj._highlight_filter = [];
            for (var i = 0; i < layer_container.length; i++ ) {
                layerObj._highlight_filter[i] = layer_container[i].getAttribute('filter')+"";
                layer_container[i].removeAttribute('filter');
            }
        });
        //        jQuery(layer_container).unbind('_anim_begin',arguments.callee);

        jQuery(layer_container).bind('_anim_end',function() {
            if ( ! layerObj._highlight_filter ) {
                return;
            }
            for (var i = 0; i < layer_container.length; i++ ) {
                if (layerObj._highlight_filter[i] && layer_container[i].getAttribute('filter') == null) {
                    layer_container[i].setAttribute('filter',layerObj._highlight_filter[i]);
                }
            }
            layerObj._highlight_filter = null;        
        });
        //        jQuery(layer_container).unbind('_anim_end',arguments.callee);        

        layerObj._highlight_event_bound = true;
    }
    var redraw_id = this._canvas.suspendRedraw(5000);


    if (doHighlight) {
        for (var i = 0 ; i < layer_container.length; i++ ) {
            if (layer_container[i]._is_shine) {
                continue;
            }
            layer_container[i].setAttribute('filter','url(#track_glow)');
        }
    } else {
        for (var i = 0 ; i < layer_container.length; i++ ) {
            if (layer_container[i]._is_shine) {
                continue;
            }
            layer_container[i].setAttribute('filter','');
        }
    }
    
    this._canvas.unsuspendRedraw(redraw_id);
    
}


/*
 * Get a canvas set of the visible tracers on this renderer
 */
MASCP.CondensedSequenceRenderer.prototype._visibleTracers = function() {
    var tracers = null;
    for (var i in MASCP.layers) {
        if (this.isLayerActive(i) && this._layer_containers[i].tracers) {
            if ( ! tracers ) {
                tracers = this._layer_containers[i].tracers;
            } else {
                tracers.concat(this._layer_containers[i].tracers);
            }
        }
    }
    return tracers;
};

MASCP.CondensedSequenceRenderer.prototype._resizeContainer = function() {
    var RS = this._RS;
    if (this._container && this._canvas) {
        this._canvas.style.width = (this._zoomLevel || 1)*2*this.sequence.length+'px';
        this._canvas.style.height = (this._zoomLevel || 1)*2*(this._canvas._canvas_height/this._RS)+'px';            

        this._nav_canvas.style.width = '100px';
        this._nav_canvas.style.height = (this._zoomLevel || 1)*2*(this._canvas._canvas_height/this._RS);

        this._container.style.width = (this._zoomLevel || 1)*2*this.sequence.length+'px';
        this._container.style.height = (this._zoomLevel || 1)*2*(this._canvas._canvas_height/this._RS)+'px';        
    }
};

/**
 * Create a layer based controller for a group. Clicking on the nominated layer will animate out the expansion of the
 * group.
 * @param {Object} lay Layer to turn into a group controller
 * @param {Object} grp Group to be controlled by this layer.
 */

MASCP.CondensedSequenceRenderer.prototype.createGroupController = function(lay,grp) {
    var layer = MASCP.getLayer(lay);
    var group = MASCP.getGroup(grp);
    if (layer._group_controller) {
        return;
    }
    
    layer._group_controller = true;
    
    var expanded = false;
    var sticky = false;
    
    var self = this;
    
    jQuery(layer).bind('visibilityChange',function(ev,rend,visible) {
        if (rend == self) {
            self.setGroupVisibility(group, expanded && visible);
            self.refresh();
        }
    });
    jQuery(layer).bind('longclick',function(ev) {
        expanded = ! expanded;
        self.withoutRefresh(function() {
            self.setGroupVisibility(group,expanded);            
        });
        self.refresh(true);
    });
};

/**
 * Cause a refresh of the renderer, re-arranging the tracks on the canvas, and resizing the canvas if necessary.
 * @param {Boolean} animateds Cause this refresh to be an animated refresh
 */
MASCP.CondensedSequenceRenderer.prototype.refresh = function(animated) {
    if ( ! this._canvas ) {
        return;
    }
    var RS = this._RS;
    var track_heights = 0;
    if ( ! this._track_order ) {
        return;
    }
    while (this._nav_canvas._buttons.firstChild) 
     {
        //The list is LIVE so it will re-index each call
        this._nav_canvas._buttons.removeChild(this._nav_canvas._buttons.firstChild);
     };
    
    for (var i = 0; i < this._track_order.length; i++ ) {
        if (! this.isLayerActive(this._track_order[i])) {
            this._layer_containers[this._track_order[i]].attr({ 'y' : (this._axis_height  + (track_heights - this._layer_containers[this._track_order[i]].track_height )/ this.zoom)*RS, 'height' :  RS * this._layer_containers[this._track_order[i]].track_height / this.zoom ,'display' : 'none' },animated);
            continue;
        } else {
            this._layer_containers[this._track_order[i]].attr({ 'opacity' : '1' });            
        }

        if (this._layer_containers[this._track_order[i]].tracers) {
            var disp_style = (this.isLayerActive(this._track_order[i]) && (this.zoom > 3.6)) ? 'block' : 'none';
            this._layer_containers[this._track_order[i]].tracers.attr({'display' : disp_style , 'y' : 10*RS,'height' : (-10 + this._axis_height + track_heights / this.zoom )*RS },animated);
        }

        if (this._layer_containers[this._track_order[i]].fixed_track_height) {
            var track_height = this._layer_containers[this._track_order[i]].fixed_track_height;
            this._layer_containers[this._track_order[i]].attr({ 'display' : 'block','y' : (this._axis_height + track_heights / this.zoom)*RS },animated);
            track_heights += this.zoom * (track_height) + this.trackGap;
        } else {
            this._layer_containers[this._track_order[i]].attr({ 'display': 'block', 'y' : (this._axis_height + track_heights / this.zoom )*RS, 'height' :  RS * this._layer_containers[this._track_order[i]].track_height / this.zoom },animated);
            var a_text = this._nav_canvas._buttons.text(0,(this._axis_height + (this._layer_containers[this._track_order[i]].track_height + track_heights) / this.zoom ),MASCP.getLayer(this._track_order[i]).fullname);

            a_text.setAttribute('x', 50);
            a_text.setAttribute('height', 2*(this._layer_containers[this._track_order[i]].track_height / this.zoom) *RS);
            a_text.setAttribute('font-size',2*(this._layer_containers[this._track_order[i]].track_height / this.zoom) *RS);
            a_text.setAttribute('width','200');
            a_text.setAttribute('fill','#ffffff');
            track_heights += this._layer_containers[this._track_order[i]].track_height + this.trackGap;
        }
    }

    var viewBox = [-1,0,0,0];
    viewBox[0] = -2*RS;
    viewBox[2] = (this.sequence.split('').length+(this.padding)+2)*RS;
    viewBox[3] = (this._axis_height + (track_heights / this.zoom)+ (this.padding))*RS;
    this._canvas.setAttribute('viewBox', viewBox.join(' '));
    this._canvas._canvas_height = viewBox[3];
    
    
    this._nav_canvas._buttons.setAttribute('preserveAspectRatio','xMinYMin meet');
    
    viewBox[0] = 0;
    
    this._nav_canvas._buttons.setAttribute('viewBox',viewBox.join(' '));

    this._resizeContainer();

};

/**
 * Zoom level has changed for this renderer
 * @name    MASCP.CondensedSequenceRenderer#zoomChange
 * @event
 * @param   {Object}    e
 */

/**
 *  @lends MASCP.CondensedSequenceRenderer.prototype
 *  @property   {Number}    zoom        The zoom level for a renderer. Minimum zoom level is zero, and defaults to the default zoom value
 *  @property   {Number}    defaultZoom The default zoom level for a renderer.
 *  @property   {Array}     trackOrder  The order of tracks on the renderer, an array of layer/group names.
 *  @property   {Number}    padding     Padding to apply to the right and top of plots (default 10).
 *  @property   {Number}    trackGap    Vertical gap between tracks (default 10)
 */
(function() {
var accessors = { 
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

    getDefaultZoom: function() {
        return this._defaultZoom || 1;
    },
    
    setDefaultZoom: function(zoom) {
        this._defaultZoom = zoom;
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
    MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("defaultZoom", accessors.setDefaultZoom);
    MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("defaultZoom", accessors.getDefaultZoom);
    MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("padding", accessors.setPadding);
    MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("padding", accessors.getPadding);
    MASCP.CondensedSequenceRenderer.prototype.__defineSetter__("trackGap", accessors.setTrackGap);
    MASCP.CondensedSequenceRenderer.prototype.__defineGetter__("trackGap", accessors.getTrackGap);
}
/*
if (Object.defineProperty) {
    Object.defineProperty(MASCP.CondensedSequenceRenderer.prototype,"zoom", {
        get : accessors.getZoom,
        set : accessors.setZoom
    });
    Object.defineProperty(MASCP.CondensedSequenceRenderer.prototype,"defaultZoom", {
        get : accessors.getDefaultZoom,
        set : accessors.setDefaultZoom
    });
    Object.defineProperty(MASCP.CondensedSequenceRenderer.prototype,"padding", {
        get : accessors.getPadding,
        set : accessors.setPadding
    });
    Object.defineProperty(MASCP.CondensedSequenceRenderer.prototype,"trackGap", {
        get : accessors.getTrackGap,
        set : accessors.setTrackGap
    });
}
*/
})();
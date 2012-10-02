/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
 */

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

    MASCP.CondensedSequenceRenderer.Zoom(self);

    // We want to unbind the default handler for sequence change that we get from
    // inheriting from CondensedSequenceRenderer
    jQuery(this).unbind('sequenceChange');

    jQuery(this).bind('sequenceChange',function() {
        for (var layername in MASCP.layers) {
            if (MASCP.layers.hasOwnProperty(layername)) {
                MASCP.layers[layername].disabled = true;
            }
        }
        self.zoom = self.zoom;
    });

    return this;
};

MASCP.CondensedSequenceRenderer.prototype = new MASCP.SequenceRenderer();

(function() {
    var scripts = document.getElementsByTagName("script");
    var src = scripts[scripts.length-1].src;
    src = src.replace(/[^\/]+$/,'');
    MASCP.CondensedSequenceRenderer._BASE_PATH = src;
})();

(function(clazz) {
    var createCanvasObject = function() {
        var renderer = this;
        this.win = function() {
            if (this._container && this._container.ownerDocument && this._container.ownerDocument.defaultView) {
                return this._container.ownerDocument.defaultView;
            }
            return null;
        };

        if (this._object) {
            if (typeof svgweb != 'undefined') {
                svgweb.removeChild(this._object, this._object.parentNode);
            } else {
                this._object.parentNode.removeChild(this._object);
            }
            this._canvas = null;
            this._object = null;
        }
        var canvas;

        if ( document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1") ) {
            var native_canvas = document.createElementNS(svgns,'svg');
            native_canvas.setAttribute('width','100%');
            native_canvas.setAttribute('height','100%');
            this._container.appendChild(native_canvas);
            this._canvas = native_canvas;
            canvas = {
                'addEventListener' : function(name,load_func) {
                    native_canvas.contentDocument = { 'rootElement' : native_canvas };
                    load_func.call(native_canvas);
                }            
            };
        }

        canvas.addEventListener('load',function() {
            var container_canv = this;
            SVGCanvas(container_canv);
            var group = container_canv.makeEl('g');
        
            var canv = container_canv.makeEl('svg');
            canv.RS = renderer._RS;
            SVGCanvas(canv);
            group.appendChild(canv);
            container_canv.appendChild(group);

            var supports_events = true;

            try {
                var noop = canv.addEventListener;
            } catch (err) {
                supports_events = false;
            }

            if (false && supports_events) {
                var oldAddEventListener = canv.addEventListener;
        
                // We need to track all the mousemove functions that are bound to this event
                // so that we can switch off all the mousemove bindings during an animation event
        
                var mouse_moves = [];

                canv.addEventListener = function(ev,func,bubbling) {
                    if (ev == 'mousemove') {
                        if (mouse_moves.indexOf(func) < 0) {
                            mouse_moves.push(func);
                        } else {
                            return;
                        }
                    }
                    return oldAddEventListener.apply(canv,[ev,func,bubbling]);
                };

                jQuery(canv).bind('_anim_begin',function() {
                    for (var i = 0; i < mouse_moves.length; i++ ) {
                        canv.removeEventListener('mousemove', mouse_moves[i], false );
                    }
                    jQuery(canv).bind('_anim_end',function() {
                        for (var j = 0; j < mouse_moves.length; j++ ) {
                            oldAddEventListener.apply(canv,['mousemove', mouse_moves[j], false] );
                        }                        
                        jQuery(canv).unbind('_anim_end',arguments.callee);
                    });
                });
            }
        
        
            var canvas_rect = canv.makeEl('rect', {  'x':'-10%',
                                                    'y':'-10%',
                                                    'width':'120%',
                                                    'height':'120%',
                                                    'style':'fill: #ffffff;'});
        
        
        
            var left_fade = container_canv.makeEl('rect',{      'x':'0',
                                                                'y':'0',
                                                                'width':'50',
                                                                'height':'100%',
                                                                'style':'fill: url(#left_fade);'});

            var right_fade = container_canv.makeEl('rect',{     'x':'100%',
                                                                'y':'0',
                                                                'width':'50',
                                                                'height':'100%',
                                                                'transform':'translate(-50,0)',
                                                                'style':'fill: url(#right_fade);'});


            jQuery(canv).bind('pan',function() {
                if (canv.currentTranslate.x >= 0) {
                    left_fade.setAttribute('visibility','hidden');
                } else {
                    left_fade.setAttribute('visibility','visible');
                }
            });
        
            jQuery(canv).bind('_anim_begin',function() {
                left_fade.setAttribute('visibility','hidden');
            });
        
            jQuery(canv).bind('_anim_end',function() {
                jQuery(canv).trigger('pan');
            });

            if (canv.currentTranslate.x >= 0) {
                left_fade.setAttribute('visibility','hidden');
            }
            var nav_group = container_canv.makeEl('g');
            container_canv.appendChild(nav_group);
            var nav_canvas = container_canv.makeEl('svg');
            nav_group.appendChild(nav_canvas);



           canv.setCurrentTranslateXY = function(x,y) {
                    var curr_transform = (group.getAttribute('transform') || '').replace(/translate\([^\)]+\)/,'');
                    curr_transform = curr_transform + ' translate('+x+', '+y+') ';
                    group.setAttribute('transform',curr_transform);
                    this.currentTranslate.x = x;
                    this.currentTranslate.y = y;
            };
            canv.setCurrentTranslateXY(0,0);
        
            nav_canvas.setCurrentTranslateXY = function(x,y) {
                    var curr_transform = (nav_group.getAttribute('transform') || '').replace(/translate\([^\)]+\)/,'');
                    curr_transform = curr_transform + ' translate('+x+', '+y+') ';
                    nav_group.setAttribute('transform',curr_transform);
                    this.currentTranslate.x = x;
                    this.currentTranslate.y = y;
            };
            nav_canvas.setCurrentTranslateXY(0,0);
        

        
            addNav.call(renderer,nav_canvas);

            var nav = renderer.navigation;
            var old_show = nav.show, old_hide = nav.hide;
            nav.show = function() {
                old_show.call(nav);
                canv.style.GomapScrollLeftMargin = 100 * renderer._RS / renderer.zoom;
            };
        
            nav.hide = function() {
                old_hide.call(nav);
                canv.style.GomapScrollLeftMargin = 1000;
            };
        
            renderer._container_canvas = container_canv;
            container_canv.setAttribute('preserveAspectRatio','xMinYMin meet');
            container_canv.setAttribute('width','100%');
            container_canv.setAttribute('height','100%');
            canv.appendChild(canv.makeEl('rect', {'x':0,'y':0,'width':'100%','height':'100%','stroke-width':'0','fill':'#ffffff'}));
            renderer._object = this;
            renderer._canvas = canv;
            renderer._canvas._canvas_height = 0;
            jQuery(renderer).trigger('svgready');
        },false);
    
        return canvas;
    };

    var addNav = function(nav_canvas) {
        this.navigation = new MASCP.CondensedSequenceRenderer.Navigation(nav_canvas,this);
        var nav = this.navigation;
        var self = this;
    
        var hide_chrome = function() {
            nav.demote(); 
        };
    
        var show_chrome = function() {
            nav.promote(); 
        };

        if ( ! MASCP.IE ) {
        jQuery(this._canvas).bind('panstart',hide_chrome);
        bean.add(this._canvas,'panend',show_chrome);
        jQuery(this._canvas).bind('_anim_begin',hide_chrome);
        jQuery(this._canvas).bind('_anim_end',show_chrome);
        }
    };
    var drawAminoAcids = function() {
        var renderer = this;
        var aas = renderer.addTextTrack(this.sequence,this._canvas.set());
        aas.attr({'y' : 12*renderer._RS});
        renderer.select = function() {
            var vals = Array.prototype.slice.call(arguments);
            var from = vals[0];
            var to = vals[1];
            this.moveHighlight.apply(this,vals);
        };
    };

    var drawAxis = function(canvas,lineLength) {
        var RS = this._RS;
        var x = 0, i = 0;
    
    
        var axis = canvas.set();
        axis.push(canvas.path('M0 '+15*RS+' l0 '+10*RS));

        axis.push(canvas.path('M'+(lineLength*RS)+' '+14*RS+' l0 '+10*RS));

        this._axis_height = 20;

        axis.attr({'pointer-events' : 'none'});

        var big_ticks = canvas.set();
        var little_ticks = canvas.set();
        var big_labels = canvas.set();
        var little_labels = canvas.set();
        var minor_mark = 10;
        var major_mark = 20;
        
        if (this.sequence.length > 5000) {
            minor_mark = 100;
            major_mark = 200;
        }
        if (this.sequence.length > 1000) {
            minor_mark = 20;
            major_mark = 40;
        }
        for ( i = 0; i < (lineLength/5); i++ ) {

            if ( (x % minor_mark) === 0) {
                big_ticks.push(canvas.path('M'+x*RS+' '+14*RS+' l 0 '+7*RS));
            } else {
                little_ticks.push(canvas.path('M'+x*RS+' '+16*RS+' l 0 '+4*RS));
            }

            if ( (x % major_mark) === 0 && x !== 0) {
                big_labels.push(canvas.text(x,5,""+(x)));
            } else if (( x % minor_mark ) === 0 && x !== 0) {
                little_labels.push(canvas.text(x,7,""+(x)));
            }

            x += 5;
        }
    
        for ( i = 0; i < big_labels.length; i++ ) {
            big_labels[i].style.textAnchor = 'middle';
            big_labels[i].setAttribute('text-anchor','middle');
            big_labels[i].firstChild.setAttribute('dy','1.5ex');
            big_labels[i].setAttribute('font-size',7*RS+'pt');
        }

        for ( i = 0; i < little_labels.length; i++ ) {
            little_labels[i].style.textAnchor = 'middle';
            little_labels[i].setAttribute('text-anchor','middle');
            little_labels[i].firstChild.setAttribute('dy','1.5ex');
            little_labels[i].setAttribute('font-size',2*RS+'pt');        
            little_labels[i].style.fill = '#000000';
        }
    
        big_ticks.attr({'pointer-events' : 'none'});
        little_ticks.attr({'pointer-events' : 'none'});
        big_labels.attr({'pointer-events' : 'none'});
        little_labels.attr({'pointer-events' : 'none'});
    
        little_ticks.attr({ 'stroke':'#555555', 'stroke-width':0.5*RS+'pt'});
        little_ticks.hide();
        little_labels.hide();

        canvas.addEventListener('zoomChange', function() {
               if (this.zoom > 3.6) {
                   little_ticks.hide();
                   big_ticks.show();
                   big_ticks.attr({'stroke-width' : 0.05*RS+'pt', 'stroke' : '#999999', 'transform' : 'scale(1,0.1) translate(0,4500)' });
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
                   big_ticks.attr({'stroke-width':0.5*RS+'pt', 'stroke' : '#000000', 'transform' : ''});
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
                   big_ticks.attr({'stroke-width':RS+'pt', 'transform' : '', 'stroke' : '#000000'});
                   big_labels.show();
                   big_labels.attr({'font-size':7*RS+'pt','y':5*RS});
                   little_ticks.hide();
                   little_labels.hide();
               }
        },false);
    };

    clazz.prototype.leftVisibleResidue = function() {
        var self = this;
        var val = Math.floor((self.sequence.length+self.padding+2)*(1-((self._canvas.width.baseVal.value + self._canvas.currentTranslate.x) / self._canvas.width.baseVal.value)))-1;
        if (val < 0) {
            val = 0;
        }
        return val;
    };

    clazz.prototype.rightVisibleResidue = function() {
        var self = this;
        var val = Math.floor(self.leftVisibleResidue() + (self.sequence.length+self.padding+2)*(self._container_canvas.parentNode.getBoundingClientRect().width / self._canvas.width.baseVal.value));
        if (val > self.sequence.length) {
            val = self.sequence.length;
        }
        return val;
    };

    clazz.prototype.setSequence = function(sequence) {
        var new_sequence = this._cleanSequence(sequence);
        if (new_sequence == this.sequence && new_sequence !== null) {
            jQuery(this).trigger('sequenceChange');
            return;
        }
    
        if (! new_sequence) {
            return;
        }
    
        this.sequence = new_sequence;
    
        var seq_chars = this.sequence.split('');
        var line_length = seq_chars.length;

        if (line_length === 0) {
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

        var RS = this._RS;

        jQuery(this).unbind('svgready').bind('svgready',function(cnv) {
            var canv = renderer._canvas;
            canv.RS = RS;
            canv.setAttribute('background', '#000000');
            canv.setAttribute('preserveAspectRatio','xMinYMin meet');
        
            var defs = canv.makeEl('defs');
            renderer._container_canvas.appendChild(defs);


            defs.appendChild(canv.make_gradient('track_shine','0%','100%',['#111111','#aaaaaa','#111111'], [0.5,0.5,0.5]));
            defs.appendChild(canv.make_gradient('simple_gradient','0%','100%',['#aaaaaa','#888888'], [1,1]));
            defs.appendChild(canv.make_gradient('left_fade','100%','0%',['#ffffff','#ffffff'], [1,0]));
            defs.appendChild(canv.make_gradient('right_fade','100%','0%',['#ffffff','#ffffff'], [0,1]));
            defs.appendChild(canv.make_gradient('red_3d','0%','100%',['#CF0000','#540000'], [1,1]));
        
            renderer.add3dGradient = function(color) {
                defs.appendChild(canv.make_gradient('grad_'+color,'0%','100%',[color,'#ffffff',color],[1,1,1] ));
            };

            var shadow = canv.makeEl('filter',{
                'id':'drop_shadow',
                'filterUnits':'objectBoundingBox',
                'x': '0',
                'y': '0',
                'width':'150%',
                'height':'130%'
            });

            shadow.appendChild(canv.makeEl('feGaussianBlur',{'in':'SourceGraphic', 'stdDeviation':'4', 'result' : 'blur_out'}));
            shadow.appendChild(canv.makeEl('feOffset',{'in':'blur_out', 'result':'the_shadow', 'dx':'3','dy':'1'}));
            shadow.appendChild(canv.makeEl('feBlend',{'in':'SourceGraphic', 'in2':'the_shadow', 'mode':'normal'}));
        
            defs.appendChild(shadow);

            var link_icon = canv.makeEl('svg',{
                'width' : '100%',
                'height': '100%',
                'id'    : 'new_link_icon',
                'viewBox': '0 0 100 100',
                'preserveAspectRatio' : 'xMinYMin meet'
            });

            defs.appendChild(link_icon);

            link_icon.appendChild(canv.makeEl('rect', {
                'x' : '12.5',
                'y' : '37.5',
                'stroke-width' : '3',
                'width' : '50',
                'height': '50',
                'stroke': '#ffffff',
                'fill'  : 'none'            
            }));
            link_icon.appendChild(canv.makeEl('path', {
                'd' : 'M 50.0,16.7 L 83.3,16.7 L 83.3,50.0 L 79.2,56.2 L 68.8,39.6 L 43.8,66.7 L 33.3,56.2 L 60.4,31.2 L 43.8,20.8 L 50.0,16.7 z',
                'stroke-width' : '3',
                'stroke': '#999999',
                'fill'  : '#ffffff'            
            }));

            var plus_icon = canv.makeEl('svg',{
                'width' : '100%',
                'height': '100%',
                'id'    : 'plus_icon',
                'viewBox': '0 0 100 100',
                'preserveAspectRatio' : 'xMinYMin meet'
            });
            plus_icon.appendChild(canv.plus(0,0,100/canv.RS));
            
            defs.appendChild(plus_icon);

            var minus_icon = canv.makeEl('svg',{
                'width' : '100%',
                'height': '100%',
                'id'    : 'minus_icon',
                'viewBox': '0 0 100 100',
                'preserveAspectRatio' : 'xMinYMin meet'
            });
            minus_icon.appendChild(canv.minus(0,0,100/canv.RS));

            defs.appendChild(minus_icon);
        
            drawAxis.call(this,canv,line_length);
            drawAminoAcids.call(this,canv);
            renderer._layer_containers = {};
            renderer.enablePrintResizing();

            // When we have a layer registered with the global MASCP object
            // add a track within this rendererer.
            bean.add(MASCP,'layerRegistered', function(layer,rend) {
                if (! rend || rend === renderer) {
                    renderer.addTrack(layer);
                }
            });

            jQuery(renderer).trigger('sequenceChange');
        });
        var canvas = createCanvasObject.call(this);
        if (this._canvas) {
            has_canvas = true;
        } else {
            if (typeof svgweb != 'undefined') {
                svgweb.appendChild(canvas,this._container);
            } else {
                this._container.appendChild(canvas);
            }
        }
    
        var rend = this;
        this.EnableHighlights();
    
        var seq_change_func = function(other_func) {
            if ( ! rend._canvas ) {
                rend.bind('sequenceChange',function() {
                    jQuery(rend).unbind('sequenceChange',arguments.callee);
                    other_func.apply();
                });
            } else {
                other_func.apply();
            }
        };
    
        seq_change_func.ready = function(other_func) {
            this.call(this,other_func);
        };
    
        return seq_change_func;
    
    };

})(MASCP.CondensedSequenceRenderer);

/**
 * Create a Hydropathy plot, and add it to the renderer as a layer.
 * @param {Number}  windowSize  Size of the sliding window to use to calculate hydropathy values
 * @returns Hydropathy values for each of the residues
 * @type Array
 */
MASCP.CondensedSequenceRenderer.prototype.createHydropathyLayer = function(windowSize) {
    var RS = this._RS;
    
    var canvas = this._canvas;
    
    if ( ! canvas ) {        
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);            
            orig_func.call(self,windowSize);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

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
    plot.setAttribute('visibility','hidden');
    var axis = this._canvas.path('M0 0 m0 '+(-1*min_value)+' l'+this._sequence_els.length*RS+' 0');
    axis.setAttribute('stroke-width',0.2*RS);
    axis.setAttribute('visibility','hidden');
    plot.setAttribute('pointer-events','none');
    axis.setAttribute('pointer-events','none');
    
    this._layer_containers.hydropathy.push(plot);    
    this._layer_containers.hydropathy.push(axis);
    this._layer_containers.hydropathy.fixed_track_height = (-1*min_value+max_value) / RS;
    return values;
};

(function() {
var addElementToLayer = function(layerName,opts) {
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {        
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);            
            orig_func.call(self,layerName);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    var bobble = canvas.circle(this._index+0.5,10,0.25);
    bobble.setAttribute('visibility','hidden');
    bobble.style.opacity = '0.4';
    var tracer = canvas.rect(this._index+0.5,10,0.05,0);
    tracer.style.strokeWidth = '0';
    tracer.style.fill = MASCP.layers[layerName].color;
    tracer.setAttribute('visibility','hidden');
    canvas.insertBefore(tracer,canvas.firstChild.nextSibling);
    var renderer = this._renderer;
    
    if ( ! this._renderer._layer_containers[layerName].tracers) {
        this._renderer._layer_containers[layerName].tracers = canvas.set();
    }
    if ( ! canvas.tracers ) {
        canvas.tracers = canvas.set();
        canvas._visibleTracers = function() {
            return renderer._visibleTracers();
        };
    }
    if ( ! opts ) {
        opts = {};
    }

    var scale = 1;
    if (opts.height) {
        scale = opts.height / this._renderer._layer_containers[layerName].track_height;
    }

    var tracer_marker = canvas.growingMarker(0,0,opts.content || layerName.charAt(0).toUpperCase(),opts);
    tracer_marker.setAttribute('transform','translate('+((this._index + 0.5) * this._renderer._RS) +',0.01) scale('+scale+')');
    tracer_marker.setAttribute('height','250');
    tracer_marker.firstChild.setAttribute('transform', 'translate(-100,0) rotate(0,100,0.001)');

    // tracer_marker.setAttribute('transform','scale(0.5)');
    // tracer_marker.zoom_level = 'text';
    tracer_marker.setAttribute('visibility','hidden');

    this._renderer._layer_containers[layerName].tracers.push(tracer);
    this._renderer._layer_containers[layerName].tracers.push(bobble);
    this._renderer._layer_containers[layerName].push(tracer_marker);
    canvas.tracers.push(tracer);
    
    return [tracer,tracer_marker,bobble];
};

var addBoxOverlayToElement = function(layerName,width,fraction) {
    
    if (typeof fraction == 'undefined') {
        fraction = 1;
    }
    
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);            
            orig_func.call(self,layerName,fraction,width);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }


    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    var rect_x = parseFloat(rect.getAttribute('x'));
    var rect_max_x = rect_x + parseFloat(rect.getAttribute('width'));
    var container = this._renderer._layer_containers[layerName];
    for (var i = 0; i < container.length; i++) {
        var el_x = parseFloat(container[i].getAttribute('x'));
        var el_max_x = el_x + parseFloat(container[i].getAttribute('width'));
        if ((el_x <= rect_x && rect_x <= el_max_x) ||
            (rect_x <= el_x && el_x <= rect_max_x)) {
                if (container[i].style.opacity != fraction) {
                    continue;
                }
                container[i].setAttribute('x', ""+Math.min(el_x,rect_x));
                container[i].setAttribute('width', ""+(Math.max(el_max_x,rect_max_x)-Math.min(el_x,rect_x)) );
                rect.parentNode.removeChild(rect);
                return container[i];
            }
    }
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.style.strokeWidth = '0px';
    rect.setAttribute('visibility', 'hidden');
    rect.style.opacity = fraction;
    rect.setAttribute('fill',MASCP.layers[layerName].color);
    rect.position_start = this._index;
    rect.position_end = this._index + width;
    return rect;
};

var addTextToElement = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }
    if ( ! opts ) {
        opts = {};
    }
    var height = this._renderer._layer_containers[layerName].trackHeight || 4;
    var text = canvas.text(this._index,0,opts.txt || "Text");
    text.setAttribute('font-size',0.75*height*this._renderer._RS);
    text.setAttribute('font-weight','bolder');
    text.setAttribute('fill','#ffffff');
    text.setAttribute('stroke','#000000');
    text.setAttribute('stroke-width','5');
    text.setAttribute('style','font-family: sans-serif; text-anchor: middle;');
    text.firstChild.setAttribute('dy','2ex');
    text.setAttribute('text-anchor','middle');
    text.setHeight = function(height) {
        text.setAttribute('font-size', 0.75*height);
    }
    this._renderer._layer_containers[layerName].push(text);
    return text;
}

var addShapeToElement = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    var methods = {
        "pentagon" : canvas.pentagon,
        "hexagon"  : canvas.hexagon,
        "rectangle": canvas.rect,
        "ellipse"  : canvas.ellipticalRect,
        "roundrect": function(x,y,width,height) {
            return canvas.roundRect(x,y,width,height,0.25*height);
        }
    }
    if ( ! opts.rotate ) {
        opts.rotate = 0;
    }
    var shape = null;
    if (opts.shape in methods) {
        shape = methods[opts.shape].call(canvas,this._index,60,width || 1,opts.height || 4,opts.rotate);
    } else {
        return;
    }
    this._renderer._layer_containers[layerName].push(shape);
    shape.setAttribute('class',layerName);
    shape.style.strokeWidth = '0px';
    shape.setAttribute('visibility', 'hidden');
    shape.setAttribute('fill',opts.fill || MASCP.layers[layerName].color);
    shape.position_start = this._index;
    shape.position_end = this._index + width;
    return shape;
};

var addElementToLayerWithLink = function(layerName,url,width) {
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);            
            orig_func.call(self,layerName,url,width);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }


    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';    
    rect.setAttribute('fill',MASCP.layers[layerName].color);
    rect.setAttribute('visibility', 'hidden');
    rect.setAttribute('class',layerName);
    return rect;
};

var addCalloutToLayer = function(layerName,element,opts) {
    var canvas = this._renderer._canvas;

    var renderer = this._renderer;
    
    if (typeof element == 'string') {
        var a_el = document.createElement('div');
        renderer.fillTemplate(element,opts,function(err,el) {
            a_el.innerHTML = el;
        });
        element = a_el;
    }
    
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);            
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }
    var callout = canvas.callout(this._index+0.5,0.01,element,{'width' : (10*opts.width) || 100 ,'height': (opts.height * 10) || 100, 'align' : opts.align });
    callout.setAttribute('height',this._renderer._RS*10);
    this._renderer._canvas_callout_padding = Math.max(((10*opts.height) || 100),this._renderer._canvas_callout_padding||0);
    this._renderer._layer_containers[layerName].push(callout);
    callout.clear = function() {
        var cont = renderer._layer_containers[layerName];
        if (cont.indexOf(callout) > 0) {
            cont.splice(cont.indexOf(callout),1);
        }
        callout.parentNode.removeChild(callout);
    };
    return callout;
};

var all_annotations = {};
var default_annotation_height = 8;

var addAnnotationToLayer = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;
    
    var renderer = this._renderer;
    
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        this._renderer.bind('sequencechange',function() {
            this._renderer.unbind('sequencechange',arguments.callee);            
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    if (typeof opts == 'undefined') {
        opts = { 'angle' : 0,
                'border' : 'rgb(255,0,0)',
                'content': 'A'
         };
    } else {
        if ( typeof opts.angle == 'undefined' ) {
            opts.angle = 0;
        }
    }
    
    if ( ! all_annotations[layerName]) {
        all_annotations[layerName] = {};
    }
    
    var blob_id = this._index+'_'+opts.angle;

    if (opts.angle == 'auto') {
        if ( ! all_annotations[layerName][blob_id] ) {
            all_annotations[layerName][blob_id] = {};
        }
    }

    var blob_exists = (typeof all_annotations[layerName][blob_id]) !== 'undefined';

    var height = opts.height || this._renderer._layer_containers[layerName].track_height;

    var offset = this._renderer._RS * height / 2; //this._renderer._RS * height / 2;
    var blob = all_annotations[layerName][blob_id] ? all_annotations[layerName][blob_id] : canvas.growingMarker(0,0,opts.content,opts);

    if (opts.angle == 'auto') {
        if ( ! blob.contents ) {
            blob.contents = [opts.content];
        } else {
            if (blob.contents.indexOf(opts.content) < 0) {
                blob.contents.push(opts.content);
            }
        }

        opts.angle = blob.contents.length == 1 ? 0 : (-45 + 90*((blob.contents.indexOf(opts.content))/(blob.contents.length-1)));
        blob_id = this._index+'_'+opts.content;
        blob_exists = (typeof all_annotations[layerName][blob_id]) !== 'undefined';
        blob = all_annotations[layerName][blob_id] ? all_annotations[layerName][blob_id] : canvas.growingMarker(0,offset,opts.content,opts);
    }
    
    blob.setAttribute('transform','translate('+((this._index + 0.5) * this._renderer._RS) +',0.01) scale(1)');
    blob.setAttribute('height','250');
    blob.firstChild.setAttribute('transform', 'translate(-100,0) rotate('+opts.angle+',100,0.001)');

    blob.angle = opts.angle;
    all_annotations[layerName][blob_id] = blob;
    if ( ! blob_exists ) {
        blob._value = 0;
        this._renderer._layer_containers[layerName].push(blob);
        if (typeof opts.offset == 'undefined' || opts.offset === null) {
            blob.offset = 2.5*height;
        } else {
            blob.offset = opts.offset;
        }

        blob.height = height;
        if ( ! opts.height ) {
            this._renderer._layer_containers[layerName].fixed_track_height = height;
        } else {
            var old_set_height = blob.setHeight;
            blob.setHeight = function(hght) {
                if (arguments.callee.caller != renderer.redrawAnnotations) {
                    return;
                }
                return old_set_height.call(this,hght);
            };
        }
    }
    
    blob._value += width;
    if ( ! blob_exists ) {
        var bobble = canvas.circle(this._index+0.5,10+height,0.25);
        bobble.setAttribute('visibility','hidden');
        bobble.style.opacity = '0.4';

        var tracer = canvas.rect(this._index+0.5,10+height,0.05,0);
        tracer.style.strokeWidth = '0px';
        tracer.style.fill = '#777777';
        tracer.setAttribute('visibility','hidden');
        var theight = this._renderer._layer_containers[layerName].track_height;
        var height_offset = (10*blob.offset);
        if (! opts.height && ! opts.offset) {
            height_offset = this._renderer._layer_containers[layerName].fixed_track_height * 0.5 * this._renderer._RS;
        }
        tracer.setHeight = function(hght) {
            tracer.setAttribute('height', hght+height_offset);
        }
        canvas.insertBefore(tracer,canvas.firstChild.nextSibling);
    
        if ( ! this._renderer._layer_containers[layerName].tracers) {
            this._renderer._layer_containers[layerName].tracers = canvas.set();
        }
        if ( ! canvas.tracers ) {
            canvas.tracers = canvas.set();
            canvas._visibleTracers = function() {
                return renderer._visibleTracers();
            };
        }

        this._renderer._layer_containers[layerName].tracers.push(tracer);
        this._renderer._layer_containers[layerName].tracers.push(bobble);
        canvas.tracers.push(tracer);
    }
    
    this._renderer.redrawAnnotations(layerName,height);
    return blob;
};

MASCP.CondensedSequenceRenderer.prototype._extendElement = function(el) {
    el.addToLayer = addElementToLayer;
    el.addBoxOverlay = addBoxOverlayToElement;
    el.addShapeOverlay = addShapeToElement;
    el.addTextOverlay = addTextToElement;
    el.addToLayerWithLink = addElementToLayerWithLink;
    el.addAnnotation = addAnnotationToLayer;
    el.callout = addCalloutToLayer;
};

var zoomFunctions = [];

MASCP.CondensedSequenceRenderer.prototype.addUnderlayRenderer = function(underlayFunc) {
    if (zoomFunctions.length == 0) {
        this.bind('zoomChange',function() {
            for (var i = zoomFunctions.length - 1; i >=0; i--) {
                zoomFunctions[i].call(this, this.zoom, this._canvas);
            }
        });
    }
    zoomFunctions.push(underlayFunc);
};

MASCP.CondensedSequenceRenderer.prototype.addTextTrack = function(seq,container) {
    var RS = this._RS;
    var renderer = this;
    var max_length = 300;
    var canvas = renderer._canvas;
    var seq_chars = seq.split('');

    var amino_acids = canvas.set();
    var amino_acids_shown = false;
    var x = 0;

    var has_textLength = true;
    var no_op = function() {};
    try {
        var test_el = document.createElementNS(svgns,'text');
        test_el.setAttribute('textLength',10);
        no_op(test_el.textLength);
    } catch (e) {
        has_textLength = false;
    }

    /* We used to test to see if there was a touch event
       when doing the textLength method of amino acid
       layout, but iOS seems to support this now.
       
       Test case for textLength can be found here
       
       http://jsfiddle.net/nkmLu/11/embedded/result/
    */

    var a_text;

    if (has_textLength && ('lengthAdjust' in document.createElementNS(svgns,'text')) && ('textLength' in document.createElementNS(svgns,'text'))) {
        if (seq.length <= max_length) {
            a_text = canvas.text(0,12,document.createTextNode(seq));
            a_text.setAttribute('textLength',RS*seq.length);
        } else {
            a_text = canvas.text(0,12,document.createTextNode(seq.substr(0,max_length)));
            a_text.setAttribute('textLength',RS*max_length);
        }
        canvas.insertBefore(a_text,canvas.firstChild.nextSibling);

        a_text.style.fontFamily = "'Lucida Console', 'Courier New', Monaco, monospace";
        a_text.setAttribute('lengthAdjust','spacing');
        a_text.setAttribute('text-anchor', 'start');
        a_text.setAttribute('dx',5);
        a_text.setAttribute('dy','1.5ex');
        a_text.setAttribute('font-size', RS);
        a_text.setAttribute('fill', '#000000');
        amino_acids.push(a_text);
        container.push(a_text);
    } else {    
        for (var i = 0; i < seq_chars.length; i++) {
            a_text = canvas.text(x,12,seq_chars[i]);
            a_text.firstChild.setAttribute('dy','1.5ex');
            amino_acids.push(a_text);
            container.push(a_text);
            a_text.style.fontFamily = "'Lucida Console', Monaco, monospace";
            x += 1;
        }
        amino_acids.attr( { 'width': RS,'text-anchor':'start','height': RS,'font-size':RS,'fill':'#000000'});
    }
    var update_sequence = function() {
        if (seq.length <= max_length) {
            return;
        }
        var start = parseInt(renderer.leftVisibleResidue());
        start -= 50;
        if (start < 0) { 
            start = 0;
        }
        if ((start + max_length) >= seq.length) {
            start = seq.length - max_length;
        }
        a_text.replaceChild(document.createTextNode(seq.substr(start,max_length)),a_text.firstChild);
        a_text.setAttribute('dx',5+((start)*RS));
    };
    
    canvas.addEventListener('panstart', function() {
        if (amino_acids_shown) {
            amino_acids.attr( { 'display' : 'none'});
        }
        bean.add(canvas,'panend', function() {
            if (amino_acids_shown) {
                amino_acids.attr( {'display' : 'block'} );
                update_sequence();
            }
            bean.remove(canvas,'panend',arguments.callee);
        });
    },false);
       
    canvas.addEventListener('zoomChange', function() {
       if (canvas.zoom > 3.6) {
           renderer._axis_height = 14;
           amino_acids.attr({'display' : 'block'});
           amino_acids_shown = true;
           update_sequence();
       } else {
           renderer._axis_height = 30;
           amino_acids.attr({'display' : 'none'});   
           amino_acids_shown = false;        
       }
   },false);

   return amino_acids;
};

MASCP.CondensedSequenceRenderer.prototype.renderTextTrack = function(lay,in_text) {
    var layerName = lay;
    if (typeof layerName !== 'string') {
        layerName = lay.name;
    }
    var canvas = this._canvas;
    if ( ! canvas || typeof layerName == 'undefined') {
        return;
    }
    var renderer = this;
    var container = this._layer_containers[layerName];
    this.addTextTrack(in_text,container);
};

MASCP.CondensedSequenceRenderer.prototype.resetAnnotations = function() {
    all_annotations = {};
};

MASCP.CondensedSequenceRenderer.prototype.removeAnnotations = function(lay) {
    var layerName = lay;
    if (typeof layerName !== 'string') {
        layerName = lay.name;
    }
    var canvas = this._canvas;
    if ( ! canvas || typeof layerName == 'undefined') {
        return;
    }

    for (var blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            var blob = all_annotations[layerName][blob_idx];
            var container = this._layer_containers[layerName];
            if (container.indexOf(blob) >= 0) {
                container.splice(container.indexOf(blob),1);
            }
            if (canvas.tracers && container.tracers) {
                for (var i = 0; i < container.tracers.length; i++ ) {
                    var tracer = container.tracers[i];
                    tracer.parentNode.removeChild(tracer);
                    if (canvas.tracers.indexOf(tracer) >= 0) {                    
                        canvas.tracers.splice(canvas.tracers.indexOf(tracer),1);
                    }
                }
                container.tracers = canvas.set();
            }
            if (blob.parentNode) {
                blob.parentNode.removeChild(blob);
            }
            all_annotations[layerName][blob_idx] = null;
        }
    }
    all_annotations[layerName] = null;
    delete all_annotations[layerName];
    delete this._layer_containers[layerName].fixed_track_height;

};

MASCP.CondensedSequenceRenderer.prototype.redrawAnnotations = function(layerName) {
    var canvas = this._canvas, a_parent = null, blob_idx = 0;
    var susp_id = canvas.suspendRedraw(10000);
    
    var max_value = 0;
    // var height = this._layer_containers[layerName].fixed_track_height || this._layer_containers[layerName].track_height;
    for (blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            if ( all_annotations[layerName][blob_idx]._value > max_value ) {
                max_value = all_annotations[layerName][blob_idx]._value;
            }
            a_parent = all_annotations[layerName][blob_idx].parentNode;
            if ( ! a_parent ) {
                continue;
            }
            a_parent.removeChild(all_annotations[layerName][blob_idx]);
            all_annotations[layerName][blob_idx]._parent = a_parent;
        }
    }
    for (blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            var a_blob = all_annotations[layerName][blob_idx];

            var height = a_blob.height;
            var track_height = this._layer_containers[layerName].fixed_track_height || this._layer_containers[layerName].track_height;

            if ( ! a_blob.setHeight ) {
                continue;
            }
            var size_val = (0.4 + ((0.6 * a_blob._value) / max_value))*(this._RS * height * 1);
            a_blob.setHeight(size_val);
        }
    }
    
    for (blob_idx in all_annotations[layerName]) {
        if (all_annotations[layerName].hasOwnProperty(blob_idx)) {
            a_parent = all_annotations[layerName][blob_idx]._parent;
            if ( ! a_parent ) {
                continue;
            }
            a_parent.appendChild(all_annotations[layerName][blob_idx]);
        }
    }
    canvas.unsuspendRedraw(susp_id);
};

// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function(mpr){
    var cache = {};
    var needs_sandbox = false;

    var template_func = function tmpl(str, data){
        // Figure out if we're getting a template, or if we need to
        // load the template - and be sure to cache the result.
        var fn = !/\W/.test(str) ?
          cache[str] = cache[str] ||
            tmpl(document.getElementById(str).innerHTML) :

          // Generate a reusable function that will serve as a template
          // generator (and which will be cached).
          new Function("obj",
            "var p=[],print=function(){p.push.apply(p,arguments);};" +

            // Introduce the data as local variables using with(){}
            "with(obj){p.push('" +

            // Convert the template into pure JavaScript
            str
              .replace(/[\r\t\n]/g, " ")
              .split(/\x3c\%/g).join("\t")
              .replace(/((^|%>)[^\t]*)'/g, "$1\r")
              .replace(/\t=(.*?)%>/g, "',$1,'")
              .split("\t").join("');")
              .split("%>").join("p.push('")
              .split("\r").join("\\'")
          + "');}return p.join('');");
        
        // Provide some basic currying to the user
        return data ? fn( data ) : fn;
    };

    try {
        var foo = new Function("return;");
    } catch (exception) {
        needs_sandbox = true;
    }
    if (needs_sandbox) {
        mpr.fillTemplate = function tmpl(str,data,callback) {
            MASCP.SANDBOX.contentWindow.postMessage({ "template" : document.getElementById(str).innerHTML, "data" : data },"*");
            var return_func = function(event) {
                bean.remove(window,'message',return_func);
                if (event.data.html) {
                    callback.call(null,null,event.data.html);
                }
            };
            bean.add(window,'message',return_func);

        }
        return;
    }

  mpr.fillTemplate = function(str,data,callback) {
    callback.call(null,template_func(str,data));
  };
})(MASCP.CondensedSequenceRenderer.prototype);

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

MASCP.CondensedSequenceRenderer.prototype.EnableHighlights = function() {
    var renderer = this;
    var highlights = [];
    var createNewHighlight = function() {
        var highlight = renderer._canvas.rect(0,0,0,'100%');
        highlight.setAttribute('fill','#ffdddd');
        var pnode = highlight.parentNode;
        pnode.insertBefore(highlight,pnode.firstChild.nextSibling);
        highlights.push(highlight);
    };
    createNewHighlight();

    renderer.moveHighlight = function() {
        var vals = Array.prototype.slice.call(arguments);
        var RS = this._RS;
        var i = 0, idx = 0;
        for (i = 0; i < vals.length; i+= 2) {
            var from = vals[i];
            var to = vals[i+1];
            var highlight = highlights[idx];
            if ( ! highlight ) {
                createNewHighlight();
                highlight = highlights[idx];
            }
        
            highlight.setAttribute('x',(from - 0.25) * RS );
            highlight.setAttribute('width',(to - from) * RS );
            highlight.setAttribute('visibility','visible');
            idx += 1;
        }
        for (i = idx; i < highlights.length; i++){
            highlights[i].setAttribute('visibility','hidden');
        }
    };
};

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
        
        var width = (this.zoom || 1)*2*this.sequence.length;
        var height = (this.zoom || 1)*2*(this._canvas._canvas_height/this._RS);
        if (this._canvas_callout_padding) {
            height += this._canvas_callout_padding;
        }
        this._canvas.setAttribute('width', width);
        this._canvas.setAttribute('height',height);
        this.navigation.setDimensions(width,height);
        
        if (this.grow_container) {
            this._container_canvas.setAttribute('height',height);
            this._container.style.height = height+'px';        
        } else {
            this._container_canvas.setAttribute('height','100%');
            this._container_canvas.setAttribute('width','100%');
            this.navigation.setZoom(this.zoom);
        }        
    }
};

(function(clazz) {

var vis_change_event = function(e,renderer,visibility) {
    var self = this;
    if ( ! renderer._layer_containers[self.name] || renderer._layer_containers[self.name].length <= 0 ) {
        return;
    }
    
    if (! visibility) {
        if (renderer._layer_containers[self.name].tracers) {
            renderer._layer_containers[self.name].tracers.hide();
        }
    }
};

/**
 * Add a layer to this renderer.
 * @param {Object} layer    Layer object to add. The layer data is used to create a track that can be independently shown/hidden.
 *                          The track itself is by default hidden.
 */
clazz.prototype.addTrack = function(layer) {
    var RS = this._RS;
    var renderer = this;
    
    if ( ! this._canvas ) {
        this.bind('sequencechange',function() {
            this.addTrack(layer);
            this.unbind('sequencechange',arguments.callee);
        });
        console.log("No canvas, cannot add track, waiting for sequencechange event");
        return;
    }

    var layer_containers = this._layer_containers || [];

    if ( ! layer_containers[layer.name] || layer_containers[layer.name] === null) {
        layer_containers[layer.name] = this._canvas.set();
        if ( ! layer_containers[layer.name].track_height) {
            layer_containers[layer.name].track_height = renderer.trackHeight || 4;
        }
        jQuery(layer).unbind('visibilityChange',vis_change_event).bind('visibilityChange',vis_change_event);
        var event_names = ['click','mouseover','mousedown','mousemove','mouseout','mouseup','mouseenter','mouseleave'];
        var ev_function = function(ev,original_event,element) {
            jQuery(layer).trigger(ev.type,[original_event,element.position_start,element.position_end]);
        };
        for (var i = 0 ; i < event_names.length; i++) {
            jQuery(layer_containers[layer.name]._event_proxy).bind(event_names[i],ev_function);
        }
        jQuery(layer).unbind('removed').bind('removed',function() {
            renderer.removeTrack(this);
        });
    }
    
    this._layer_containers = layer_containers;
    
};

clazz.prototype.removeTrack = function(layer) {
    if (! this._layer_containers ) {
        return;
    }
    var layer_containers = this._layer_containers || [];
    if ( layer_containers[layer.name] ) {                
        layer_containers[layer.name].forEach(function(el) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        this.removeAnnotations(layer);
        this._layer_containers[layer.name] = null;
        layer.disabled = true;
    }
    
};

clazz.prototype.enablePrintResizing = function() {
    var self = this;
    if (self._media_func) {
        return;
    }
    var old_zoom;
    var old_translate;
    var old_viewbox;
    self._media_func = function(match) {
        if ( self.grow_container ) {
            return;
        }

        if (! match.matches ) {
            if (old_zoom) {
                self.zoomCenter = null;
                self.withoutRefresh(function() {
                  self.zoom = old_zoom;
                });
                self._canvas.setCurrentTranslateXY(old_translate,0);
                self._container_canvas.setAttribute('viewBox',old_viewbox);
                self._container.style.height = 'auto';
                old_zoom = null;
                old_translate = null;
                self.refresh();
                bean.fire(widget_rend._canvas,'zoomChange');
            }
            return;
        }
        var container = self._container;
        old_translate = self._canvas.currentTranslate.x;
        self._canvas.setCurrentTranslateXY(0,0);
        var zoomFactor = 0.95 * (container.clientWidth) / (widget_rend.sequence.length);
        if ( ! old_zoom ) {
          old_zoom = self.zoom;
          old_viewbox = self._container_canvas.getAttribute('viewBox');
        }
        self.zoomCenter = null;
        self._container_canvas.removeAttribute('viewBox');

        self.withoutRefresh(function() {
            self.zoom = zoomFactor;
        });
        self.grow_container = true;
        self.refresh();
        self.grow_container = false;
    };
    (self.win() || window).matchMedia('print').addListener(self._media_func);
};

clazz.prototype.wireframe = function() {
    var order = this.trackOrder || [];
    var y_val = 0;
    var track_heights = 0;
    if ( ! this.wireframes ) {
        return;
    }
    while (this.wireframes.length > 0) {
        this._canvas.removeChild(this.wireframes.shift());
    }
    for (var i = 0; i < order.length; i++ ) {
        
        var name = order[i];
        var container = this._layer_containers[name];
        if (! this.isLayerActive(name)) {
            continue;
        }
        if (container.fixed_track_height) {

            var track_height = container.fixed_track_height;

            y_val = this._axis_height + (track_heights  - track_height*0.3) / this.zoom;
            var a_rect = this._canvas.rect(0,y_val,10000,0.5*track_height);
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);
            var a_rect = this._canvas.rect(0,y_val,10000,track_height);
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);

            track_heights += (this.zoom * track_height) + this.trackGap;
        } else {
            y_val = this._axis_height + track_heights / this.zoom;
            var a_rect = this._canvas.rect(0,y_val,10000,0.5*container.track_height / this.zoom );
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);
            a_rect = this._canvas.rect(0,y_val,10000,container.track_height / this.zoom);
            a_rect.setAttribute('stroke','#ff0000');
            a_rect.setAttribute('fill','none');
            this.wireframes.push(a_rect);
            track_heights += container.track_height + this.trackGap;
        }

    }    
};

/**
 * Cause a refresh of the renderer, re-arranging the tracks on the canvas, and resizing the canvas if necessary.
 * @param {Boolean} animateds Cause this refresh to be an animated refresh
 */
clazz.prototype.refresh = function(animated) {
    if ( ! this._canvas ) {
        return;
    }

    var layer_containers = this._layer_containers || [];

    var RS = this._RS;
    var track_heights = 0;
    var order = this.trackOrder || [];
    var fixed_font_scale = this.fixedFontScale;
    
    if (this.navigation) {
        this.navigation.reset();
    }
    for (var i = 0; i < order.length; i++ ) {
        
        var name = order[i];
        var container = layer_containers[name];
        if ( ! container ) {
            continue;
        }
        var y_val;
        if (! this.isLayerActive(name)) {
            var attrs = { 'y' : -1*(this._axis_height)*RS, 'height' :  RS * container.track_height / this.zoom ,'visibility' : 'hidden' };
//            var attrs = { 'y' : (this._axis_height  + (track_heights - container.track_height )/ this.zoom)*RS, 'height' :  RS * container.track_height / this.zoom ,'visibility' : 'hidden' };
            if (MASCP.getLayer(name).group) {
                var controller_track = this.navigation.getController(MASCP.getLayer(name).group);
                if (controller_track && this.isLayerActive(controller_track)) {
                    attrs.y = layer_containers[controller_track.name].currenty();
                }
            }
            
            if (container.fixed_track_height) {
                delete attrs.height;
            }

            if (animated) {                
                container.animate(attrs);
            } else {
                container.attr(attrs);
            }
            if (container.tracers) {
            }
            continue;
        } else {
            container.attr({ 'opacity' : '1' });
        }
        if (container.tracers) {
            var disp_style = (this.isLayerActive(name) && (this.zoom > 3.6)) ? 'visible' : 'hidden';
            var height = (1.5 + track_heights / this.zoom )*RS;
            
            if(animated) {
                container.tracers.animate({'visibility' : disp_style , 'y' : (this._axis_height - 1.5)*RS,'height' : height });
            } else {
                container.tracers.attr({'visibility' : disp_style , 'y' : (this._axis_height - 1.5)*RS,'height' : height });
            }
        }
        if (container.fixed_track_height) {

            var track_height = container.fixed_track_height;

            y_val = this._axis_height + (track_heights  - track_height*0.3) / this.zoom;

            if (animated) {
                container.animate({ 'visibility' : 'visible','y' : (y_val)*RS });
            } else {
                container.attr({ 'visibility' : 'visible','y' : (y_val)*RS });                
            }
            
            if (this.navigation) {
                var grow_scale = this.grow_container ? 1 / this.zoom : 1;
                this.navigation.renderTrack(MASCP.getLayer(name), (y_val)*RS , RS * track_height, { 'font-scale' : ((container.track_height / track_height) * 3 * grow_scale) } );
            }
            track_heights += (this.zoom * track_height) + this.trackGap;
        } else {
            y_val = this._axis_height + track_heights / this.zoom;
            if (animated) {
                container.animate({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });
            } else {
                container.attr({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });                
            }
            if (this.navigation) {
                y_val -= 1*container.track_height/this.zoom;
                this.navigation.renderTrack(MASCP.getLayer(name), y_val*RS , RS * 3 * container.track_height / this.zoom, fixed_font_scale ? { 'font-scale' : fixed_font_scale } : null );
                track_heights += container.track_height;
            }
            track_heights += container.track_height + this.trackGap;
        }

        container.refresh_zoom();

    }
    this.wireframe();
    
    var viewBox = [-1,0,0,0];
    viewBox[0] = -2*RS;
    viewBox[2] = (this.sequence.split('').length+(this.padding)+2)*RS;
    viewBox[3] = (this._axis_height + (track_heights / this.zoom)+ (this.padding))*RS;
    this._canvas.setAttribute('viewBox', viewBox.join(' '));
    this._canvas._canvas_height = viewBox[3];


    var outer_viewbox = [].concat(viewBox);

    outer_viewbox[0] = 0;
    outer_viewbox[2] = (this.zoom)*(2*this.sequence.length)+(this.padding);
    outer_viewbox[3] = (this.zoom)*2*(this._axis_height + (track_heights / this.zoom)+ (this.padding));
    if (! this.grow_container ) {
        this._container_canvas.setAttribute('viewBox', outer_viewbox.join(' '));
    }

    this._resizeContainer();

    viewBox[0] = 0;
    if (this.navigation) {

        if (this.navigation.visible()) {
            this._canvas.style.GomapScrollLeftMargin = 100 * RS / this.zoom;
        } else {
            this._canvas.style.GomapScrollLeftMargin = 1000;            
        }
        this.navigation.setViewBox(viewBox.join(' '));
    }

    if (this.navigation) {
        this.navigation.refresh();
    }

};

})(MASCP.CondensedSequenceRenderer);

/**
 * Zoom level has changed for this renderer
 * @name    MASCP.CondensedSequenceRenderer#zoomChange
 * @event
 * @param   {Object}    e
 */

MASCP.CondensedSequenceRenderer.Zoom = function(renderer) {

/**
 *  @lends MASCP.CondensedSequenceRenderer.prototype
 *  @property   {Number}    zoom        The zoom level for a renderer. Minimum zoom level is zero, and defaults to the default zoom value
 *  @property   {Array}     trackOrder  The order of tracks on the renderer, an array of layer/group names.
 *  @property   {Number}    padding     Padding to apply to the right and top of plots (default 10).
 *  @property   {Number}    trackGap    Vertical gap between tracks (default 10)
 */
    var timeout = null;
    var start_zoom = null;
    var zoom_level = null;
    var center_residue = null;
    var start_x = null;
    var accessors = { 
        setZoom: function(zoomLevel) {
            var min_zoom_level = renderer.sequence ? (0.3 / 2) * window.innerWidth / renderer.sequence.length : 0.5;
            if (zoomLevel < min_zoom_level) {
                zoomLevel = min_zoom_level;
            }
            if (zoomLevel > 10) {
                zoomLevel = 10;
            }

            if (zoomLevel == zoom_level) {
                return;
            }

            var self = this;

            if (! self._canvas) {
                return;
            }

            var no_touch_center = false;

            if (self.zoomCenter == 'center') {
                no_touch_center = true;
                self.zoomCenter = {'x' : self._RS*0.5*(self.leftVisibleResidue()+self.rightVisibleResidue()) };
            }
            
            if ( self.zoomCenter && ! center_residue ) {
                start_x = self._canvas.currentTranslate.x || 0;
                center_residue = self.zoomCenter ? self.zoomCenter.x : 0;
            } else if (center_residue && ! self.zoomCenter ) {
                // We should not be zooming if there is a center residue and no zoomCenter;
                return;
            }

            if ( timeout ) {
                clearTimeout(timeout);
            } else {
                start_zoom = parseFloat(zoom_level || 1);
            }

            zoom_level = parseFloat(zoomLevel);        


            var curr_transform = self._canvas.parentNode.getAttribute('transform') || '';
            curr_transform = curr_transform.replace(/scale\([^\)]+\)/,'');
            var scale_value = Math.abs(parseFloat(zoomLevel)/start_zoom);
            curr_transform = 'scale('+scale_value+') '+(curr_transform || '');
            self._canvas.parentNode.setAttribute('transform',curr_transform);
            jQuery(self._canvas).trigger('_anim_begin');
            if (document.createEvent) {
                evObj = document.createEvent('Events');
                evObj.initEvent('panstart',false,true);
                self._canvas.dispatchEvent(evObj);
            }
            var old_x = self._canvas.currentTranslate.x;
            if (center_residue) {
                var delta = ((start_zoom - zoom_level)/(scale_value*25))*center_residue;
                delta += start_x/(scale_value);
                self._canvas.setCurrentTranslateXY(delta,0);
            }
        
            var end_function = function() {
                timeout = null;
                var scale_value = Math.abs(parseFloat(zoom_level)/start_zoom);

                var curr_transform = self._canvas.parentNode.getAttribute('transform') || '';
                curr_transform = curr_transform.replace(/scale\([^\)]+\)/,'');
                self._canvas.parentNode.setAttribute('transform',curr_transform);

                bean.fire(self._canvas,'panend');
                jQuery(self._canvas).trigger('_anim_end');

                jQuery(self._canvas).one('zoomChange',function() {
                    self.refresh();
                    if (typeof center_residue != 'undefined') {
                        var delta = ((start_zoom - zoom_level)/(25))*center_residue;
                        delta += start_x;

                        self._resizeContainer();

                        if (self._canvas.shiftPosition) {
                            self._canvas.shiftPosition(delta,0);
                        } else {
                            self._canvas.setCurrentTranslateXY(delta,0);
                        }
                    }
                    center_residue = null;
                    start_x = null;              
                });
            
                if (self._canvas) {
                    self._canvas.zoom = parseFloat(zoom_level);
                    if (document.createEvent) {
                        var evObj = document.createEvent('Events');
                        evObj.initEvent('zoomChange',false,true);
                        self._canvas.dispatchEvent(evObj);
                    } else {
                        jQuery(self._canvas).trigger('zoomChange');
                    }
                }
                jQuery(self).trigger('zoomChange');
            };
        
            if (("ontouchend" in document) && self.zoomCenter && ! no_touch_center ) {
                jQuery(self).unbind('gestureend');
                jQuery(self).one('gestureend',end_function);
                timeout = 1;
            } else {
                if (! this.refresh.suspended) {
                    timeout = setTimeout(end_function,100);
                } else {
                    end_function();
                }
            }
        },

        getZoom: function() {
            return zoom_level || 1;
        }
    };

    if (Object.defineProperty && ! MASCP.IE8) {
        Object.defineProperty(renderer,"zoom", {
            get : accessors.getZoom,
            set : accessors.setZoom
        });
    }

};

/* Add some properties that will trigger a refresh on the renderer when they are changed.
   These are all stateless
 */

(function(clazz) {

    var accessors = {
        getPadding: function() {
            return this._padding || 10;
        },

        setPadding: function(padding) {
            this._padding = padding;
            this.refresh();
        },

        getTrackGap: function() {
            if (! this._track_gap){
                var default_value = ("ontouchend" in document) ? 20 : 10;
                this._track_gap = this._track_gap || default_value;
            }

            return this._track_gap;
        },

        setTrackGap: function(trackGap) {
            this._track_gap = trackGap;
            this.refresh();
        }
    };

    if (Object.defineProperty && ! MASCP.IE8 ) {
        Object.defineProperty(clazz.prototype,"padding", {
            get : accessors.getPadding,
            set : accessors.setPadding
        });
        Object.defineProperty(clazz.prototype,"trackGap", {
            get : accessors.getTrackGap,
            set : accessors.setTrackGap
        });
    }
    
})(MASCP.CondensedSequenceRenderer);

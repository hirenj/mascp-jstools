/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
 */

import MASCP from './MASCP';
import SequenceRenderer from './SequenceRenderer';
import Navigation from './CondensedSequenceRendererNavigation';
import bean from '../bean';
import SVGCanvas from './SVGCanvas';

const svgns = 'http://www.w3.org/2000/svg';

/** Default class constructor
 *  @class      Renders a sequence using a condensed track-based display
 *  @param      {Element} sequenceContainer Container element that the sequence currently is found in, and also 
 *              the container that data will be re-inserted into.
 *  @extends    MASCP.SequenceRenderer
 */
const CondensedSequenceRenderer = function(sequenceContainer) {
    this._RS = 50;
    SequenceRenderer.apply(this,arguments);
    var self = this;

    // Create a common layer for the primary sequence
    MASCP.registerLayer('primarySequence', { 'fullname' : 'Primary Sequence' });


    CondensedSequenceRenderer.Zoom(self);
    var resizeTimeout;
    var resize_callback = function() {
        sequenceContainer.cached_width = sequenceContainer.getBoundingClientRect().width;
    };
    window.addEventListener('resize',function() {
        clearTimeout(resizeTimeout);
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(resize_callback)
        } else {
            resizeTimeout = setTimeout(resize_callback,100);
        }
    },true);
    sequenceContainer.cached_width = sequenceContainer.getBoundingClientRect().width;

    // We want to unbind the default handler for sequence change that we get from
    // inheriting from CondensedSequenceRenderer
    bean.remove(this,'sequenceChange');

    bean.add(this,'sequenceChange',function() {
        for (var layername in MASCP.layers) {
            if (MASCP.layers.hasOwnProperty(layername)) {
                MASCP.layers[layername].disabled = true;
            }
        }
        self.zoom = self.zoom;
    });

    return this;
};

CondensedSequenceRenderer.prototype = new SequenceRenderer();

(function(clazz) {
    var createCanvasObject = function() {
        var renderer = this;

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
            var native_canvas = this.win().document.createElementNS(svgns,'svg');
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
            if (renderer.font_order) {
                container_canv.font_order = renderer.font_order;
            }
            var group = container_canv.makeEl('g');
        
            var canv = container_canv.makeEl('svg');
            canv.RS = renderer._RS;
            SVGCanvas(canv);
            if (renderer.font_order) {
                canv.font_order = renderer.font_order;
            }
            group.appendChild(canv);
            container_canv.appendChild(group);

            var supports_events = true;

            try {
                var noop = canv.addEventListener;
            } catch (err) {
                supports_events = false;
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
                                                                'width':'25',
                                                                'height':'100%',
                                                                'transform':'translate(-15,0)',
                                                                'style':'fill: url(#right_fade);'});

            container_canv.appendChild(left_fade);
            container_canv.appendChild(right_fade);

            bean.add(canv,'pan',function() {
                if (canv.currentTranslateCache.x >= 0) {
                    left_fade.setAttribute('visibility','hidden');
                } else {
                    left_fade.setAttribute('visibility','visible');
                }
                if (renderer.rightVisibleResidue() < renderer.sequence.length) {
                    right_fade.setAttribute('visibility','visible');
                } else {
                    right_fade.setAttribute('visibility','hidden');
                }
            });
        
            bean.add(canv,'_anim_begin',function() {
                left_fade.setAttribute('visibility','hidden');
                right_fade.setAttribute('visibility','hidden');
            });
        
            bean.add(canv,'_anim_end',function() {
                bean.fire(canv,'pan');
            });


            canv.currentTranslateCache = { x: 0, y: 0 };

            if (canv.currentTranslateCache.x >= 0) {
                left_fade.setAttribute('visibility','hidden');
            }
            right_fade.setAttribute('visibility','hidden');

            var nav_group = container_canv.makeEl('g');
            container_canv.appendChild(nav_group);
            var nav_canvas = container_canv.makeEl('svg');
            nav_group.appendChild(nav_canvas);

            group.style.willChange = 'transform';

           canv.setScale = function(scale) {
                var curr_transform = (group._cached_transform || '' ).replace(/scale\([^\)]+\)/,'');
                if (scale !== null) {
                    curr_transform = (' scale('+scale+') ' + curr_transform ).replace(/\s+/g,' ');
                }
                group._cached_transform = curr_transform;
                group.style.transform = curr_transform;
            };

           nav_canvas.setScale = function(scale) {
                var curr_transform = (nav_group._cached_transform || '' ).replace(/scale\([^\)]+\)/,'');
                if (scale !== null) {
                    curr_transform = (curr_transform + ' scale('+scale+') ').replace(/\s+/g,' ');
                }
                nav_group._cached_transform = curr_transform;
                nav_group.style.transform = curr_transform;
            };
            bean.add(canv,'zoomChange', () => {
                if ( ! renderer.fixed_size ) {
                    return;
                }
                canv.setScale(1);
                nav_canvas.setScale(1);
                requestAnimationFrame(() => {
                    let container_height = container_canv.getBoundingClientRect().height;
                    let canv_height = canv.getBoundingClientRect().height;
                    let current_scale = (group._cached_transform || 'scale(1)').match(/scale\(([\d\.]+)\)/) || '1';
                    canv.setScale((1*container_height / canv_height).toFixed(2));
                    nav_canvas.setScale((1*container_height / canv_height).toFixed(2));
                });
            });


            var ua = window.navigator.userAgent;
            var is_explorer = false;
            if (ua.indexOf('Edge/') >= 0) {
                is_explorer = true;
            }


           canv.setCurrentTranslateXY = function(x,y) {
                var curr_transform = group._cached_transform || '';
                curr_transform = (curr_transform.replace(/translate\([^\)]+\)/,'') + ' translate('+x+'px, '+y+'px) ').replace(/\s+/g,' ');
                group._cached_transform = curr_transform;
                if ( ! is_explorer ) {
                    group.style.transform = curr_transform;
                } else {
                    group.setAttribute('transform',curr_transform.replace(/px/g,''));
                }

                this.currentTranslateCache.x = x;
                this.currentTranslateCache.y = y;
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
                old_show.apply(nav,arguments);
                canv.style.GomapScrollLeftMargin = 100 * renderer._RS / renderer.zoom;
            };
        
            nav.hide = function() {
                old_hide.apply(nav,arguments);
                canv.style.GomapScrollLeftMargin = 1000;
            };
        
            renderer._container_canvas = container_canv;
            container_canv.setAttribute('preserveAspectRatio','xMinYMin meet');
            container_canv.setAttribute('width','100%');
            container_canv.setAttribute('height','100%');
            canv.appendChild(canv.makeEl('rect', {'x':0,'y':0,'opacity': 0,'width':'100%','height':'100%','stroke-width':'0','fill':'#ffffff'}));
            renderer._object = this;
            renderer._canvas = canv;
            renderer._canvas._canvas_height = 0;
            bean.fire(renderer,'svgready');
        },false);
    
        return canvas;
    };

    var wheel_fn = function(e) {
        e.stopPropagation();
        return true;
    };

    var addNav = function(nav_canvas) {
        this.navigation = new CondensedSequenceRenderer.Navigation(nav_canvas,this);
        var nav = this.navigation;
        var self = this;
    
        var hide_chrome = function() {
            nav.demote(); 
        };
    
        var show_chrome = function() {
            nav.promote();
            nav.refresh();
        };

        if ( ! MASCP.IE ) {
        bean.add(this._canvas,'panstart',hide_chrome);
        bean.add(this._canvas,'panend',show_chrome);
        bean.add(this._canvas,'_anim_begin',hide_chrome);
        bean.add(this._canvas,'_anim_end',show_chrome);
        nav_canvas.addEventListener('DOMMouseScroll',wheel_fn,false);
        nav_canvas.addEventListener('wheel',wheel_fn,false);
        nav_canvas.onmousewheel = wheel_fn;

        }
    };
    var drawAminoAcids = function() {
        var renderer = this;
        var aas = renderer.addTextTrack(this.sequence,this._canvas.set());
        aas.attr({'y' : 0.5*renderer._axis_height*renderer._RS});
        renderer.select = function() {
            var vals = Array.prototype.slice.call(arguments);
            var from = vals[0];
            var to = vals[1];
            this.moveHighlight.apply(this,vals);
        };
        var zoomchange = function() {
            aas.attr({'y' : 0.5*renderer._axis_height*renderer._RS});
        };
        var canvas = renderer._canvas;
        bean.add(canvas,'zoomChange', zoomchange);
        bean.add(aas,'removed',function() {
            bean.remove(canvas,'zoomChange',zoomchange);
        });
        return aas;
    };
    var mainDrawAxis;
    var drawAxis = mainDrawAxis = function(canvas,lineLength) {
        var RS = this._RS;
        var self = this;
        var x = 0, i = 0;
    
    
        var axis = canvas.set();

        var axis_back = canvas.rect(0,0,lineLength,1.5);
        axis_back.setAttribute('fill',"url('#"+self.axis_pattern_id+"')");
        axis_back.removeAttribute('stroke');
        axis_back.removeAttribute('stroke-width');
        axis_back.setAttribute('id','axis_back');

        var base_axis_height = 30;

        var all_labels = canvas.set();
        var major_mark_labels = canvas.set();
        var minor_mark_labels = canvas.set();
        var thousand_mark_labels = canvas.set();
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

            var a_text = canvas.text(x-0.5,0,""+(x));
            all_labels.push(a_text);

            if ( (x % major_mark) === 0 && x !== 0) {
                major_mark_labels.push(a_text);
            } else if (( x % minor_mark ) === 0 && x !== 0) {
                minor_mark_labels.push(a_text);
            }
            if ( (x % (250*parseInt(this.sequence.length / 500))) === 0 && x !== 0) {
                thousand_mark_labels.push(a_text);
            }
            x += 5;
        }
    
        for ( i = 0; i < all_labels.length; i++ ) {
            all_labels[i].style.textAnchor = 'middle';
            all_labels[i].firstChild.setAttribute('dy','1.5ex');
        }
    
        all_labels.attr({'pointer-events' : 'none', 'text-anchor' : 'middle', 'font-size' : 7*RS+'pt'});
        all_labels.hide();

       self._axis_height = parseInt( base_axis_height / self.zoom);

    
        var zoom_status = null;
        var zoomchange = function() {
            var renderer = self;
               renderer._axis_height = parseInt( base_axis_height / renderer.zoom);
               var pattern = renderer._canvas.ownerSVGElement.getElementById(renderer.axis_pattern_id);

               thousand_mark_labels.forEach(function(label) {
                label.setAttribute('visibility','hidden');
               });

               if (this.zoom > 3.6) {
                   axis_back.setAttribute('transform','translate(-5,'+(0.3*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.25*renderer._axis_height*RS);
                   pattern.setAttribute('width',10*RS);
                   pattern.firstChild.setAttribute('x',9.5*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom);

                   minor_mark_labels.show();
                   major_mark_labels.show();
                   var text_scale = 0.15*self._axis_height;
                   if (text_scale < 1) {
                    text_scale = 1;
                   }
                   minor_mark_labels.attr({ 'font-size' : (text_scale*RS)+'pt', 'text-anchor' : 'end' });
                   major_mark_labels.attr({ 'font-size' : (text_scale*RS)+'pt', 'text-anchor' : 'end' });
                   if (this._visibleTracers && this._visibleTracers()) {
                       this._visibleTracers().show();
                   }
               } else if (this.zoom > 1.8) {

                   minor_mark_labels.hide();
                   major_mark_labels.show();
                   major_mark_labels.attr({ 'font-size' : (0.5*RS*self._axis_height)+'pt', 'text-anchor' : 'middle' });
                   axis_back.setAttribute('transform','translate(-25,'+(0.5*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.3*renderer._axis_height*RS);
                   pattern.setAttribute('width',20*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom );
                   pattern.firstChild.setAttribute('x','0');
                   if (this.tracers) {
                       this.tracers.hide();
                   }
               } else if (this.zoom > 0.2) {

                   if (this.tracers) {
                       this.tracers.hide();
                   }
                   minor_mark_labels.hide();
                   major_mark_labels.show();
                   major_mark_labels.attr({ 'font-size' : (0.5*RS*self._axis_height)+'pt', 'text-anchor' : 'middle' });
                   axis_back.setAttribute('transform','translate(-25,'+(0.5*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.3*renderer._axis_height*RS);
                   pattern.setAttribute('width',50*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom);



                   var last_right = -10000;
                   var changed = false;
                   major_mark_labels.forEach(function(label) {
                    if ( ! label.cached_bbox) {
                        label.cached_bbox = label.getBBox();
                    }
                    if (label.cached_bbox.x <= (last_right+(RS*10)) || (parseInt(label.textContent) % 50) != 0) {
                        label.setAttribute('visibility','hidden');
                        changed = true;
                    } else {
                        label.setAttribute('visibility','visible');
                        last_right = label.cached_bbox.x + label.cached_bbox.width;
                    }
                   });
                   if (changed) {
                    major_mark_labels[0].setAttribute('visibility','hidden');
                   }
               } else {
                   if (this.tracers) {
                       this.tracers.hide();
                   }
                   minor_mark_labels.hide();
                   major_mark_labels.hide();
                   thousand_mark_labels.show();
                   thousand_mark_labels.attr({ 'font-size' : (0.5*RS*self._axis_height)+'pt', 'text-anchor' : 'middle' });

                   axis_back.setAttribute('transform','translate(-50,'+(0.85*renderer._axis_height*RS)+')');
                   axis_back.setAttribute('height',0.1*renderer._axis_height*RS);
                   pattern.setAttribute('width',250*RS);
                   pattern.firstChild.setAttribute('width',RS / renderer.zoom);


                   var last_right = -10000;
                   var changed = false;
                   thousand_mark_labels.forEach(function(label) {
                    if ( ! label.cached_bbox) {
                        label.cached_bbox = label.getBBox();
                    }
                    if (label.cached_bbox.x <= (last_right+(RS*10)) || (parseInt(label.textContent) % 250) != 0) {
                        label.setAttribute('visibility','hidden');
                    } else {
                        label.setAttribute('visibility','visible');
                        last_right = label.cached_bbox.x + label.cached_bbox.width;
                    }
                   });
                   if (changed) {
                    thousand_mark_labels[0].setAttribute('visibility','hidden');
                   }
               }
        };
        bean.add(canvas,'zoomChange', zoomchange);
        bean.add(axis,'removed',function() {
            bean.remove(canvas,'zoomChange',zoomchange);
            var remover = function(el) {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            };
            axis_back.parentNode.removeChild(axis_back);
            all_labels.forEach(remover);

        });
        return axis;
    };

    clazz.prototype.panTo = function(end,callback) {
        var renderer = this;
        var pos = renderer.leftVisibleResidue();
        var delta = 1;
        if (pos == end) {
            if (callback) {
                callback.call(null);
            }
            return;
        }
        if (pos > end) {
            delta = -1;
        }
        requestAnimationFrame(function() {
            renderer.setLeftVisibleResidue(pos);
            pos += delta;
            bean.fire(renderer._canvas,'panend');
            if (pos !== end) {
                requestAnimationFrame(arguments.callee);
            } else {
                if (callback) {
                    callback.call(null);
                }
            }
        });
    };

    clazz.prototype.zoomTo = function(zoom,residue,callback) {
        var renderer = this;
        var curr = renderer.zoom;
        var delta = (zoom - curr)/50;
        let zoomchange = function() {
            bean.remove(renderer,'zoomChange',zoomchange);
            delete renderer.zoomCenter;
            if (callback) {
                callback.call(null);
            }
        };
        bean.add(renderer,'zoomChange',zoomchange);
        if (residue) {
            renderer.zoomCenter = (residue == 'center') ? residue : { 'x' : renderer._RS*residue };
        } else {
            renderer.zoom = zoom;
            return;
        }
        requestAnimationFrame(function() {
            renderer.zoom = curr;
            curr += delta;
            if (Math.abs(curr - zoom) > 0.01) {
                requestAnimationFrame(arguments.callee);
            }
        });
    };

    clazz.prototype.setLeftVisibleResidue = function(val) {
        var self = this;
        self._canvas.setCurrentTranslateXY((self._canvas.width.baseVal.value * (1 - (val / (self.sequence.length+self.padding+2)))) - self._canvas.width.baseVal.value,0);
    };

    clazz.prototype.leftVisibleResidue = function() {
        var self = this;
        var val = Math.floor((self.sequence.length+self.padding+2)*(1-((self._canvas.width.baseVal.value + self._canvas.currentTranslateCache.x) / self._canvas.width.baseVal.value)))-1;
        if (val < 0) {
            val = 0;
        }
        return val;
    };

    clazz.prototype.rightVisibleResidue = function() {
        var self = this;
        var container_width = self._container_canvas.parentNode.cached_width;
        if ( ! container_width ) {
            container_width = self._container_canvas.parentNode.getBoundingClientRect().width;
        }
        var val = Math.floor(self.leftVisibleResidue() + (self.sequence.length+self.padding+2)*(container_width/ self._canvas.width.baseVal.value));
        if (val > self.sequence.length) {
            val = self.sequence.length;
        }
        return val;
    };

    clazz.prototype.addAxisScale = function(identifier,scaler) {
        if ( ! this._scalers ) {
            this._scalers = [];
        }
        let scalers = this._scalers.filter( scale => scale.identifier !== identifier );
        scalers.push(scaler);
        this._scalers = scalers;
        scaler.identifier = identifier;
        return scaler;
    };

    clazz.prototype.refreshScale = function() {
        var self = this;
        var lays = Object.keys(this._layer_containers);
        lays.forEach(function(lay) {
            self._layer_containers[lay].forEach(function(el) {
                if (el.move && el.aa) {
                    var aa = self.scalePosition(el.aa,lay);
                    var aa_width = self.scalePosition(el.aa+el.aa_width,lay) ;
                    if (aa < 0) {
                        aa *= -1;
                    }
                    if (aa_width < 0) {
                        aa_width *= -1;
                    }
                    el.move(aa-1,aa_width-aa);
                }
            });
        });
    };

    clazz.prototype.scalePosition = function(aa,layer,inverse) {
        var layer_obj = MASCP.getLayer(layer);
        if ( ! layer_obj ) {
            console.log('Missing layer object for layer identifier',layer,'making dummy layer scaled with identifier',layer);
            layer_obj = { 'name' : layer, 'scales' : new Set() };
            layer_obj.scales.add(layer);
        }
        let scaler_funcs = (this._scalers || []).concat([]);
        var new_aa = (inverse ? scaler_funcs.reverse() : scaler_funcs).reduce((val,fn) => {  return fn(val,layer_obj,inverse); },aa);
        return new_aa;
    };

    clazz.prototype.getAA = function(aa,layer,scale_name) {
        return this.getAminoAcidsByPosition([aa],layer,scale_name).shift();
    };

    clazz.prototype.getAminoAcidsByPosition = function(aas,layer) {
        var self = this;
        var new_aas = aas.map(function(aa) { return Math.abs(self.scalePosition(aa,layer)); });
        var results = SequenceRenderer.prototype.getAminoAcidsByPosition.call(this,new_aas);

        for (var i = 0; i < new_aas.length; i++) {
            if (results[i]) {
                results[i].original_index = aas[i];
            }
        }
        return results;
    };

    clazz.prototype.getAminoAcidsByPeptide = function(peptide,layer) {
        layer = MASCP.getLayer(layer);
        var self = this;
        var positions = [];
        var self_seq;
        var identifier = layer.accession;
        if (self.sequences) {
            self_seq = self.sequences [ ( self.sequences.map(function(seq) {  return (seq.agi || seq.acc || "").toLowerCase();  }) ).indexOf(identifier.toLowerCase()) ].toString();
        } else {
            self_seq = self.sequence;
        }
        var start = self_seq.indexOf(peptide);
        for (var i = 0; i < peptide.length; i++ ) {
            positions.push(start+i);
        }
        var results = self.getAminoAcidsByPosition(positions,layer);
        if (results.length) {
            results.addToLayer = function(layername, fraction, options) {
                return results[0].addBoxOverlay(layername,results.length,fraction,options);
            };
        } else {
            results.addToLayer = function() {};
        }
        return results;
    };

    clazz.prototype.win = function() {
        if (this._container && this._container.ownerDocument && this._container.ownerDocument.defaultView) {
            var return_val = this._container.ownerDocument.defaultView;
            if (typeof return_val === 'object' && return_val.constructor !== Window ) {
                return_val = return_val[Object.keys(return_val)[0]];
            }
            return return_val;
        }
        return null;
    };


    clazz.prototype.setSequence = function(sequence) {
        var new_sequence = this._cleanSequence(sequence);
        if (new_sequence == this.sequence && new_sequence !== null) {
            bean.fire(this,'sequenceChange');
            return;
        }
    
        if (! new_sequence) {
            return;
        }
    
        this.sequence = new_sequence;

        delete this.sequences;

        var seq_chars = this.sequence.split('');
        var line_length = seq_chars.length;

        if (line_length === 0) {
            return;
        }

        var renderer = this;


        var build_sequence_els = function() {
            var seq_els = [];
            renderer.sequence.split('').forEach( function(aa,i) {
                var el = {};
                el._index = i;
                el._renderer = renderer;
                renderer._extendElement(el);
                el.amino_acid = aa;
                seq_els.push(el);
            });
            renderer._sequence_els = seq_els;
        };

        build_sequence_els();

        var RS = this._RS;

        bean.remove(this,'svgready');
        bean.add(this,'svgready',function(cnv) {
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
        
            renderer.gradients = [];
            renderer.add3dGradient = function(color) {
                defs.appendChild(canv.make_gradient('grad_'+color,'0%','100%',[color,'#ffffff',color],[1,1,1] ));
                renderer.gradients.push(color);
            };

            var shadow = canv.makeEl('filter',{
                'id':'drop_shadow',
                'filterUnits':'objectBoundingBox',
                'x': '-50%',
                'y': '-50%',
                'width':'200%',
                'height':'200%'
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
            var axis_pattern_id = 'axis_pattern_'+(new Date()).getTime();
            var pattern = canv.makeEl('pattern', {
                'patternUnits' : 'userSpaceOnUse',
                'x'            : '0',
                'y'            : '0',
                'width'        : 10*canv.RS,
                'height'       : 2*canv.RS,
                'id'           : axis_pattern_id
            });
            renderer.axis_pattern_id = axis_pattern_id;

            var line = canv.makeEl('rect',{
                'x'     : '0',
                'y'     : '0',
                'width' : '10%',
                'height': '1000%',
                'fill'  : '#000',
                'stroke': '0',
            });
            pattern.appendChild(line);

            defs.appendChild(pattern);

            var self = this;
            renderer._axis_height = 10;
            var aas = drawAminoAcids.call(self,canv);
            renderer.hideAxis = function() {
                drawAxis = function(canv) {
                    bean.add(canv, 'zoomChange', function() {
                        self._axis_height = 10 / self.zoom;
                    });
                    return {};
                };
                self._axis_height = 10 / self.zoom;
                this.redrawAxis();
            };
            renderer.showAxis = function() {
                drawAxis = mainDrawAxis;
                this.redrawAxis();
            };

            var axis = drawAxis.call(self,canv,line_length);
            renderer.redrawAxis = function() {
                bean.fire(axis,'removed');
                aas.forEach(function(aa) {
                    if (aa.parentNode) {
                        aa.parentNode.removeChild(aa);
                    }
                });
                bean.fire(aas,'removed');
                axis = drawAxis.call(self,canv,renderer.sequence.length);
                aas = drawAminoAcids.call(self,canv);

                build_sequence_els();
                renderer.refresh();
            };
            if ( ! renderer.hide_axis ) {
                this.showAxis();
            } else {
                this.hideAxis();
            }

            renderer._layer_containers = {};
            renderer.enablePrintResizing();
            renderer.enableScaling();
            renderer.enableSelection();

            // When we have a layer registered with the global MASCP object
            // add a track within this renderer.
            bean.add(MASCP,'layerRegistered', function(layer,rend) {
                if (! rend || rend === renderer) {
                    renderer.addTrack(layer);
                }
            });

            bean.fire(renderer,'sequenceChange');
        });
        var canvas = createCanvasObject.call(this);
        if (! this._canvas) {
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
                bean.add(rend,'sequenceChange',function() {
                    bean.remove(rend,'sequenceChange',arguments.callee);
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

})(CondensedSequenceRenderer);


(function() {
    var svgns = 'http://www.w3.org/2000/svg';
    var add_import = function(ownerdoc) {
        if (!ownerdoc.ELEMENT_NODE) {
          ownerdoc.ELEMENT_NODE = 1;
          ownerdoc.ATTRIBUTE_NODE = 2;
          ownerdoc.TEXT_NODE = 3;
          ownerdoc.CDATA_SECTION_NODE = 4;
          ownerdoc.ENTITY_REFERENCE_NODE = 5;
          ownerdoc.ENTITY_NODE = 6;
          ownerdoc.PROCESSING_INSTRUCTION_NODE = 7;
          ownerdoc.COMMENT_NODE = 8;
          ownerdoc.DOCUMENT_NODE = 9;
          ownerdoc.DOCUMENT_TYPE_NODE = 10;
          ownerdoc.DOCUMENT_FRAGMENT_NODE = 11;
          ownerdoc.NOTATION_NODE = 12;
        }

        ownerdoc._importNode = function(node, allChildren) {
          switch (node.nodeType) {
            case ownerdoc.ELEMENT_NODE:
              var newNode = ownerdoc.createElementNS(svgns,node.nodeName);
              /* does the node have any attributes to add? */
              if (node.attributes && node.attributes.length > 0)
                for (var i = 0, il = node.attributes.length; i < il;) {
                  if (! /^on/.test(node.attributes[i].nodeName)) {
                      newNode.setAttribute(node.attributes[i].nodeName, node.getAttribute(node.attributes[i++].nodeName));
                  }
                }
              /* are we going after children too, and does the node have any? */
              if (allChildren && node.childNodes && node.childNodes.length > 0)
                for (var i = 0, il = node.childNodes.length; i < il;) {
                  if (node.childNodes[i].nodeName !== 'USE' && node.childNodes[i].nodeName.toUpperCase() !== 'SCRIPT') {
                      newNode.appendChild(ownerdoc._importNode(node.childNodes[i++], allChildren));
                  }
                }
              return newNode;
              break;
            case ownerdoc.TEXT_NODE:
            case ownerdoc.CDATA_SECTION_NODE:
            case ownerdoc.COMMENT_NODE:
              return ownerdoc.createTextNode(node.nodeValue);
              break;
          }
        };
    };

    var fix_child_links = function(node,prefix) {
      if (node.childNodes && node.childNodes.length > 0) {
        for (var i = 0, il = node.childNodes.length; i < il;) {
          if (node.childNodes[i].nodeName.toUpperCase() === 'USE') {
            var linkval = node.childNodes[i].getAttribute('xlink:href');
            node.childNodes[i].setAttribute('xlink:href',linkval.replace(/^#/,'#'+prefix+'_'));
          }
          i++;
        }
      }
    };

    CondensedSequenceRenderer.prototype.importIcons = function(namespace,doc,alt_url) {
        var new_owner = this._container_canvas.ownerDocument;
        if (this._container_canvas.getElementById('defs_'+namespace)){
            return;
        }
        this._container_canvas.appendChild(new_owner.createElement('defs'));
        this._container_canvas.lastChild.setAttribute('id','defs_'+namespace);
        var defs_block = this._container_canvas.lastChild;

        if ( ! new_owner._importNode ) {
            add_import(new_owner);
        }
        var ua = window.navigator.userAgent;
        if (ua.indexOf('Edge/') >= 0) {
            this.icons_failed = this.icons_failed || {};
            this.icons_failed[namespace] = alt_url;
            return;
        }
        var new_nodes = new_owner._importNode(doc,true);
        if (typeof XPathResult !== 'undefined') {
            var iterator = new_owner.evaluate('//svg:defs/*',new_nodes,function(ns) { return svgns; } ,XPathResult.ANY_TYPE,null);
            var el = iterator.iterateNext();
            var to_append = [];
            while (el) {
                to_append.push(el);
                el = iterator.iterateNext();
            }
            if (to_append.length === 0) {
                this.icons_failed = this.icons_failed || {};
                this.icons_failed[namespace] = alt_url;
            }
            to_append.forEach(function(el) {
                el.setAttribute('id',namespace+'_'+el.getAttribute('id'));
                fix_child_links(el,namespace);
                defs_block.appendChild(el);
            });
        } else {
            var els = new_nodes.querySelectorAll('defs > *');
            for (var i = 0 ; i < els.length; i++ ) {
                els[i].setAttribute('id',namespace+'_'+els[i].getAttribute('id'));
                fix_child_links(el,namespace);
                defs_block.appendChild(els[i]);
            }
        }
    };

})();


CondensedSequenceRenderer.prototype.addValuesToLayer = function(layerName,values,options) {
    var RS = this._RS;
    
    var canvas = this._canvas;
    
    if ( ! canvas ) {        
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);
            orig_func.call(self,layerName,values);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    var max_value;
    var min_value;
    var height_scale = 1;
    
    options = options || {};

    if (options.height) {
        height_scale = options.height / this._layer_containers[layerName].track_height;
    }

    var offset_scale = 0;
    if (options.offset) {
        offset_scale = options.offset / this._layer_containers[layerName].track_height;
    }
    var recalculate_plot  = function(scale) {
        var plot_path = ' m'+(-0.5*RS)+' 0';
        var last_value = null;
        values.forEach(function(value) {
            if ( typeof(last_value) == 'undefined' ) {
            } else {
                plot_path += ' l'+RS+' '+(-1 *RS*scale*height_scale*(value - last_value));
            }
            last_value = value;
            if (isNaN(max_value) || (value > max_value)) {
                max_value = value;
            }
            if (isNaN(min_value) || (value < min_value)) {
                min_value = value;
            }
        });
        return plot_path;
    };
    var plot = this._canvas.path('M0 0 M0 0 m0 '+((max_value || 0))*RS+' '+recalculate_plot(1));
    var abs_min_val = min_value;
    var abs_max_val = max_value;
    plot.setAttribute('stroke',options.color || '#ff0000');
    plot.setAttribute('stroke-width', (options.thickness || 0.35)*RS);
    plot.setAttribute('fill', 'none');
    plot.setAttribute('visibility','hidden');
    plot.setAttribute('pointer-events','none');
    this._layer_containers[layerName].push(plot);
    plot.setAttribute('transform','translate(1,10) scale(1,1)');
    if (! options.hide_axis) {
        var axis = this._canvas.path('M0 0 m0 '+(RS*((max_value || 0) - (min_value || 0)))+' l'+this._sequence_els.length*RS+' 0');
        axis.setAttribute('stroke-width',0.2*RS);
        axis.setAttribute('visibility','hidden');
        axis.setAttribute('transform','translate(1,0)');
        axis.setAttribute('pointer-events','none');
        axis.setHeight = function(height) {
            if (abs_min_val < 0 && abs_max_val > 0) {
                axis.setAttribute('d','M0 0 M0 0 m0 '+(height*offset_scale)+' m0 '+(0.5*height*height_scale)+' l'+renderer._sequence_els.length*RS+' 0');
            } else {
                axis.setAttribute('d','M0 0 M0 0 m0 '+(height*offset_scale)+' m0 '+(0.5*(1-abs_min_val)*height*height_scale)+' l'+renderer._sequence_els.length*RS+' 0');
            }
            axis.setAttribute('stroke-width',0.2*RS/renderer.zoom);
        };
        this._layer_containers[layerName].push(axis);
    }
    var renderer = this;

    if (options.label) {
        var text = this._canvas.text(0,0, options.label.max || options.label.min );
        text.setAttribute('transform','translate(0,0)');
        text.setAttribute('font-size', (4*RS)+'pt');
        text.setHeight = function(height) {
            text.setAttribute('y',height*offset_scale);
            text.setAttribute('font-size',(4*RS/renderer.zoom)+'pt');
        };
        this._layer_containers[layerName].push(text);
    }

    plot.setHeight = function(height) {
        var path_vals = recalculate_plot(0.5*height/RS);
        plot.setAttribute('d','M0 0 M0 0 m0 '+(height*offset_scale)+' m0 '+(0.5*height*height_scale)+' '+path_vals);
        plot.setAttribute('stroke-width',((options.thickness || 0.35)*RS)/renderer.zoom);
    };
    return plot;
};

(function() {
var addElementToLayer = function(layerName,opts) {
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {        
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
            orig_func.call(self,layerName);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }

    var tracer = null;
    var tracer_marker = null;
    var renderer = this._renderer;

    if ( ! opts ) {
        opts = {};
    }

    var scale = 1;
    if (opts.height) {
        opts.height = parseFloat(opts.height);
        if (typeof(opts.height) !== 'undefined' && opts.bare_element ) {
            opts.height *= 2;
        }
        scale = opts.height / this._renderer._layer_containers[layerName].track_height;
        if (typeof(opts.offset) !== 'undefined') {
            opts.offset  = -1.25 -1.25 + (opts.offset / opts.height) * 5;// ( -250/4 + (x / height) * 250 ) where 250 is growing marker height
        }
    }

    var tracer_marker = canvas.growingMarker(0,0,opts.content || layerName.charAt(0).toUpperCase(),opts);
    tracer_marker.setAttribute('transform','translate('+((this._index + 0.5) * this._renderer._RS) +',0.01) scale('+scale+')');
    tracer_marker.setAttribute('height','250');
    tracer_marker.firstChild.setAttribute('transform', 'translate(-100,0) rotate(0,100,0.001)');
    if ( opts.break_viewbox ) {
        tracer_marker.container.removeAttribute('viewBox');
        tracer_marker.container.setAttribute('width', '100%');
        tracer_marker.container.setAttribute('height','100%');
    }
    if (! opts.no_tracer ) {

        var bobble = canvas.circle(this._index+0.5,10,0.25);
        bobble.setAttribute('visibility','hidden');
        bobble.style.opacity = '0.4';
        tracer = canvas.rect(this._index+0.5,10,0.05,0);
        tracer._index = this._index;
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
        tracer.setHeight = function(height) {
            if (tracer.getAttribute('visibility') == 'hidden') {
                return;
            }

            var transform_attr = tracer_marker.getAttribute('transform');
            var matches = /translate\(.*[,\s](.*)\) scale\((.*)\)/.exec(transform_attr);
            if (matches[1] && matches[2]) {
                var scale = parseFloat(matches[2]);
                var y = parseFloat(matches[1]);
                var new_height = y + scale*(((tracer_marker.offset || 0) * 50) + 125) - parseInt(this.getAttribute('y'));
                this.setAttribute('height',new_height < 0 ? 0 : new_height );
            } else {
                this.setAttribute('height',height);
            }
        };
        this._renderer._layer_containers[layerName].tracers.push(tracer);
        this._renderer._layer_containers[layerName].tracers.push(bobble);
        tracer.setAttribute('pointer-events','none');
        bobble.setAttribute('pointer-events','none');
        canvas.tracers.push(tracer);
    }
    if (typeof opts.offset == 'undefined' || opts.offset === null) {
        // tracer_marker.offset = 2.5*this._renderer._layer_containers[layerName].track_height;
    } else {
        tracer_marker.offset = opts.offset;
    }


    // tracer_marker.setAttribute('transform','scale(0.5)');
    // tracer_marker.zoom_level = 'text';
    tracer_marker.setAttribute('visibility','hidden');

    this._renderer._layer_containers[layerName].push(tracer_marker);
    var result = [tracer,tracer_marker,bobble];
    tracer_marker.setAttribute('class',layerName);
    result.move = function(x,width) {
        var transform_attr = tracer_marker.getAttribute('transform');
        var matches = /translate\(.*[,\s](.*)\) scale\((.*)\)/.exec(transform_attr);
        if (matches[1] && matches[2]) {
            tracer_marker.setAttribute('transform','translate('+((x+0.5)*renderer._RS)+','+matches[1]+') scale('+matches[2]+')');
        }
        if (tracer) {
            tracer.move(x+0.5,0.05);
            bobble.move(x+0.5);
        }
    };
    if (tracer) {
        tracer_marker.tracer = tracer;
        tracer_marker.bobble = bobble;
    }
    this._renderer._layer_containers[layerName].push(result);
    return result;
};

var addBoxOverlayToElement = function(layerName,width,fraction,opts) {
    
    var canvas = this._renderer._canvas;
    var renderer = this._renderer;
    if ( ! opts ) {
        opts = { };
    }
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }


    var rect =  canvas.rect(-0.25+this._index,60,width || 1, opts.height || 4 ,opts);
    var rect_x = parseFloat(rect.getAttribute('x'));
    var rect_max_x = rect_x + parseFloat(rect.getAttribute('width'));
    var container = this._renderer._layer_containers[layerName];
    if ( typeof(opts.merge) !== 'undefined' && opts.merge ) {
        for (var i = 0; i < container.length; i++) {
            if (container[i].value != fraction ) {
                continue;
            }
            var el_x = parseFloat(container[i].getAttribute('x'));
            var el_max_x = el_x + parseFloat(container[i].getAttribute('width'));
            if ((el_x <= rect_x && rect_x <= el_max_x) ||
                (rect_x <= el_x && el_x <= rect_max_x)) {
                    container[i].setAttribute('x', ""+Math.min(el_x,rect_x));
                    container[i].setAttribute('width', ""+(Math.max(el_max_x,rect_max_x)-Math.min(el_x,rect_x)) );
                    rect.parentNode.removeChild(rect);
                    return container[i];
                }
        }
    }
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.setAttribute('visibility', 'hidden');
    rect.setAttribute('stroke-width','0px');
    if (typeof(fraction) !== 'undefined') {
        rect.setAttribute('opacity',fraction);
        rect.value = fraction;
    }
    rect.setAttribute('fill',opts.fill || MASCP.layers[layerName].color);
    rect.position_start = this._index;
    rect.position_end = this._index + width;
    if ((typeof(opts.offset) !== "undefined") || opts.height_scale) {
        var offset_val = opts.offset;
        rect.setHeight = function(hght) {
            var height_val = opts.height ? (opts.height*renderer._RS/renderer.zoom) : hght*(opts.height_scale || 1);
            if (opts.align == 'bottom') {
                this.setAttribute('y',(offset_val*renderer._RS/renderer.zoom)-(hght*(opts.height_scale || 1)) );
                this.setAttribute('height',height_val);
            } else {
                this.setAttribute('y',offset_val*renderer._RS/renderer.zoom);
                this.setAttribute('height',height_val);
            }
        };
    }
    return rect;
};

var addTextToElement = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;
    var renderer = this._renderer;
    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }
    if ( ! opts ) {
        opts = {};
    }
    if (opts.height) {
        opts.height = opts.height * this._renderer._RS;
    }
    var height = opts.height || this._renderer._layer_containers[layerName].trackHeight || 4;
    var position = this._index;
    if (width > 1) {
        position = position + Math.floor(0.5*width);
    }
    var text_scale = (4/3);
    var text = canvas.text(position,0,opts.txt || opts.content || "Text");
    text.setAttribute('font-size',text_scale*height);
    text.cached_width = text.getComputedTextLength() / height;
    text.setAttribute('font-weight','bolder');
    text.setAttribute('fill', opts.fill || '#ffffff');
    text.setAttribute('stroke','#000000');
    if (! ("stroke_width" in opts)) {
        opts.stroke_width = 5;
    }
    text.setAttribute('stroke-width',opts.stroke_width+'');
    text.setAttribute('style','font-family: '+canvas.font_order);
    text.firstChild.setAttribute('dy','1.3ex');
    text.setAttribute('text-anchor','middle');
    if (opts.align) {
        if (opts.align == "left") {
            text.setAttribute('text-anchor', 'start');
        }
        if (opts.align == 'right') {
            text.setAttribute('text-anchor', 'end');
        }
    }
    if (width > 1) {
        var clip = canvas.clipPath();
        var mask = canvas.rect(-0.5*width,opts.offset || 0,width,height);
        clip.push(mask);
        mask.removeAttribute('y');
        var mask_id = 'id' + (new Date()).getTime()+"_"+clip.parentNode.childNodes.length;
        clip.setAttribute('id',mask_id);
        text.setAttribute('clip-path','url(#'+mask_id+')');
    }
    if (typeof opts.offset !== 'undefined') {
        text.setAttribute('transform','translate('+text.getAttribute('x')+','+text.getAttribute('y')+')');
        text.offset = opts.offset;
        text.setHeight = function(height) {
            var top_offset = this.offset;
            this.setAttribute('x',0);
            this.setAttribute('y',top_offset*renderer._RS / renderer.zoom);
            if (mask) mask.setAttribute('y',this.getAttribute('y'));
            this.setAttribute('stroke-width', 5/renderer.zoom);
            if (opts.height) {
                this.setAttribute('font-size', text_scale*opts.height/renderer.zoom);
                if (mask) mask.setAttribute('height',opts.height/renderer.zoom);
            } else {
                this.setAttribute('font-size', text_scale*height);
                if (mask) mask.setAttribute('height',height);
            }
            // If we have a mask, we want to move the text to the left.
            if ( mask ) {
                if ((this.cached_width*height) > (width *50)) {
                    this.setAttribute('x',(-0.5*width*50));
                    this.setAttribute('text-anchor','start');
                } else {
                    this.setAttribute('x','0');
                    this.setAttribute('text-anchor','middle');
                }
            } else {
                this.setAttribute('x','0');
                this.setAttribute('text-anchor','middle');
            }
        };
    } else {
        text.setHeight = function(height) {
            text.setAttribute('stroke-width', 5/renderer.zoom);
            if (opts.height) {
                text.setAttribute('font-size', text_scale*opts.height/renderer.zoom);
                if (mask) mask.setAttribute('height',opts.height/renderer.zoom);
            } else {
                text.setAttribute('font-size', text_scale*height);
                if (mask) mask.setAttribute('height',height);
            }
        };
    }
    if (width > 1) {
        text.move = function(new_x,new_width) {
            if (mask) mask.setAttribute('x',(-1*new_width*renderer._RS*0.5));
            if (mask) mask.setAttribute('width',new_width*renderer._RS);
            text.setAttribute('x',(new_x + parseInt(0.5*new_width))*renderer._RS );
        };
    }
    this._renderer._layer_containers[layerName].push(text);
    return text;
}

var addShapeToElement = function(layerName,width,opts) {
    var canvas = this._renderer._canvas;
    var renderer = this._renderer;

    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);
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
    var shape_name = (opts.shape.split('-') || '')[0];
    if (shape_name in methods) {
        var is_rotated = opts.shape.split('-')[1];
        if (is_rotated == 'left' && ! opts.rotate) {
            opts.rotate = 90;
        }
        if (is_rotated == 'right' && ! opts.rotate) {
            opts.rotate = 270;
        }
        if (is_rotated == 'flip' && ! opts.rotate) {
            opts.rotate = 180;
        }
        shape = methods[shape_name].call(canvas,this._index,60,width || 1,opts.height || 4,opts.rotate);
    } else {
        return;
    }
    if ((typeof opts.offset) !== 'undefined') {
        var x_pos = shape.getAttribute('x');
        var y_pos = shape.getAttribute('y');
        shape.setAttribute('transform','translate('+x_pos+','+y_pos+')');
        shape.setAttribute('x','0');
        var offset_val = opts.offset || 0;
        var orig_height = opts.height || 4;
        shape.setAttribute('y',offset_val*this._renderer._RS);
        shape.setHeight = function(height) {
            if ( ! this._orig_stroke_width ) {
                this._orig_stroke_width = parseInt(this.getAttribute('stroke-width'));
            }
            shape.setAttribute('y', (offset_val*renderer._RS/renderer.zoom));
            shape.setAttribute('height',(orig_height*renderer._RS)/renderer.zoom);
            shape.setAttribute('stroke-width',this._orig_stroke_width/renderer.zoom);
            if ( opts.shape == 'ellipse' ) {
                shape.setAttribute('ry', 0.5*(orig_height*renderer._RS)/renderer.zoom );
            }
            if (opts.shape == 'roundrect') {
                shape.setAttribute('rx', 0.25*(orig_height*renderer._RS)/renderer.zoom );
                shape.setAttribute('ry', 0.25*(orig_height*renderer._RS)/renderer.zoom );
            }
        };
        shape.move = function(new_x,new_width) {
            var transform_attr = this.getAttribute('transform');
            var matches = /translate\(.*[,\s](.*)\)/.exec(transform_attr);
            if (matches[1]) {
                this.setAttribute('transform','translate('+(new_x*renderer._RS)+','+matches[1]+')');
            }
            this.setAttribute('width',new_width*renderer._RS);
        };
    }

    if (((typeof opts.offset) !== 'undefined') && (opts.shape == "hexagon" || opts.shape == "pentagon" )) {
        var offset_val = opts.offset || 0;
        var orig_height = opts.height || 4;
        var adjustment_g = canvas.group();
        adjustment_g.setAttribute('transform',shape.getAttribute('transform'));
        adjustment_g.push(shape);
        shape.setAttribute('transform','translate(0,0)');
        adjustment_g.setHeight = function(height) {
            if ( ! shape._orig_stroke_width ) {
                shape._orig_stroke_width = parseInt(shape.getAttribute('stroke-width')) || 0;
            }
            shape.setHeight(orig_height*renderer._RS/renderer.zoom);
            shape.setAttribute('stroke-width',this._orig_stroke_width/renderer.zoom);
            shape.setAttribute('transform','translate(0,0)');
        };
        this._renderer._layer_containers[layerName].push(adjustment_g);
        adjustment_g.setAttribute('visibility', 'hidden');
        adjustment_g.setAttribute('class',layerName);
        adjustment_g.position_start = this._index;
        adjustment_g.position_end = this._index + width;

    } else {
        this._renderer._layer_containers[layerName].push(shape);
        shape.setAttribute('visibility', 'hidden');
        shape.setAttribute('class',layerName);
        shape.position_start = this._index;
        shape.position_end = this._index + width;

    }
    shape.setAttribute('fill',opts.fill || MASCP.layers[layerName].color);
    if (opts.stroke) {
        shape.setAttribute('stroke',opts.stroke);
    }
    if (opts.stroke_width) {
        shape.setAttribute('stroke-width',renderer._RS*opts.stroke_width);
    } else {
        shape.style.strokeWidth = '0';
    }
    return shape;
};

var addElementToLayerWithLink = function(layerName,url,width) {
    var canvas = this._renderer._canvas;

    if ( ! canvas ) {
        var orig_func = arguments.callee;
        var self = this;
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
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
        bean.add(this._renderer,'sequencechange',function() {
            bean.remove(this._renderer,'sequencechange',arguments.callee);            
            orig_func.call(self,layerName,width,opts);
        });
        log("Delaying rendering, waiting for sequence change");
        return;
    }
    var callout = canvas.callout(this._index+0.5,0.01,element,{'width' : (10*opts.width) || 100 ,'height': (opts.height * 10) || 100, 'align' : opts.align, 'font-size' : opts['font-size'] });
    callout.setHeight(opts.height*this._renderer._RS);
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

var scaledAddShapeOverlay = function(layername,width,opts) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,layername)) - 1;
    var res = addShapeToElement.call(start < end ? this : this._renderer._sequence_els[end],layername, Math.abs(end - start),opts);
    res.aa = this.original_index;
    res.aa_width = width;
    return res;
};

var scaledAddBoxOverlay = function(layername,width,fraction,opts) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,layername)) - 1;

    var res = addBoxOverlayToElement.call(start < end ? this : this._renderer._sequence_els[end],layername,Math.abs(end - start),fraction,opts);

    if (! (opts || {}).merge ) {
        res.aa_width = width;
        res.aa = this.original_index;
    } else {
        res.aa_width = parseInt(res.getAttribute('width')) / this._renderer._RS;
        if (res.aa_width == width) {
            res.aa = this.original_index;
        }
    }
    return res;
};

var scaledAddTextOverlay = function(layername,width,opts) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,layername)) - 1;
    var res = addTextToElement.call(start < end ? this : this._renderer._sequence_els[end],layername,Math.abs(end - start),opts);
    res.aa = this.original_index;
    res.aa_width = width;
    return res;
};

var scaledAddToLayerWithLink = function(layername,url,width) {
    var start = this._index;
    var end = Math.abs(this._renderer.scalePosition(this.original_index+width,layername)) - 1;
    var res = addElementToLayerWithLink.call(start < end ? this : this._renderer._sequence_els[end],layername,url,Math.abs(end - start));
    res.aa = this.original_index;
    return res;
};

var scaledAddToLayer = function(layername,opts) {
    var res = addElementToLayer.call(this,layername,opts);
    res.aa = this.original_index;
    res.aa_width = 1;
    return res;
};

CondensedSequenceRenderer.prototype.enableScaling = function() {
    bean.add(this,'readerRegistered',function(reader) {
        console.log('Enabling scaling for legacy readers');
        var old_result = reader.gotResult;
        var renderer = this;
        reader.gotResult = function() {
            var wanted_id = reader.acc || reader.agi || "";

            var old_get_aas = CondensedSequenceRenderer.prototype.getAminoAcidsByPosition;
            var old_get_pep = CondensedSequenceRenderer.prototype.getAminoAcidsByPeptide;
            var old_sequence = renderer.sequence;
            if (renderer.sequences) {
                renderer.sequence = (renderer.sequences [ ( renderer.sequences.map(function(seq) {  return (seq.agi || seq.acc || "").toLowerCase();  }) ).indexOf(wanted_id.toLowerCase()) ] || "").toString();
            } else {
                old_sequence = null;
            }
            renderer.getAminoAcidsByPosition = function(aas,lay,accession) {
                if ( ! lay && ! accession ) {
                    console.log('Guessing scaling identifier as',wanted_id);
                }
                return old_get_aas.call(this,aas,lay || wanted_id,accession || wanted_id);
            };
            renderer.getAminoAcidsByPeptide = function(peptide,lay,accession) {
                if ( ! lay && ! accession ) {
                    console.log('Guessing scaling identifier as',wanted_id);
                }
                return old_get_pep.call(this,peptide,lay || wanted_id,accession || wanted_id);
            };
            old_result.call(reader);

            if (old_sequence) {
                renderer.sequence = old_sequence;
            }

            renderer.getAminoAcidsByPosition = old_get_aas;
            renderer.getAminoAcidsByPeptide = old_get_pep;
        };
    });
};


CondensedSequenceRenderer.prototype._extendElement = function(el) {
    el.addToLayer = scaledAddToLayer;
    el.addBoxOverlay = scaledAddBoxOverlay;
    el.addShapeOverlay = scaledAddShapeOverlay;
    el.addTextOverlay = scaledAddTextOverlay;
    el.addToLayerWithLink = scaledAddToLayerWithLink;
    el.callout = addCalloutToLayer;
    el['_renderer'] = this;
};

CondensedSequenceRenderer.prototype.remove = function(lay,el) {
    if ( ! el ) {
        return false;
    }
    if (this._layer_containers[lay] && this._layer_containers[lay].indexOf(el) >= 0) {
        this._layer_containers[lay].splice(this._layer_containers[lay].indexOf(el),1);
        bean.fire(el,'removed');
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
        if (el.tracer && el.tracer.parentNode) {
            el.tracer.parentNode.removeChild(el.tracer);
        }
        if (el.bobble && el.bobble.parentNode) {
            el.bobble.parentNode.removeChild(el.bobble);
        }
        return true;
    }
    return false;
};

var mark_groups = function(renderer,objects) {
    var group = [];
    var new_objects = [];
    for (i = 0; i < objects.length; i++) {
      var current = objects[i], next = null;
      if ( ! current ) {
        continue;
      }
      if (objects[i+1]) {
        next = objects[i+1];
      }
      if ( (! next || (parseInt(next.aa) - parseInt(current.aa) > 10) || renderer.sequence.substring(current,next-1).match(/[ST]/)) ) {
        if (group.length < 3) {
          group.push(current);
        } else {
          group.push(current);
          group.forEach(function(site){
            site.options.zoom_level = 'text';
          });
          var coalesce_options = group[0].coalesce || objects[0].coalesce;
          new_objects.push({
            'aa' : group[0].aa,
            'type' : 'shape',
            'width' : parseInt(current.aa)-parseInt(group[0].aa)+1,
            'options' : {   'zoom_level' : 'summary',
                            'shape' : 'roundrect',
                            'fill' : coalesce_options.fill,
                            'stroke' : coalesce_options.stroke,
                            'stroke_width' : coalesce_options.stroke_width,
                            'height' : group[0].options.height,
                            'offset' : group[0].options.offset
                        }
            });
        }
        group = [];
      } else {
        group.push(current);
      }
    }
    new_objects.forEach(function(obj) {
        objects.push(obj);
    });
};

CondensedSequenceRenderer.prototype.fix_icons = function(icon_ref) {
    if ( ! this.icons_failed ) {
        return icon_ref;
    }
    if (typeof(icon_ref) === 'string') {
        var vals = icon_ref.split('_');
        if (vals[0] && this.icons_failed[vals[0].replace('#','')]) {
            vals[0] = this.icons_failed[vals[0].replace('#','')]+'#';
            var start = vals.shift();
            console.log(icon_ref,start+vals.join('_'));
            return start+vals.join('_');
        }
    }
    return icon_ref;
}

CondensedSequenceRenderer.prototype.renderObjects = function(track,objects) {
    var renderer = this;
    if (objects.length > 0 && objects[0].coalesce ) {
        mark_groups(renderer,objects);
    }
    var results = [];
    objects.forEach(function(object) {
        var potential_height = object.options ? (object.options.height || renderer._layer_containers[track].track_height) + (object.options.offset + object.options.height || 0) : 0;
        if (object.options && (potential_height > renderer._layer_containers[track].track_height) ) {
            var new_height = renderer._layer_containers[track].track_height + object.options.offset + (object.options.height || renderer._layer_containers[track].track_height);
            if ((renderer._layer_containers[track].fixed_track_height || 0) < new_height) {
                renderer._layer_containers[track].fixed_track_height = new_height;
            }
        }

        var click_reveal;
        var rendered;
        if (object.aa && ( ! renderer.getAA(parseInt(object.aa),track)) ) {
            return;
        }
        if ((typeof object.aa !== 'undefined') && isNaN(object.aa)) {
            return;
        }
        if (object.type == "text") {
            if (object.aa) {
                if (object.width) {
                    rendered = renderer.getAA(parseInt(object.aa),track).addTextOverlay(track,object.width,object.options);
                } else {
                    rendered = renderer.getAA(parseInt(object.aa),track).addTextOverlay(track,1,object.options);
                }
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide,track).addTextOverlay(track,1,object.options);
            }
        }
        if (object.type === "box") {
            if (object.aa) {
                rendered = renderer.getAA(parseInt(object.aa),track).addBoxOverlay(track,parseInt(object.width),1,object.options);
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide,track).addToLayer(track,1,object.options);
            }
        }
        if (object.type == "shape") {
            if (object.aa) {
                rendered = renderer.getAA(parseInt(object.aa),track).addShapeOverlay(track,parseInt(object.width),object.options);
            } else if (object.peptide) {
                rendered = renderer.getAminoAcidsByPeptide(object.peptide,track)[0].addShapeOverlay(track, object.peptide.length, object.options);
            }
        }
        if (object.type == 'line') {
            rendered = renderer.addValuesToLayer(track,object.values,object.options);
        }
        if (object.type == "marker") {
            var content = (object.options || {}).content;
            var wanted_height = object.options.height;

            if (Array.isArray && Array.isArray(content)) {
                var cloned_options_array = {};
                for( var key in object.options ) {
                    if (object.options.hasOwnProperty(key)) {
                        cloned_options_array[key] = object.options[key];
                    }
                }
                if (object.options.content && Array.isArray(content_data)) {
                    cloned_options_array.content = object.options.content.map(renderer.fix_icons.bind(renderer));
                }

                click_reveal = renderer.getAA(parseInt(object.aa),track).addToLayer(track,cloned_options_array);
                click_reveal = click_reveal[1];
                click_reveal.style.display = 'none';
                object.options.content = object.options.alt_content;
                content = object.options.content;
            }
            if (typeof(content) == 'object') {
                var content_el;
                if (content.type == "circle") {
                    content_el = renderer._canvas.circle(-0.5,-0.5,1,1);
                }
                if (content.type == 'text_circle') {
                    content_el = renderer._canvas.text_circle(0.5,0.5,1,content.text,content.options || {});
                    object.options.break_viewbox = true;
                }
                if (content.type == "left_triangle") {
                    content_el = renderer._canvas.poly('-100,0 0,-100 0,100');
                }
                if (content.type == "right_triangle") {
                    content_el = renderer._canvas.poly('0,100 100,0 0,-100');
                }

                ["fill","stroke","stroke-width","fill-opacity","stroke-opacity","opacity"].forEach(function(prop) {
                    if (content[prop]) {
                        content_el.setAttribute(prop,content[prop]);
                    }
                });
                object.options.content = content_el;
            }
            var cloned_options = {};
            for( var key in object.options ) {
                if (object.options.hasOwnProperty(key)) {
                    cloned_options[key] = object.options[key];
                }
            }
            var content_data = (object.options || {}).content;
            if (content_data && typeof content_data === 'string') {
                cloned_options.content = renderer.fix_icons(content_data);
            }
            if (content_data && Array.isArray(content_data)) {
                cloned_options.content = content_data.map(renderer.fix_icons.bind(renderer));
            }
            var added = renderer.getAA(parseInt(object.aa),track).addToLayer(track,cloned_options);
            if (click_reveal) {

                click_reveal.toggleReveal = function(ev) {
                    ev.stopPropagation();
                    if (this.style.display === 'none') {
                        this.parentNode.appendChild(this);
                        this.style.display = 'block';
                    } else {
                        this.style.display = 'none';
                    }
                    renderer.refresh();
                };
                added[1].addEventListener('touchstart', click_reveal.toggleReveal.bind(click_reveal),true);
                added[1].addEventListener('click',click_reveal.toggleReveal.bind(click_reveal),false);
            }
            rendered = added[1];
        }
        if ((object.options || {}).zoom_level) {
            rendered.zoom_level = object.options.zoom_level;
        }
        if (object.identifier) {
            rendered.setAttribute('identifier',object.identifier);
        }
        if ((object.options || {}).events && rendered ) {
            object.options.events.forEach(function(ev) {
                (ev.type || "").split(",").forEach(function(evtype) {
                    if (evtype == 'click' && rendered.style ) {
                        rendered.style.cursor = 'pointer';
                    }
                    rendered.addEventListener(evtype,function(e) {
                        e.event_data = ev.data;
                        e.layer = track;
                        e.aa = object.aa;
                    });
                });
            });
        }
        results.push(rendered);
    });
    return results;
};

CondensedSequenceRenderer.prototype.addTextTrack = function(seq,container) {
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

    /* We also need to test for support for adjusting textLength
       while also adjusting the dx value. Internet Explorer 10
       squeezes text when setting a dx value as well as a textLength.
       I.e. the right-most position of the character is calculated to
       be x + textLength, rather than x + dx + textLength.
     */

    var supports_dx = false;
    if (typeof MASCP.supports_dx !== 'undefined') {
        supports_dx = MASCP.supports_dx;
    } else {
        (function(supports_textLength) {
            if (! supports_textLength) {
                supports_dx = false;
                return;
            }
            var test_el = document.createElementNS(svgns,'text');
            test_el.setAttribute('textLength',30);

            if ( ! test_el.getExtentOfChar ) {
                return;
            }
            test_el.setAttribute('x','0');
            test_el.setAttribute('y','0');
            test_el.textContent = 'ABC';
            canvas.appendChild(test_el);
            var extent = test_el.getExtentOfChar(2).x;
            test_el.setAttribute('dx','10');
            if (Math.abs(test_el.getExtentOfChar(2).x - extent) < 9.5) {
                supports_dx = false;
            } else {
                supports_dx = true;
            }
            MASCP.supports_dx = supports_dx;
            test_el.parentNode.removeChild(test_el);
        })(has_textLength);
    }

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
        var container_width = renderer._container_canvas.parentNode.cached_width;
        if ( ! container_width ) {
            container_width = renderer._container_canvas.parentNode.getBoundingClientRect().width;
            var docwidth = document.documentElement.clientWidth;
            if (docwidth > container_width) {
                container_width = docwidth;
            }
        }
        let max_size = Math.ceil(10*container_width * renderer.zoom / RS);
        if (max_size > seq.length) {
            max_size = seq.length;
        }

        a_text.setAttribute('textLength',RS*max_size);

        var start = parseInt(renderer.leftVisibleResidue());
        start -= 50;
        if (start < 0) { 
            start = 0;
        }
        if ((start + max_size) >= seq.length) {
            start = seq.length - max_size;
            if (start < 0) {
                start = 0;
            }
        }
        a_text.replaceChild(document.createTextNode(seq.substr(start,max_size)),a_text.firstChild);
        a_text.setAttribute(supports_dx ? 'dx' : 'x',5+((start)*RS));
    };
    var panstart = function() {
                        if (amino_acids_shown) {
                            amino_acids.attr( { 'display' : 'none'});
                        }
                    };
    var panend = function() {
                        if (amino_acids_shown) {
                            amino_acids.attr( {'display' : 'block'} );
                            update_sequence();
                        }
                    };
    var zoomchange = function() {
                       if (canvas.zoom > 3.6) {
                           amino_acids.attr({'display' : 'block'});
                           amino_acids_shown = true;
                           update_sequence();
                       } else if (canvas.zoom > 0.2) {
                           amino_acids.attr({'display' : 'none'});
                           amino_acids_shown = false;
                       } else {
                           amino_acids.attr({'display' : 'none'});
                           amino_acids_shown = false;
                       }
                   };
    if ( ! container.panevents ) {
        canvas.addEventListener('panstart', panstart,false);
        bean.add(canvas,'panend', panend);
        container.panevents = true;
    }
       
    bean.add(canvas,'zoomChange', zoomchange,false);
    bean.add(amino_acids[0],'removed',function() {
        canvas.removeEventListener('panstart',panstart);
        bean.remove(canvas,'panend',panend);
        bean.remove(canvas,'zoomChange',zoomchange);
        delete container.panevents;
    });
    return amino_acids;
};

CondensedSequenceRenderer.prototype.renderTextTrack = function(lay,in_text) {
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
    var result = this.addTextTrack(in_text,container);
    return result;
};

})();

CondensedSequenceRenderer.prototype.EnableHighlights = function() {
    var renderer = this;
    var highlights = [];
    var createNewHighlight = function() {
        var highlight = renderer._canvas.rect(0,0,0,'100%');
        highlight.addEventListener('click', (ev) => {
            ev.stopPropagation();
            return false;
        });
        highlight.addEventListener('mousedown', (ev) => {
            ev.stopPropagation();
            return false;
        });

        highlight.addEventListener('touchstart', (ev) => {
            ev.stopPropagation();
            return false;
        });

        highlight.setAttribute('fill','#ffdddd');
        highlight.removeAttribute('stroke');
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
            if ( highlight.previousSibling.previousSibling && highlights.indexOf(highlight.previousSibling.previousSibling) < 0 ) {
                highlight.parentNode.insertBefore(highlight,highlight.parentNode.firstChild.nextSibling);
            }
            highlight.setAttribute('x',(from - 1) * RS );
            highlight.setAttribute('width',(to - (from - 1)) * RS );
            highlight.setAttribute('visibility','visible');
            idx += 1;
        }
        for (i = idx; i < highlights.length; i++){
            highlights[i].setAttribute('visibility','hidden');
        }
    };
};

(function() {

    var bindClick = function(element,handler) {
        if ("ontouchstart" in window) {
            element.addEventListener('touchstart',function(ev) {
                var startX = ev.touches[0].clientX;
                var startY = ev.touches[0].clientY;
                var reset = function() {
                    document.body.removeEventListener('touchmove',move);
                    element.removeEventListener('touchend',end);
                };
                var end = function(ev) {
                    reset();
                    ev.stopPropagation();
                    ev.preventDefault();
                    if (handler) {
                        handler.call(null,ev);
                    }
                };
                var move = function(ev) {
                    if (Math.abs(ev.touches[0].clientX - startX) > 10 || Math.abs(ev.touches[0].clientY - startY) > 10) {
                        reset();
                    }
                };
                //FIXME - PASSIVE
                document.body.addEventListener('touchmove', move , {passive:true});
                element.addEventListener('touchend',end,false);
            },{passive : true});
            //FIXME - PASSIVE
        } else {
            element.addEventListener('click',handler,false);
        }
    };


  var mousePosition = function(evt) {
      var posx = 0;
      var posy = 0;
      if (!evt) {
          evt = window.event;
      }

      if (evt.pageX || evt.pageY)     {
          posx = evt.pageX - (document.body.scrollLeft + document.documentElement.scrollLeft);
          posy = evt.pageY - (document.body.scrollTop + document.documentElement.scrollTop);
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

  var svgPosition = function(ev,svgel) {
      var positions = mousePosition(ev.changedTouches ? ev.changedTouches[0] : ev);
      var p = {};
      if (svgel.nodeName == 'svg') {
          p = svgel.createSVGPoint();
          var rootCTM = svgel.getScreenCTM();
          p.x = positions[0];
          p.y = positions[1];

          self.matrix = rootCTM.inverse();
          p = p.matrixTransform(self.matrix);
      } else {
          p.x = positions[0];
          p.y = positions[1];
      }
      return p;
  };

  var notifySelectionToLayers = function(start,end,renderer) {
    let selections = new WeakMap();
    selections.set(renderer,[start,end]);
    for (let layname of Object.keys(renderer._layer_containers || {})) {
        var lay = MASCP.getLayer(layname);
        let values = [ null, null ];
        if (start && end) {
            values = [ renderer.scalePosition(start,layname,true), renderer.scalePosition(end,layname,true) ];
        }
        bean.fire(lay,'selection',values);
        selections.set(lay,values);
    }
    bean.fire(renderer,'selection', selections);
  };

CondensedSequenceRenderer.prototype.enableSelection = function(callback) {
    var self = this;

    if ( ! self._canvas) {
      bean.add(self,'sequenceChange',function() {
        self.enableSelection();
      });
      return;
    }

    var canvas = self._canvas;
    var start;
    var end;
    var end_func;
    var local_start;
    var local_end;

    let in_drag = false;


    var moving_func = function(evt) {
        evt.preventDefault();

        var p = svgPosition(evt,canvas);
        end = p.x;

        if (start > end) {
            local_end = parseInt(start / 50);
            local_start = parseInt(end / 50);
        } else {
            local_end = parseInt(end/50);
            local_start = parseInt(start/50);
        }
        self.select(local_start+1,local_end);
    };

    // Do not send the click event to the canvas
    // this screws up with doing things on the selection
    // Need alternative method to clear selection
    //
    bindClick(canvas,function(evt) {
        if (! self.selecting) {
            self.select();
            notifySelectionToLayers(null,null,self);
            local_start = null;
            local_end = null;
        }
    });

    canvas.addEventListener('mousedown',function(evt) {
        if (! self.selecting ) {
            return;
        }
        in_drag = true;
        self.select();
        var positions = mousePosition(evt);
        var p = {};
        if (canvas.nodeName == 'svg') {
                p = canvas.createSVGPoint();
                var rootCTM = this.getScreenCTM();
                p.x = positions[0];
                p.y = positions[1];

                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
        } else {
                p.x = positions[0];
                p.y = positions[1];
        }
        start = p.x;
        end = p.x;
        canvas.addEventListener('mousemove',moving_func,false);
        evt.preventDefault();
    },false);

    canvas.addEventListener('mouseup',function(evt) {
        if (in_drag) {
            notifySelectionToLayers(local_start === null ? null : local_start+1,local_end,self);
            local_start = null;
            local_end = null;
            in_drag = false;
        }
        canvas.removeEventListener('mousemove',moving_func);
        evt.preventDefault();
    });

    canvas.addEventListener('touchend',function() {
        if (in_drag) {
            setTimeout(function() {
                notifySelectionToLayers(local_start === null ? null : local_start+1,local_end,self);
                local_start = null;
                local_end = null;
                in_drag = false;
            },500);
        }
        canvas.removeEventListener('touchmove',moving_func);
    });

    canvas.addEventListener('touchstart',function(evt) {
        if (! self.selecting ) {
            return;
        }
        if (evt.changedTouches.length == 1) {
            in_drag = true;
            evt.preventDefault();
            var positions = mousePosition(evt.changedTouches[0]);
            var p = {};
            if (canvas.nodeName == 'svg') {
                    p = canvas.createSVGPoint();
                    var rootCTM = this.getScreenCTM();
                    p.x = positions[0];
                    p.y = positions[1];

                    self.matrix = rootCTM.inverse();
                    p = p.matrixTransform(self.matrix);
            } else {
                    p.x = positions[0];
                    p.y = positions[1];
            }
            start = p.x;
            end = p.x;
            canvas.addEventListener('touchmove',moving_func,{passive:true});
        }
    },{passive:true});
    //FIXME - PASSIVE
};

})();

/*
 * Get a canvas set of the visible tracers on this renderer
 */
CondensedSequenceRenderer.prototype._visibleTracers = function() {
    var tracers = null;
    for (var i in MASCP.layers) {
        if (this.isLayerActive(i) && this._layer_containers[i] && this._layer_containers[i].tracers) {
            if ( ! tracers ) {
                tracers = this._layer_containers[i].tracers;
            } else {
                tracers.concat(this._layer_containers[i].tracers);
            }
        }
    }
    return tracers;
};

CondensedSequenceRenderer.prototype._resizeContainer = function() {
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
            // this._container.style.height = height+'px';        
        } else {
            this._container_canvas.setAttribute('height','100%');
            this._container_canvas.setAttribute('width','100%');

            // this._container.style.height = 'auto';
            this.navigation.setZoom(this.zoom);
        }        
    }
};

(function(clazz) {

var vis_change_event = function(renderer,visibility) {
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
        bean.add(this,'sequencechange',function() {
            this.addTrack(layer);
            bean.remove(this,'sequencechange',arguments.callee);
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
        bean.remove(layer,'visibilityChange',vis_change_event);
        bean.add(layer,'visibilityChange',vis_change_event);
        var event_names = ['click','mouseover','mousedown','mousemove','mouseout','mouseup','mouseenter','mouseleave'];
        var ev_function = function(ev,original_event,element) {
            bean.fire(layer,ev.type,[original_event,element.position_start,element.position_end]);
        };
        // for (var i = 0 ; i < event_names.length; i++) {
        //     bean.add(layer_containers[layer.name]._event_proxy,event_names[i],ev_function);
        // }
        bean.remove(layer,'removed');
        bean.add(layer,'removed',function(rend) {
            if (rend) {
                rend.removeTrack(this);
            } else{
                renderer.removeTrack(this);
            }
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
        delete this._layer_containers[layer.name];
        layer.disabled = true;
    }

};

var refresh_id = 0;
clazz.prototype.disablePrintResizing = function() {
    delete this._media_func;
};

clazz.prototype.enablePrintResizing = function() {
    if ( ! (this.win() || window).matchMedia ) {
        return;
    }
    if (this._media_func) {
        return this._media_func;
    }
    this._media_func = function(matcher) {
        var self = this;
        if ( ! self._canvas ) {
            return;
        }
        if ( self.grow_container ) {
            if (matcher.matches) {
                delete self._container_canvas.parentNode.cached_width;
                bean.fire(self._canvas,'panend');
            }
            return;
        }
        var match=matcher;
        if (! match.matches ) {
            if (self.old_zoom) {
                var a_zoom = self.old_zoom;
                self.old_zoom = null;
                self.zoomCenter = null;
                self.withoutRefresh(function() {
                  self.zoom = a_zoom;
                });
                self._canvas.setCurrentTranslateXY(self.old_translate,0);
                self._container_canvas.setAttribute('viewBox',self.old_viewbox);
                // self._container.style.height = 'auto';
                self.old_zoom = null;
                self.old_translate = null;
                self.refresh();
                bean.fire(self._canvas,'zoomChange');
            }
            return;
        }
        try {
            var container = self._container;
            self.old_translate = self._canvas.currentTranslateCache.x;
            self._canvas.setCurrentTranslateXY(0,0);
            var zoomFactor = 0.95 * (container.clientWidth) / (self.sequence.length);
            if ( ! self.old_zoom ) {
              self.old_zoom = self.zoom;
              self.old_viewbox = self._container_canvas.getAttribute('viewBox');
            }
            self.zoomCenter = null;
            self._container_canvas.removeAttribute('viewBox');
            self.withoutRefresh(function() {
                self.zoom = zoomFactor;
            });
            self.refresh();
        } catch (err) {
            console.log(err);
            console.log(err.stack);
        }
    };
    var rend = this;
    if ( ! rend._bound_media ) {
        (this.win() || window).matchMedia('print').addListener(function(matcher) {
            if (rend._media_func) {
                rend._media_func(matcher);
            }
        });
    }
    rend._bound_media = true;
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
            // container.attr({ 'opacity' : '1' });
        }

        var tracer_top = track_heights;

        if (container.fixed_track_height) {

            var track_height = container.fixed_track_height;

            y_val = this._axis_height + track_heights  / this.zoom;

            if (animated) {
                container.animate({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });
            } else {
                container.attr({ 'visibility': 'visible', 'y' : y_val*RS, 'height' :  RS * container.track_height / this.zoom });
            }
            if (this.navigation) {
                y_val -= 1*container.track_height/this.zoom;
                this.navigation.renderTrack(MASCP.getLayer(name), y_val*RS , RS * container.fixed_track_height / this.zoom, { 'font-scale' : ((fixed_font_scale || 1) * 3 *container.track_height) / container.fixed_track_height } );
            }
            track_heights += container.fixed_track_height + this.trackGap - container.track_height;

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

        if (container.tracers) {
            var disp_style = (this.isLayerActive(name) && (this.zoom > 3.6)) ? 'visible' : 'hidden';
            var height = (1.5 + tracer_top / this.zoom )*RS;

            if(animated) {
                container.tracers.animate({'visibility' : disp_style , 'y' : 0.65*(this._axis_height)*RS,'height' : height });
            } else {
                container.tracers.attr({'visibility' : disp_style , 'y' : 0.65*(this._axis_height)*RS,'height' : height });
            }
        }


    }
    
    var viewBox = [-1,0,0,0];
    viewBox[0] = -2*RS;
    viewBox[2] = (this.sequence.split('').length+(this.padding)+2)*RS;
    viewBox[3] = (this._axis_height + (track_heights / this.zoom)+ (this.padding / this.zoom))*RS;
    this._canvas.setAttribute('viewBox', viewBox.join(' '));
    this._canvas._canvas_height = viewBox[3];


    var outer_viewbox = [].concat(viewBox);

    outer_viewbox[0] = 0;
    outer_viewbox[2] = (this.zoom)*(2*this.sequence.length)+(this.padding);
    outer_viewbox[3] = (this.zoom)*2*(this._axis_height + (track_heights / this.zoom)+ (this.padding / this.zoom));
    if (! this.grow_container ) {
        this._container_canvas.setAttribute('viewBox', outer_viewbox.join(' '));
    } else {
        this._container_canvas.removeAttribute('viewBox');
    }

    this._resizeContainer();

    viewBox[0] = 0;
    if (this.navigation) {
        if ( this.grow_container ) {
            this.navigation.nav_width_base = outer_viewbox[3] < 200 ? outer_viewbox[3] : 200;
        }
        this.navigation.move_closer();
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


/*

Modified from:

http://stackoverflow.com/questions/5433806/convert-embedded-svg-to-png-in-place

None of the Safari browsers work with this, giving DOM Exception 18

http://stackoverflow.com/questions/8158312/rasterizing-an-in-document-svg-to-canvas

I think this is the relevant bug.

https://bugs.webkit.org/show_bug.cgi?id=119492

*/

var svgDataURL = function(svg) {
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');

  var svgAsXML = (new XMLSerializer).serializeToString(svg);
  return "data:image/svg+xml," + encodeURIComponent(svgAsXML);
};

clazz.prototype.pngURL = function(pngReady,out_width) {
    //var svg = document.getElementById('foobar');//this._canvas;
    var svg_data = this._canvas.cloneNode(true);
    var sequences = svg_data.querySelectorAll('text[data-spaces]');
    for (var i = 0; i < sequences.length; i++) {
        sequences[i].parentNode.removeChild(sequences[i]);
    }

    // Set up the aspect ratio of the output element
    var svg = document.createElementNS(svgns,'svg');
    svg.setAttribute('width',this._container_canvas.getBoundingClientRect().width);
    svg.setAttribute('height',this._container_canvas.getBoundingClientRect().height);
    svg.setAttribute('preserveAspectRatio','xMinYMin meet');

    var transform_group = document.createElementNS(svgns,'g');
    transform_group.setAttribute('transform',this._canvas.parentNode.getAttribute('transform'));
    svg.appendChild(transform_group);
    transform_group.appendChild(svg_data);

    // We are missing the defs elements from the containing node

    var all_defs = this._container_canvas.querySelectorAll('defs');
    for (var i = 0; i < all_defs.length; i++) {
        svg.appendChild(all_defs[i].cloneNode(true));
    }
    var can = document.createElement('canvas');
    var total_width = 2*parseInt(svg.getAttribute('width'));
    var total_height = 2*parseInt(svg.getAttribute('height'));
    if (out_width) {
        if (total_width > out_width) {
            var ratio = total_width / out_width;
            total_width = out_width;
            total_height = parseInt(total_height / ratio);
        }
    }
    can.width = total_width;
    can.height = total_height;
    var svgImg = new Image;
    svgImg.width  = 1;
    svgImg.height = 1;
    var ctx = can.getContext('2d');
    svgImg.onload = function(){
      ctx.drawImage(svgImg,0,0,can.width,can.height);
      pngReady(can.toDataURL());
    };
    svgImg.onerror = function() {
      console.log("Got an error");
    };
    var dataurl = svgDataURL(svg);
    svgImg.src = dataurl;
};

})(CondensedSequenceRenderer);

/**
 * Zoom level has changed for this renderer
 * @name    CondensedSequenceRenderer#zoomChange
 * @event
 * @param   {Object}    e
 */

CondensedSequenceRenderer.Zoom = function(renderer) {

/**
 *  @lends CondensedSequenceRenderer.prototype
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
    var transformer;
    var shifter;
    var accessors = { 
        setZoom: function(zoomLevel) {
            var container_width = renderer._container.cached_width;
            if ( ! container_width ) {
                container_width = renderer._container.clientWidth;
            }
            if ( ! renderer.sequence ) {
                zoom_level = zoomLevel;
                return;
            }
            var min_zoom_level = container_width / (2 * renderer.sequence.length);
            // if  (! renderer.grow_container ) {
            //     min_zoom_level = 0.3 / 2 * min_zoom_level;
            // }

            // var min_zoom_level = renderer.sequence ? (0.3 / 2) * container_width / renderer.sequence.length : 0.5;
            if (zoomLevel < min_zoom_level) {
                zoomLevel = min_zoom_level;
            }
            if (zoomLevel > 10) {
                zoomLevel = 10;
            }

            var self = this;

            if (zoomLevel == zoom_level) {
                if (this.refresh.suspended && self._canvas && self._canvas.zoom !== parseFloat(zoom_level)) {
                    self._canvas.zoom = parseFloat(zoom_level);
                    self._canvas.setScale(1);

                    bean.fire(self._canvas,'zoomChange');
                }
                return;
            }


            if (! self._canvas) {
                zoom_level = zoomLevel;
                return;
            }

            var no_touch_center = false;

            if (self.zoomCenter == 'center') {
                no_touch_center = true;
                self.zoomCenter = {'x' : self._RS*0.5*(self.leftVisibleResidue()+self.rightVisibleResidue()) };
            }
            
            if ( self.zoomCenter && ! center_residue ) {
                start_x = self._canvas.currentTranslateCache.x || 0;
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

            var scale_value = Math.abs(parseFloat(zoomLevel)/start_zoom);

            window.cancelAnimationFrame(transformer);
            transformer = window.requestAnimationFrame(function() {
                // Rendering bottleneck
                self._canvas.setScale(scale_value);

            });

            bean.fire(self._canvas,'_anim_begin');
            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('panstart',false,true);
                self._canvas.dispatchEvent(evObj);
            }
            var old_x = self._canvas.currentTranslateCache.x;
            if (center_residue) {
                var delta = ((start_zoom - zoom_level)/(scale_value*25))*center_residue;
                delta += start_x/(scale_value);
                cancelAnimationFrame(shifter);
                shifter = window.requestAnimationFrame(function() {

                    // Rendering bottleneck
                    self._canvas.setCurrentTranslateXY(delta,((start_zoom - zoom_level)/(scale_value))*self._axis_height*2);

                });
            }
        
            var end_function = function() {
                timeout = null;
                var scale_value = Math.abs(parseFloat(zoom_level)/start_zoom);

                self._canvas.setScale(null);

                bean.fire(self._canvas,'panend');
                bean.fire(self._canvas,'_anim_end');
                let zoomchange = function() {
                    bean.remove(self._canvas,'zoomChange',zoomchange);
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
                }
                bean.add(self._canvas,'zoomChange',zoomchange);
            
                if (self._canvas) {
                    self._canvas.zoom = parseFloat(zoom_level);
                    bean.fire(self._canvas,'zoomChange');
                }
                bean.fire(self,'zoomChange');
            };
        
            if (("ontouchend" in document) && self.zoomCenter && ! no_touch_center ) {
                bean.remove(self,'gestureend');
                let ender = function(){
                    bean.remove(self,'gestureend',ender);
                    end_function();
                };
                bean.add(self,'gestureend',ender);
                timeout = 1;
            } else {
                if (! this.refresh.suspended) {
                    timeout = setTimeout(end_function,100);
                } else {
                    end_function();
                }
            }
        },
        fitZoom: function() {
            var container_width = renderer._container.cached_width;
            if ( ! container_width ) {
                container_width = renderer._container.clientWidth;
            }
            var min_zoom_level = 0.5;
            if (renderer.sequence) {
                min_zoom_level = container_width / (2 * renderer.sequence.length);
            }
            renderer.zoom = min_zoom_level;
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

    renderer.fitZoom = accessors.fitZoom;

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
    
})(CondensedSequenceRenderer);

CondensedSequenceRenderer.Navigation = Navigation;

export default CondensedSequenceRenderer;

/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
 */

/*
 *  Include the svgweb library when we include this script. Set the SVGWEB_PATH environment variable if
 *  you wish to retrieve svgweb from a relative path other than ./svgweb/src
 */
if (document.write && (typeof svgweb == 'undefined') && (typeof SVGWEB_LOADING == 'undefined') && ! window.svgns ) {

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


(function() {
    var scripts = document.getElementsByTagName("script");
    var src = scripts[scripts.length-1].src;
    src = src.replace(/[^\/]+$/,'');
    MASCP.CondensedSequenceRenderer._BASE_PATH = src;
})();

MASCP.CondensedSequenceRenderer.prototype._createCanvasObject = function() {
    var renderer = this;

    if (this._object) {
        if (typeof svgweb != 'undefined') {
            svgweb.removeChild(this._object, this._object.parentNode);
        } else {
            this._object.parentNode.removeChild(this._object);
        }
        this._canvas = null;
        this._object = null;
        this._layer_containers = null;
    }

    var canvas = document.createElement('object',true);


    canvas.setAttribute('data',MASCP.CondensedSequenceRenderer._BASE_PATH+'blank.svg');
//    canvas.setAttribute('data','data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxzdmcNCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciDQogICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciDQogICB2ZXJzaW9uPSIxLjEiDQogICB3aWR0aD0iMTAwJSINCiAgIGhlaWdodD0iMTAwJSINCj4NCjwvc3ZnPg==');

    canvas.setAttribute('type','image/svg+xml');
    canvas.setAttribute('width','100%');
    canvas.setAttribute('height','100%');
    canvas.style.display = 'block';
    
    if ( ! canvas.addEventListener ) {    
        canvas.addEventListener = function(ev,func) {
            this.attachEvent(ev,func);
        };
    }
    

    var has_svgweb = typeof svgweb != 'undefined';

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

    canvas.addEventListener(has_svgweb ? 'SVGLoad' : 'load',function() {
        var container_canv = (this.contentDocument || this.getAttribute('contentDocument')).rootElement;
        
        var nav_group = document.createElementNS(svgns,'g');
        renderer._nav_canvas = document.createElementNS(svgns,'svg');
        
        var group = document.createElementNS(svgns,'g');        
        renderer._canvas = document.createElementNS(svgns,'svg');

        var canv = renderer._canvas;

        var supports_events = true;

        try {
            var noop = canv.addEventListener;
        } catch (err) {
            supports_events = false;
        }

        if (supports_events) {
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
        
        
        var canvas_rect = document.createElementNS(svgns,'rect');
        canvas_rect.setAttribute('x','-10%');
        canvas_rect.setAttribute('y','-10%');
        canvas_rect.setAttribute('width','120%');
        canvas_rect.setAttribute('height','120%');
        canvas_rect.setAttribute('style','fill: #ffffff;');
        renderer._canvas.appendChild(canvas_rect);
        
                
        container_canv.appendChild(group);        

        group.appendChild(renderer._canvas);
        
        
        var left_fade = document.createElementNS(svgns,'rect');
        left_fade.setAttribute('x','0');
        left_fade.setAttribute('y','0');
        left_fade.setAttribute('width','50');
        left_fade.setAttribute('height','100%');
        left_fade.setAttribute('style','fill: url(#left_fade);');

        var right_fade = document.createElementNS(svgns,'rect');
        right_fade.setAttribute('x','100%');
        right_fade.setAttribute('y','0');
        right_fade.setAttribute('width','50');
        right_fade.setAttribute('height','100%');
        right_fade.setAttribute('style','fill: url(#right_fade);');
        right_fade.setAttribute('transform','translate(-50,0)');

        if (! MASCP.IE) {

        jQuery(renderer._canvas).bind('pan',function() {
            if (renderer._canvas.currentTranslate.x >= 0) {
                left_fade.setAttribute('visibility','hidden');
            } else {
                left_fade.setAttribute('visibility','visible');
            }
        });
        
        jQuery(renderer._canvas).bind('_anim_begin',function() {
            left_fade.setAttribute('visibility','hidden');
        });
        
        jQuery(renderer._canvas).bind('_anim_end',function() {
            jQuery(renderer._canvas).trigger('pan');
        });
        }

        if (renderer._canvas.currentTranslate.x >= 0) {
            left_fade.setAttribute('visibility','hidden');
        }
        
        container_canv.appendChild(left_fade);
        container_canv.appendChild(right_fade);
        
        
        container_canv.appendChild(nav_group);
        nav_group.appendChild(renderer._nav_canvas);



        renderer._canvas.setCurrentTranslateXY = function(x,y) {
                var curr_transform = group.getAttribute('transform').replace(/translate\([^\)]+\)/,'');
                curr_transform = curr_transform + ' translate('+x+', '+y+') ';
                group.setAttribute('transform',curr_transform);
                this.currentTranslate.x = x;
                this.currentTranslate.y = y;
        };
        
        renderer._nav_canvas.setCurrentTranslateXY = function(x,y) {
                var curr_transform = nav_group.getAttribute('transform').replace(/translate\([^\)]+\)/,'');
                curr_transform = curr_transform + ' translate('+x+', '+y+') ';
                nav_group.setAttribute('transform',curr_transform);
                this.currentTranslate.x = x;
                this.currentTranslate.y = y;
        };
        

        renderer._nav_canvas.show = function() {

            if (nav) {
                canv.style.GomapScrollLeftMargin = nav._width_shift;
            }
            renderer._canvas.setCurrentTranslateXY(renderer._canvas.currentTranslate.x, renderer._canvas.currentTranslate.y);            
        };
        
        renderer._nav_canvas.hide = function() {
            renderer._canvas.setCurrentTranslateXY(renderer._canvas.currentTranslate.x, renderer._canvas.currentTranslate.y);
            canv.style.GomapScrollLeftMargin = 1000;
        }
        
        renderer._addNav();

        var nav = renderer._Navigation;

        
        renderer._container_canvas = container_canv;
        container_canv.setAttribute('preserveAspectRatio','xMinYMin meet');
        container_canv.setAttribute('width','100%');
        container_canv.setAttribute('height','100%');
        
        renderer._canvas._canvas_height = 0;
        renderer._object = this;
        jQuery(renderer).trigger('svgready');
    },false);
    
    return canvas;
};

MASCP.CondensedSequenceRenderer.prototype._addNav = function() {
    this._Navigation = new MASCP.CondensedSequenceRenderer.Navigation(this._nav_canvas);
    var nav = this._Navigation;
    var self = this;
    
    nav._spliceTrack = function(track,before,after){
        // if (! (track && (before || after))) {
        //     return;
        // }

        var t_order = self._track_order;
        
        t_order.trackIndex = function(tr) {
            if (! tr ) {
                return this.length;
            }
            return this.indexOf(tr.name);
        };
        
        if (after && ! before) {
            before = MASCP.getLayer(t_order[t_order.trackIndex(after) + 1]);
        }
        
        
        t_order.splice(t_order.trackIndex(track),1);
        
        var extra_to_push = [];
        if (track._group_controller) {
            var group_layers = track._group_under_control._layers;
            for (var j = 0; j < group_layers.length; j++ ) {
                extra_to_push.push(t_order.splice(t_order.trackIndex(group_layers[j]),1)[0]);
            }
        }
        if (before) {
            t_order.splice(t_order.trackIndex(before),1,track.name, before ? before.name : undefined );
            for (var i = 0; i < extra_to_push.length; i++ ) {
                if (extra_to_push[i]) {
                    t_order.splice(t_order.trackIndex(before),0,extra_to_push[i]);
                }
            }
        } else {
            if (track._group_controller) {
                self.hideGroup(track._group_under_control);                
            }
            self.hideLayer(track);            
            track.disabled = true;
        }
        self.trackOrder = t_order;
        
    };
    
    var hide_chrome = function() {
        nav.demote(); 
        nav.hideFilters();        
    };
    
    var show_chrome = function() {
        nav.promote(); 
        nav.showFilters();        
    }

    if ( ! MASCP.IE ) {
    jQuery(this._canvas).bind('panstart',hide_chrome);
    jQuery(this._canvas).bind('panend',show_chrome);
    jQuery(this._canvas).bind('_anim_begin',hide_chrome);
    jQuery(this._canvas).bind('_anim_end',show_chrome);
    }
};

MASCP.CondensedSequenceRenderer.Navigation = function(canvas) {
    this._RS = 1;
    this._extendWithSVGApi(canvas);

    this._canvas = canvas;

    this._buildNavPane(canvas);
    
    var close_group = canvas.lastChild;
    track_group = canvas.group();

    canvas.insertBefore(track_group,close_group);


    var track_canvas = document.createElementNS(svgns,'svg');    
    this._buildTrackPane(track_canvas);

    track_group.appendChild(track_canvas);

    track_group.setAttribute('clip-path','url(#nav_clipping)');
    
    this._track_canvas = track_group;
    
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.hideFilters = function() {
    this._nav_pane_back.removeAttribute('filter');
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.showFilters = function() {
    if (this._is_open) {
        this._nav_pane_back.setAttribute('filter','url(#drop_shadow)');
    }
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.demote = function() {
    var canv = this._track_canvas;
    if (canv.fader) {
        window.clearTimeout(canv.fader);
    }
    canv.setAttribute('display','none');
    return;
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.promote = function() {
    var canv = this._track_canvas;
    if (canv.fader) {
        window.clearTimeout(canv.fader);
    }
    canv.setAttribute('display',this.visible() ? 'inline' : 'none');
};


MASCP.CondensedSequenceRenderer.Navigation.prototype._buildNavPane = function(canvas) {
    var self = this;
    
    var panel_back = canvas.group();
    var button_group = canvas.group();
    
    var rect = canvas.rect(-10,0,'200','100%');
    rect.setAttribute('rx','10');
    rect.setAttribute('ry','10');    
    if (! ("ontouchend" in document)) {
        rect.setAttribute('opacity','0.8');
    }
    rect.style.stroke = '#000000';
    rect.style.strokeWidth = '2px';
    rect.style.fill = '#000000';
    rect.id = 'nav_back';

    rect.setAttribute('filter','url(#drop_shadow)');

    this._nav_pane_back = rect;

    panel_back.push(rect);

    var clipping = document.createElementNS(svgns,'clipPath');
    clipping.id = 'nav_clipping';
    var rect2 = document.createElementNS(svgns,'use');
    rect2.setAttributeNS('http://www.w3.org/1999/xlink','href','#nav_back');
    
    //canvas.rect(0,0,'190','100%');
    canvas.insertBefore(clipping,canvas.firstChild);
    clipping.appendChild(rect2);

    var close_group = canvas.crossed_circle('179','12','10');

    close_group.style.cursor = 'pointer';

    button_group.push(close_group);

    var tracks_button = MASCP.IE ? canvas.svgbutton(100,5,65,25,'Edit') : canvas.button(100,5,65,25,'Edit');
    tracks_button.id = 'controls';
    tracks_button.parentNode.setAttribute('clip-path','url(#nav_clipping)');

    panel_back.push(MASCP.IE ? tracks_button : tracks_button.parentNode);

    var scroll_controls = document.createElementNS(svgns,'foreignObject');
    scroll_controls.setAttribute('x','0');
    scroll_controls.setAttribute('y','0');
    scroll_controls.setAttribute('width','100');
    scroll_controls.setAttribute('height','45');
    scroll_controls.setAttribute('clip-path',"url(#nav_clipping)");
    
    panel_back.push(scroll_controls);
    
    jQuery(self).bind('toggleEdit',function() {
        self.edit_enabled = typeof self.edit_enabled == 'undefined' ? true : ! self.edit_enabled;
        self.drag_disabled = ! self.edit_enabled;
        
        if (self.edit_enabled) {
            self._beginRotation();
        } else {
            self._endRotation();
        }
        
        self._close_buttons.forEach(function(button) {
            button.setAttribute('visibility', self.edit_enabled ? 'visible' : 'hidden');
        });
        self._controller_buttons.forEach(function(button) {
            button.setAttribute('visibility', self.edit_enabled ? 'hidden' : 'visible');
        });

    });
        
    tracks_button.addEventListener('click',function() {
        jQuery(self).trigger('toggleEdit');
        jQuery(self).trigger('click');
    },false);
    
    var visible = true;

    var toggler = function(vis) {
        visible = ( vis == false || vis == true ) ? vis : ! visible;
        if (visible) {
            self._track_canvas.setAttribute('display','inline');
            panel_back.setAttribute('visibility','visible');
            canvas.show();

            rect.setAttribute('filter','url(#drop_shadow)');
            close_group._button.removeAttribute('filter');
            var close_transform = close_group.getAttribute('transform') || ' ';
            close_transform = close_transform.replace(/translate\(.*\)/,'');
            close_transform = close_transform.replace(/rotate\(.*\)/,'');
            
            close_group.setAttribute('transform',close_transform);

            scroll_controls.setAttribute('display','inline');
        } else {
            self._track_canvas.setAttribute('display','none');
            panel_back.setAttribute('visibility','hidden');
            canvas.hide();
            rect.removeAttribute('filter');
            close_group._button.setAttribute('filter','url(#drop_shadow)');            
            var close_transform = close_group.getAttribute('transform') || ' ';
            close_transform = close_transform + ' translate(-150,0) rotate(45,179,12) ';
            close_group.setAttribute('transform',close_transform);
            scroll_controls.setAttribute('display','none');
        }
        self._is_open = visible;
        return true;
    };
    
    this._is_open = true;
    this._toggler = toggler;
    this.hide = function() {
        toggler.call(this,false);
    };
    this.show = function() {
        toggler.call(this,true);
    };
    this.visible = function() {
        return this._is_open;
    }
    
    this.setZoom = function(zoom) {
        this._zoom_scale = zoom;
        close_group.setAttribute('transform','scale('+zoom+','+zoom+') ');
        rect.setAttribute('transform','scale('+zoom+',1) ');
    }
    
    close_group.addEventListener('click',toggler,false);    
};

MASCP.CondensedSequenceRenderer.Navigation.prototype._enableDragAndDrop = function(handle,element,track,canvas) {
        var nav = this;

        if ( typeof nav.drag_disabled == 'undefined') {
            nav.drag_disabled = true;
        }

        var self = arguments.callee;
        self.in_drag = false;

        if ( ! self.targets ) {
            self.targets = [];
        }
        
        self.targets.push(element);

        self.resetDrag = function() {
            window.clearTimeout(self._anim);
            window.clearTimeout(self._hover_timeout);
            for (var i = 0; i < self.targets.length; i++) {
                if (self.targets[i] != self.drag_el) {
                    self.targets[i].removeAttribute('transform');
                    self.targets[i].setAttribute('pointer-events','all');
                }
            }
        };

        var beginDragging = function(ev,tr,lbl_grp) {
            
            if (nav.drag_disabled) {
                return;
            }

            var target = canvas.nearestViewportElement;

            if (self.in_drag) {
                return;                
            }


            self.spliceBefore = null;
            self.spliceAfter = null;            

            var p_orig = lbl_grp.nearestViewportElement.createSVGPoint();

            p_orig.x = ev.pageX;
            p_orig.y = ev.pageY;

            var rootCTM = lbl_grp.nearestViewportElement.getScreenCTM();
            var matrix = rootCTM.inverse();

            p_orig = p_orig.matrixTransform(matrix);

            var oX = p_orig.x;
            var oY = p_orig.y;

            var dragfn = function(e) {
                var p = lbl_grp.nearestViewportElement.createSVGPoint();
                p.x = e.pageX;
                p.y = e.pageY;
                p = p.matrixTransform(matrix);

                var dX = (p.x - oX);
                var dY = (p.y - oY);
                var curr_transform = lbl_grp.getAttribute('transform') || '';
                curr_transform = curr_transform.replace(/translate\([^\)]+\)/,'');
                curr_transform += ' translate('+dX+','+dY+') ';
                lbl_grp.setAttribute('transform',curr_transform);
                e.stopPropagation();
                return false;
            };


            var enddrag = function(e) {
                if (e.relatedTarget && (e.relatedTarget == lbl_grp || e.relatedTarget.nearestViewportElement == lbl_grp.nearestViewportElement || e.relatedTarget.nearestViewportElement == target)) {
                    if (self.in_drag && self.targets.indexOf(e.relatedTarget) >= 0) {                        
                        self.resetDrag();
                    }
                    return;
                }

                if (self.in_drag && e.type == 'mouseup') {
                    if (self.spliceBefore || self.spliceAfter) {
                        nav._spliceTrack(self.trackToSplice, self.spliceBefore, self.spliceAfter);
                    }
                }

                target.removeEventListener('mousemove',dragfn,false);
                target.removeEventListener('mouseup',arguments.callee,false);
                target.removeEventListener('mouseout',arguments.callee,false);
                if (self.in_drag) {
                    lbl_grp.setAttributeNS(null, 'pointer-events', 'all');
                    lbl_grp.removeAttribute('transform');
                    self.resetDrag();
                    self.in_drag = false;
                }
            };

            lbl_grp.setAttributeNS(null, 'pointer-events', 'none');

            target.addEventListener('mousemove',dragfn,false);
            target.addEventListener('mouseup',enddrag,false);
            target.addEventListener('mouseout',enddrag,false);
            
            self.in_drag = track;
            self.drag_el = lbl_grp;
        };

        handle.addEventListener('mousedown',function(e) {
            beginDragging(e,track,element);
        },false);

        element.addEventListener('mousemove',function(e) {
            if ( self.in_drag && self.in_drag != track ) {
                if (self._hover_timeout) {
                    window.clearTimeout(self._hover_timeout);
                }
                self._hover_timeout = window.setTimeout(function() {
                    if ( (self.in_drag.group || track.group) &&                    
                         (self.in_drag.group ? track.group :  ! track.group ) ) {
                        if (self.in_drag.group.name != track.group.name) {
                            return;
                        }
                    } else {
                        if ( self.in_drag.group || track.group ) {
                            return;
                        }
                    }

                    if (self._anim) {
                        window.clearTimeout(self._anim);
                    }
                    
                    self.resetDrag();
                    
                    var current_sibling = element;
                    
                    var elements_to_shift = [];

                    while (current_sibling) {
                        if (current_sibling != self.drag_el && self.targets.indexOf(current_sibling) >= 0) {
                            elements_to_shift.push(current_sibling);
                        }
                        current_sibling = current_sibling.nextSibling;
                        if (current_sibling == self.drag_el) {
                            break;
                        }
                    }
                    
                    current_sibling = element;
                    
                    if (self.targets.indexOf(element) < self.targets.indexOf(self.drag_el) ) {
                        current_sibling = element.previousSibling;
                    }
                    
                    var elements_to_shift_up = [];
                    
                    while (current_sibling) {
                        if (current_sibling != self.drag_el && self.targets.indexOf(current_sibling) >= 0) {
                            elements_to_shift_up.push(current_sibling);
                        }
                        current_sibling = current_sibling.previousSibling;
                        if (current_sibling == self.drag_el) {
                            break;
                        }
                    }

                    var anim_steps = 1;

                    var height = 100;

                    self._anim = window.setTimeout(function() {
                        
                        if (anim_steps < 5) {
                            for (var i = 0; i < elements_to_shift.length; i++ ) {
                                var curr_transform = elements_to_shift[i].getAttribute('transform') || '';
                                curr_transform = curr_transform.replace(/translate\([^\)]+\)/,'');
                                curr_transform += ' translate(0,'+anim_steps*height+')';
                                elements_to_shift[i].setAttribute('transform',curr_transform);
                            }

                            for (var i = 0; i < elements_to_shift_up.length; i++ ) {

                                var curr_transform = elements_to_shift_up[i].getAttribute('transform') || '';
                                curr_transform = curr_transform.replace(/translate\([^\)]+\)/,'');
                                curr_transform += ' translate(0,'+anim_steps*-1*height+')';
                                elements_to_shift_up[i].setAttribute('transform',curr_transform);
                            }


                            anim_steps += 1;
                            self._anim = window.setTimeout(arguments.callee,1);
                        } else {
                            if (self.targets.indexOf(element) > self.targets.indexOf(self.drag_el)) {
                                self.spliceAfter = track;
                            } else {
                                self.spliceBefore = track;
                            }
                            self.trackToSplice = self.in_drag;
                        }
                    },1);

                },300);
            }
        },false);
}

MASCP.CondensedSequenceRenderer.Navigation.prototype._beginRotation = function() {
    var self = this;
    if (self._rotators) {
        var start = (new Date()).getTime();
        var rate = 75;
        if (self._rotator_anim) {
            clearInterval(self._rotator_anim);
        }
        self._rotator_anim = setInterval(function() {
            var end = (new Date()).getTime();
            var step = parseInt((end - start) / rate);
            self._rotators.forEach(function(rot) {
               rot(step); 
            });
        },rate);
    }
};

MASCP.CondensedSequenceRenderer.Navigation.prototype._endRotation = function() {
    if (self._rotators) {
        if (self._rotator_anim) {
            clearInterval(self._rotator_anim);
        }        
    }    
};

MASCP.CondensedSequenceRenderer.Navigation.prototype._buildTrackPane = function(canvas) {
    var self = this;
    this._extendWithSVGApi(canvas);

    canvas.setAttribute('preserveAspectRatio','xMinYMin meet');
    
    this.clearTracks = function() {
        while (canvas.firstChild) 
            canvas.removeChild(canvas.firstChild);
        this._enableDragAndDrop.targets = null;
    };
    
    this.setViewBox = function(viewBox) {
        canvas.setAttribute('viewBox',viewBox);
    }
    
    this.setDimensions = function(width,height) {
        canvas.style.height = height;
        canvas.style.width = width;
        canvas.setAttribute('height',height);        
        canvas.setAttribute('width',width);
    }
    
    this.renderTrack = function(track,y,height,options) {
        var label_group = canvas.group();
        var a_rect = canvas.rect(0,y-1*height,'100%',3*height);
        a_rect.setAttribute('stroke','#000000');
        a_rect.setAttribute('stroke-width','2');
        a_rect.setAttribute('fill','url(#simple_gradient)');
        a_rect.setAttribute('opacity','0.1');
        
        self._rotators = self._rotators || [];
                
        label_group.push(a_rect);

        // Use these for debugging positioning
        
        // var r = canvas.rect(0,y-height,height,height);
        // r.setAttribute('fill','#ff0000');
        // label_group.push(r);
        // 
        // r = canvas.rect(0,y+height,height,height);
        // r.setAttribute('fill','#ff0000');
        // label_group.push(r);
        
        
        var text_scale = (options && options['font-scale']) ? options['font-scale'] : 1;
        if ("ontouchend" in document) {
            var text_left = 8*height*text_scale;
        } else {
            var text_left = 4*height*text_scale;            
        }
        var a_text = canvas.text(text_left,y+0.5*height,track.fullname);
        a_text.setAttribute('height', 2*height);
        a_text.setAttribute('width', 2*height);
        a_text.setAttribute('font-size',2*height*text_scale);
        a_text.setAttribute('fill','#ffffff');
        a_text.setAttribute('stroke','#ffffff');
        a_text.setAttribute('stroke-width','1');
        a_text.setAttribute('dominant-baseline', 'middle');

        // r = canvas.rect(3*height*text_scale,y+0.5*height,2*height,2*height);
        // r.setAttribute('fill','#00ff00');
        // label_group.push(r);

        label_group.push(a_text);
        
        a_text.setAttribute('pointer-events','none');
        
        
        if (track.href && ! track._group_controller) {
            a_anchor = canvas.a(track.href);
            var icon_name = null;
            var url_type = track.href;
            if (typeof url_type === 'string' && url_type.match(/^javascript\:/)) {
                icon_name = '#plus_icon';
            } else if (typeof url_type === 'function') {
                icon_name = '#plus_icon';
                a_anchor.setAttribute('href','#');
                a_anchor.removeAttribute('target');
                a_anchor.addEventListener('click',function(e) {
                    url_type.call();

                    if (e.preventDefault) e.preventDefault();
                    else e.returnResult = false;
                    if (e.stopPropagation) e.stopPropagation();
                    else e.cancelBubble = true;

                    return false;
                },false);
            } else {
                icon_name = '#new_link_icon';
            }
            if (track.icon) {
                icon_name = track.icon;
            }
            var icon_metrics = [0.5*height*text_scale,0,2.5*height*text_scale];
            if ("ontouchend" in document) {
                icon_metrics[2] = icon_metrics[2] * 2;
            }
            icon_metrics[1] = y - 0.5*(icon_metrics[2] - height);
            var a_use = canvas.use(icon_name,icon_metrics[0],icon_metrics[1],icon_metrics[2],icon_metrics[2]);
            a_use.style.cursor = 'pointer';
            a_anchor.appendChild(a_use);
        }
        
        label_group.addEventListener('touchstart',function() {
            label_group.onmouseover = undefined;
            label_group.onmouseout = undefined;
        },false);

        label_group.addEventListener('touchend',function() {
            label_group.onmouseover = undefined;
            label_group.onmouseout = undefined;
        },false);
        
        this._enableDragAndDrop(a_rect,label_group,track,canvas);
        
        (function() {
            
            if (track.group) {
                return;
            }
            
            var t_height = 1.5*height;            
            if ("ontouchend" in document) {
                t_height = 3*height;
            }
            if ( ! self._close_buttons) {
                self._close_buttons = [];
            }
            
            var closer = canvas.crossed_circle(1.5*t_height,0,t_height);
            closer.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
            closer.firstChild.setAttribute('fill','#ff0000');
            for (var nodes = closer.childNodes, i = 0, len = nodes.length; i < len; i++) {
                nodes[i].setAttribute('stroke-width',(t_height/4).toString());
            };
            closer.addEventListener('click',function() {
                self._spliceTrack(track);
            },false);
            label_group.push(closer);
            self._close_buttons.push(closer);
            closer.setAttribute('visibility', self.edit_enabled ? 'visible' : 'hidden');

            if ("ontouchend" in document) {
                var dir = 1;
                self._rotators.push(function(step) {
                    if ( ! label_group.parentNode ) {
                        return;
                    }
                    var curr_transform = closer.getAttribute('transform') || '';
                    var delta = (step % 6);
                    if ((step % 6) == 0) {
                        dir *= -1;
                    }
                    var angle = dir < 0 ? 3 : -3;
                    angle += dir*delta;
                    var angle = ((step % 12) / 2) - 6;
                    
                    curr_transform = curr_transform.replace(/^\s*rotate\([^\)]+\)/,'');
                    curr_transform = 'rotate('+angle+','+(closer.getBBox().x +(closer.getBBox().width/2)) +','+(y+(height/2))+') '+curr_transform;
                    closer.setAttribute('transform',curr_transform);
                });
            }

            
        })();
        
        
        if (track._group_controller) {
            if ( ! self._controller_buttons) {
                self._controller_buttons = [];
            }

            var t_height = 1.5*height;            
            if ("ontouchend" in document) {
                t_height = 3*height;
            }
            var expander = canvas.group();
            var circ = canvas.circle(1.5*t_height,0,t_height);
            circ.setAttribute('fill','#ffffff');
            circ.setAttribute('opacity','0.1');
            expander.push(circ);

            var t_metrics = [1.1*t_height,-1.25*t_height,2.25*t_height,(-0.5*t_height),1.1*t_height,0.25*t_height];
            
            t_metrics[1] += 0.5*(t_height - 0*height);
            t_metrics[3] += 0.5*(t_height - 0*height);
            t_metrics[5] += 0.5*(t_height - 0*height);

            
            var group_toggler = canvas.poly(''+t_metrics[0]+','+t_metrics[1]+' '+t_metrics[2]+','+t_metrics[3]+' '+t_metrics[4]+','+t_metrics[5]);
            if (track._isExpanded()) {
                expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+') rotate(90,'+(1.5*t_height)+','+t_metrics[3]+')');
            } else {
                expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
            }
            group_toggler.setAttribute('height', 1.75*t_height);
            group_toggler.setAttribute('font-size',1.5*t_height);
            group_toggler.setAttribute('fill','#ffffff');
            group_toggler.setAttribute('dominant-baseline','central');
            group_toggler.setAttribute('pointer-events','none');
            
            expander.push(group_toggler);

            expander.style.cursor = 'pointer';
            expander.addEventListener('click',function(e) {
                e.stopPropagation();
                jQuery(track).trigger('_expandevent');
                if (track._isExpanded()) {
                    expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+') rotate(90,'+(1.5*t_height)+','+t_metrics[3]+')');                
                } else {
                    expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
                }
            },false);
            label_group.push(expander);

            self._controller_buttons.push(expander);
            expander.setAttribute('visibility', self.edit_enabled ? 'hidden' : 'visible');            
        }
    };
};

MASCP.CondensedSequenceRenderer.prototype._extendWithSVGApi = function(canvas) {
    // We're going to use a render scale (RS) so we scale up the dimensions of the
    // whole widget
    
    var RS = this._RS;
    var renderer = this;
    
    canvas.path = function(pathdesc) {
      var a_path = document.createElementNS(svgns,'path');
      a_path.setAttribute('d', pathdesc);
      a_path.setAttribute('stroke','#000000');
      a_path.setAttribute('stroke-width','1');
      this.appendChild(a_path);
      return a_path;
    };

    canvas.poly = function(points) {
       var a_poly = document.createElementNS(svgns,'polygon');
       a_poly.setAttribute('points',points);
       this.appendChild(a_poly);
       return a_poly;
    }

    canvas.circle = function(x,y,radius) {
        var a_circle = document.createElementNS(svgns,'circle');
        a_circle.setAttribute('cx', typeof x == 'string' ? x : x * RS);
        a_circle.setAttribute('cy', typeof y == 'string' ? y : y * RS);
        a_circle.setAttribute('r', typeof radius == 'string' ? radius : radius * RS);        
        this.appendChild(a_circle);
        return a_circle;
    };

    canvas.group = function() {
        var a_g = document.createElementNS(svgns,'g');
        this.appendChild(a_g);
        a_g.push = function(new_el) {
            a_g.appendChild(new_el);
        };
        
        return a_g;
    };
    
    canvas.line = function(x,y,x2,y2) {
        var a_line = document.createElementNS(svgns,'line');
        a_line.setAttribute('x1', typeof x == 'string' ? x : x * RS);
        a_line.setAttribute('y1', typeof y == 'string' ? y : y * RS);
        a_line.setAttribute('x2', typeof x2 == 'string' ? x2 : x2 * RS);
        a_line.setAttribute('y2', typeof y2 == 'string' ? y2 : y2 * RS);
        this.appendChild(a_line);
        return a_line;        
    };

    canvas.rect = function(x,y,width,height) {
      var a_rect = document.createElementNS(svgns,'rect');
      a_rect.setAttribute('x', typeof x == 'string' ? x : x * RS);
      a_rect.setAttribute('y', typeof y == 'string' ? y : y * RS);
      a_rect.setAttribute('width', typeof width == 'string' ? width : width * RS);
      a_rect.setAttribute('height', typeof height == 'string' ? height : height * RS);
      a_rect.setAttribute('stroke','#000000');
//      a_rect.setAttribute('shape-rendering','optimizeSpeed');
      this.appendChild(a_rect);
      return a_rect;
    };

    canvas.use = function(ref,x,y,width,height) {
        var a_use = document.createElementNS(svgns,'use');
        a_use.setAttribute('x', typeof x == 'string' ? x : x * RS);
        a_use.setAttribute('y', typeof y == 'string' ? y : y * RS);
        a_use.setAttribute('width', typeof width == 'string' ? width : width * RS);
        a_use.setAttribute('height', typeof height == 'string' ? height : height * RS);
        a_use.setAttributeNS('http://www.w3.org/1999/xlink','href',ref);
        this.appendChild(a_use);
                
        return a_use;        
    };

    canvas.a = function(href) {
        var a_anchor = document.createElementNS(svgns,'a');
        a_anchor.setAttribute('target','_new');        
        a_anchor.setAttributeNS('http://www.w3.org/1999/xlink','href',href);
        this.appendChild(a_anchor);
        return a_anchor;
    };

    canvas.button = function(x,y,width,height,text) {
        var fo = document.createElementNS(svgns,'foreignObject');
        fo.setAttribute('x',0);
        fo.setAttribute('y',0);
        fo.setAttribute('width',x+width);
        fo.setAttribute('height',y+height);
        fo.style.position = 'absolute';
        this.appendChild(fo);
        var button = document.createElement('button');
        button.style.display = 'block';
        button.style.position = 'relative';
        button.style.top = y+'px';
        button.style.left = x+'px';
        button.textContent = text;
        fo.appendChild(button);
        return button;
    }

    canvas.svgbutton = function(x,y,width,height,text) {
        var button = this.group();
        var back = this.rect(x,y,width,height);
        back.setAttribute('rx','10');
        back.setAttribute('ry','10');
        back.setAttribute('stroke','#ffffff');
        back.setAttribute('stroke-width','2');
        back.setAttribute('fill','url(#simple_gradient)');
        x = back.x.baseVal.value;
        y = back.y.baseVal.value;
        width = back.width.baseVal.value;
        height = back.height.baseVal.value;
        
        var text = this.text(x+width/2,y+(height/3),text);        
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'hanging');
        text.setAttribute('font-size',0.5*height);
        text.setAttribute('fill','#ffffff');
        button.push(back);
        button.push(text);
        button.background_element = back;
        button.text_element = text;
        
        button.setAttribute('cursor','pointer');
        var button_trigger = function() {
            back.setAttribute('fill','#999999');
            back.setAttribute('stroke','#000000');
        };
        button.addEventListener('mousedown',button_trigger,false);
        button.addEventListener('touchstart',button_trigger,false);
        var button_reset = function() {
            back.setAttribute('stroke','#ffffff');
            back.setAttribute('fill','url(#simple_gradient)');
        };
        button.addEventListener('mouseup',button_reset,false);
        button.addEventListener('mouseout',button_reset,false);
        button.addEventListener('touchend',button_reset,false);
        return button;
    };

    canvas.growingMarker = function(x,y,symbol,opts) {
        var container = document.createElementNS(svgns,'svg');
        container.setAttribute('viewBox', '-50 -100 150 300');
        container.setAttribute('preserveAspectRatio', 'xMinYMin meet');
        container.setAttribute('x',x);
        container.setAttribute('y',y);
        var the_marker = this.marker(50/RS,50/RS,50/RS,symbol,opts);
        container.appendChild(the_marker);
        container.contentElement = the_marker.contentElement;
        var result = this.group();
        result.appendChild(container);
        return result;
    };

    canvas.marker = function(cx,cy,r,symbol,opts) {
        var units = 0;
        if (typeof cx == 'string') {
            var parts = new RegExp(/(\d+)(.*)/g).exec(cx);
            units = parts[2];
            cx = parseFloat(parts[1]);
            
            parts = new RegExp(/(\d+)(.*)/g).exec(cy);
            cy = parseFloat(parts[1]);
            
            parts = new RegExp(/(\d+)(.*)/g).exec(r);
            r = parseFloat(parts[1]);        

        }

        var dim = {
            CX      : cx+units,
            CY      : cy+units,
            R       : r+units,
            MIN_X   : (cx-r)+units,
            MAX_X   : (cx+r)+units,
            MIN_Y   : (cy-r)+units,
            MAX_Y   : (cy+r)+units,
            MID_X1  : (cx-(r/2))+units,
            MID_X2  : (cx+(r/2))+units,
            MID_Y1  : (cy-(r/2))+units,
            MID_Y2  : (cy+(r/2))+units
        };

        var marker = this.group();

        var fill_color = (opts && opts['border']) ? opts['border'] : 'rgb(0,0,0)';

        marker.push(this.circle(0,-0.5*r,r));
        
        marker.lastChild.style.fill = fill_color;
        
        marker.push(this.circle(0,1.5*r,r));

        marker.lastChild.style.fill = fill_color;

        var arrow = this.poly((-0.9*r*RS)+','+(0*r*RS)+' 0,'+(-2.5*r*RS)+' '+(.9)*r*RS+','+(0*r*RS));
        
        
        arrow.setAttribute('style','fill:'+fill_color+';stroke-width: 0;');
        marker.push(arrow);
        marker.setAttribute('transform','translate('+((cx)*RS)+','+0.5*cy*RS+') scale(1)');
        marker.setAttribute('height', dim.R*RS);
        if (typeof symbol == 'string') {
            marker.contentElement = this.text_circle(0,0.5*r,1.75*r,symbol,opts);
            marker.push(marker.contentElement);
        } else {
            marker.contentElement = this.group();
            if (symbol) {
                marker.contentElement.push(symbol);
            }
            marker.push(marker.contentElement);
        }
        return marker;
    };

    canvas.text_circle = function(cx,cy,r,txt,opts) {
        var cx,cy,r;

        if ( ! opts ) {
            opts = {};
        }        

        var units = 0;

        if (typeof cx == 'string') {
            var parts = new RegExp(/(\d+)(.*)/g).exec(cx);
            units = parts[2];
            cx = parseFloat(parts[1]);
            
            parts = new RegExp(/(\d+)(.*)/g).exec(cy);
            cy = parseFloat(parts[1]);
            
            parts = new RegExp(/(\d+)(.*)/g).exec(r);
            r = parseFloat(parts[1]);        

        }
        var dim = {
            CX      : cx+units,
            CY      : cy+units,
            R       : r+units,
            MIN_X   : (cx-r)+units,
            MAX_X   : (cx+r)+units,
            MIN_Y   : (cy-r)+units,
            MAX_Y   : (cy+r)+units,
            MID_X1  : (cx-(r/2))+units,
            MID_X2  : (cx+(r/2))+units,
            MID_Y1  : (cy-(r/2))+units,
            MID_Y2  : (cy+(r/2))+units
        };

        var marker_group = this.group();

        var back = this.circle(0,dim.CY,9/10*dim.R);
        back.setAttribute('fill','url(#simple_gradient)');
        back.setAttribute('stroke', opts['border'] || '#000000');
        back.setAttribute('stroke-width', (r/10)*RS);

        marker_group.push(back);
        var text = this.text(0,dim.CY-0.5*dim.R,txt);
        text.setAttribute('font-size',r*RS);
        text.setAttribute('font-weight','bolder');
        text.setAttribute('fill','#ffffff');
        text.setAttribute('style','font-family: sans-serif; text-anchor: middle; dominant-baseline: hanging;');
        text.setAttribute('dominant-baseline','hanging');
        text.setAttribute('text-anchor','middle');
        marker_group.push(text);
        
        marker_group.setAttribute('transform','translate('+dim.CX*RS+', 1) scale(1)');
        marker_group.setAttribute('height', (dim.R/2)*RS );
        return marker_group;
    };

    canvas.crossed_circle = function(cx,cy,r) {
        var cx,cy,r;

        var units = 0;


        if (typeof cx == 'string') {
            var parts = new RegExp(/(\d+)(.*)/g).exec(cx);
            units = parts[2];
            cx = parseFloat(parts[1]);
            
            parts = new RegExp(/(\d+)(.*)/g).exec(cy);
            cy = parseFloat(parts[1]);
            
            parts = new RegExp(/(\d+)(.*)/g).exec(r);
            r = parseFloat(parts[1]);        

        }
        var dim = {
            CX      : cx+units,
            CY      : cy+units,
            R       : r+units,
            MIN_X   : (cx-r)+units,
            MAX_X   : (cx+r)+units,
            MIN_Y   : (cy-r)+units,
            MAX_Y   : (cy+r)+units,
            MID_X1  : (cx-(r/2))+units,
            MID_X2  : (cx+(r/2))+units,
            MID_Y1  : (cy-(r/2))+units,
            MID_Y2  : (cy+(r/2))+units
        };

        var close_group = this.group();

        var close_button = this.circle(dim.CX,dim.CY,dim.R);
        close_button.setAttribute('fill','#000000');
        close_button.setAttribute('stroke', '#ffffff');
        close_button.setAttribute('stroke-width', '2');

        close_group._button = close_button;

        close_group.push(close_button);

        var a_line = this.line(dim.MID_X1,dim.MID_Y1,dim.MID_X2,dim.MID_Y2);
        a_line.setAttribute('stroke', '#ffffff');
        a_line.setAttribute('stroke-width', '2');

        close_group.push(a_line);

        a_line = this.line(dim.MID_X1,dim.MID_Y2,dim.MID_X2,dim.MID_Y1);
        a_line.setAttribute('stroke', '#ffffff');
        a_line.setAttribute('stroke-width', '2');

        close_group.push(a_line);

        return close_group;        
    };


    // var annotation = makeEl('svg',{
    //     'width' : '100%',
    //     'height': '100%',
    //     'id'    : 'annotation_icon',
    //     'viewBox': '0 0 100 100',
    //     'preserveAspectRatio' : 'xMinYMin meet'
    // });
    // 
    // defs.appendChild(annotation);
    // 
    // annotation.appendChild(makeEl('path', {
    //     'd' : 'M50,0 l25,80 l-50,0 Z',
    //     'fill' : '#dd0000',
    // }));
    // 
    // 
    // annotation.appendChild(makeEl('circle', {
    //     'cx'  : '50',
    //     'cy'  : '75',
    //     'r'  : '25',
    //     'fill' : '#dd0000',
    // }));


    canvas.set = function() {
        var an_array = new Array();
        an_array.attr = function(hsh,animated) {
            
            var hash = jQuery.extend({},hsh);
            
            if (animated && typeof hash['y'] != 'undefined') {
                var rate = 75;

                if ( ! canvas._anim_clock_funcs ) {
                    canvas._anim_clock_funcs = [];
                    canvas._in_anim = true;
                    jQuery(canvas).trigger('_anim_begin');
                    renderer._frame_count = 0;
                    var start = null;
                    canvas._anim_clock = setInterval(function() {
                        if ( ! canvas._anim_clock_funcs || canvas._anim_clock_funcs.length == 0 ) {
                            clearInterval(canvas._anim_clock);
                            canvas._anim_clock = null;
                            canvas._anim_clock_funcs = null;
                            canvas._in_anim = false;
                            jQuery(canvas).trigger('_anim_end');
                            return;
                        }
                        var susp_id = canvas.suspendRedraw(1000);
                        var nav_canv_id = renderer._nav_canvas.suspendRedraw(1000);
                                                
                        if (! start) {
                            start = (new Date()).getTime();
                        }
                        for (var i = 0; i < (canvas._anim_clock_funcs || []).length; i++ ) {
                            var end = (new Date()).getTime();
                            var step_id = parseInt((end - start)/rate);
                            canvas._anim_clock_funcs[i].apply(null,[step_id - (canvas._anim_clock_funcs[i]._last_step || step_id)]);
                            if (canvas._anim_clock_funcs && canvas._anim_clock_funcs[i]) {
                                canvas._anim_clock_funcs[i]._last_step = step_id;
                            }
                        }

                        renderer._nav_canvas.unsuspendRedraw(nav_canv_id);
                        canvas.unsuspendRedraw(susp_id);
                        renderer._frame_count += 1;
                        
                    },rate);
                }
                
                if (an_array.animating) {
                    for (var i = 0; i < (canvas._anim_clock_funcs || []).length; i++ ) {                    
                        if (canvas._anim_clock_funcs[i].target_set != an_array) {
                            continue;
                        }
                        canvas._anim_clock_funcs.splice(i,1);
                    }
                }
                
                
                if (an_array.length == 0) {
                    return;
                }
                var a_y;
                
                if (an_array[0].getAttribute('transform')) {                    
                    a_y = /translate\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/.exec(an_array[0].getAttribute('transform'));
                    if (typeof a_y != 'undefined') {
                        a_y = a_y[2];
                    }
                }
                
                var curr_y = an_array[0] ? parseInt(a_y || an_array[0].getAttribute('y')) : 0;
                var curr_disp = 'hidden';
                for (var i = 0 ; i < an_array.length; i++ ) {
                    var a_disp = an_array[i].getAttribute('visibility');
                    if (a_disp && a_disp != 'hidden') {
                        curr_disp = a_disp;
                        break;
                    }
                }
                
                
                var target_y = parseInt(hash['y']);

                var target_disp = hash['visibility'];
                if (curr_disp == target_disp && target_disp == 'hidden') {
                    an_array.attr(hsh);
                    return;
                }

                delete hash['y'];

                if (curr_disp == target_disp && target_disp == 'visible' ) {
                    delete hash['visibility'];
                    target_disp = null;                    
                    an_array.attr({'visibility' : 'visible'});
                }

                if (hash['visibility'] == 'hidden') {
                    delete hash['visibility'];
                }

                an_array.attr(hash);
                var counter = 0;

                if (target_y != curr_y) {
                    var anim_steps = 1 * (Math.abs(parseInt(((target_y - curr_y) / 500))/rate) + 1);
                    var diff = (target_y - curr_y) / anim_steps;
                    hash['y'] = curr_y || 0;
                    var orig_func = arguments.callee;
                    an_array.animating = true;
                    jQuery(an_array).trigger('_t_anim_begin');
                    canvas._anim_clock_funcs.push(                    
                        function(step) {
                            if (diff < 0 && (hash['y'] < target_y) ) {
                                hash['y'] = target_y;
                            }
                            if (diff > 0 && (hash['y'] > target_y) ) {
                                hash['y'] = target_y;
                            }
                            orig_func.apply(an_array,[hash]);
                            counter += (step || 1);
                            if (hash['y'] != target_y) {
                                hash['y'] = curr_y + diff*(counter);
                                return;
                            }
                            an_array.animating = false;
                            if (target_disp) {
                                an_array.attr({'visibility' : target_disp});
                                jQuery(an_array).trigger('_t_anim_end');
                            }
                            canvas._anim_clock_funcs.splice(canvas._anim_clock_funcs.indexOf(arguments.callee),1);
                            if (canvas._anim_clock_funcs.length == 0) {
                                clearInterval(canvas._anim_clock);
                                canvas._anim_clock = null;
                                canvas._anim_clock_funcs = null;
                                canvas._in_anim = false;
                                jQuery(canvas).trigger('_anim_end');                                
                            }
                        }
                    );
                    canvas._anim_clock_funcs[canvas._anim_clock_funcs.length - 1].target_set = an_array;
                }
                return;
            }
            for (var key in hash) {
                for (var i = 0; i < an_array.length; i++) {
                    if ( ! an_array[i]) {
                        continue;
                    }
                    var value = hash[key];
                    if (key == 'style' && an_array[i].hasAttribute('style')) {
                        var curr_style = an_array[i].getAttribute('style');
                        curr_style += '; '+hash[key];
                        value = curr_style;
                    }
                    if (key == 'height' && an_array[i].hasAttribute('transform')) {
                        var curr_transform = an_array[i].getAttribute('transform');

                        var curr_scale = /scale\((-?\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                        
                        var curr_height = parseFloat(an_array[i].getAttribute('height') || 1);
                        
                        var new_scale = 1;
                        if (curr_scale == null) {
                            curr_transform += ' scale(1) ';
                            curr_scale = 1;
                        } else {
                            curr_scale = parseFloat(curr_scale[1]);
                        }
                        
                        
                        new_scale = ( parseFloat(hash[key]) / curr_height ) * curr_scale;
                        
                        curr_transform = curr_transform.replace(/scale\((-?\d+\.?\d*)\)/,'scale('+new_scale+')');

                        an_array[i].setAttribute('transform',curr_transform);
                    }
                    if  (! (an_array[i].hasAttribute('transform') && (key == 'y' || key == 'x'))) {
                        an_array[i].setAttribute(key, value);                        
                    }
                    if (key == 'y' && an_array[i].hasAttribute('d')) {
                        var curr_path = an_array[i].getAttribute('d');
                        var re = /M([\d\.]+) ([\d\.]+)/;
                        curr_path = curr_path.replace(re,'');
                        an_array[i].setAttribute('d', 'M0 '+parseInt(value)+' '+curr_path);
                    }
                    if (key == 'y' && an_array[i].hasAttribute('cy')) {
                        an_array[i].setAttribute('cy', hash[key]);
                    }
                    
                    
                    if (key == 'y' && an_array[i].hasAttribute('transform')) {
                        var curr_transform = an_array[i].getAttribute('transform');
                        
                        var curr_x = /translate\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                        if (curr_x == null) {
                            continue;
                        }
                        curr_x = curr_x[1];
                        curr_transform = curr_transform.replace(/translate\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/,'translate('+curr_x+','+value+')');
                        an_array[i].setAttribute('transform',curr_transform);                        
                    }
                    if (key == 'x' && an_array[i].hasAttribute('transform')) {
                        var curr_transform = an_array[i].getAttribute('transform');
                        
                        var curr_y = /translate\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                        if (curr_y == null) {
                            continue;
                        }
                        curr_y = curr_y[2];
                        curr_transform = curr_transform.replace(/translate\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/,'translate('+value+','+curr_y+')');
                        an_array[i].setAttribute('transform',curr_transform);                        
                    }                    
                }
            }
        };
        an_array.hide = function() {
            this.attr({ 'visibility' : 'hidden'});
        };
        an_array.show = function() {
            this.attr({ 'visibility' : 'visible'});
        };

        an_array.refresh_zoom = function() {
            for (var i = 0; i < an_array.length; i++ ) {
                if (an_array[i].zoom_level && an_array[i].zoom_level == 'text') {
                    if (canvas.zoom > 3.5) {
                        an_array[i].setAttribute('display', 'inline');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }                        
                }
            
                if (an_array[i].zoom_level && an_array[i].zoom_level == 'summary') {
                    if (canvas.zoom <= 3.5) {
                        an_array[i].setAttribute('display', 'inline');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }
                }
            }
        };
        
        an_array._old_push = an_array.push;
        an_array._event_proxy = new Object();

        var event_func = function(ev) {
            var target_el = this;
            if (canvas._in_anim) {
                return;
            }
            jQuery(an_array._event_proxy).trigger(ev.type,[ev,target_el]);
        };
        
        an_array.push = function(new_el) {
            this._old_push(new_el);

            if ( ! new_el || typeof new_el == 'undefined' ) {
                return;
            }
            if (new_el._has_proxy) {
                return;
            }
            if ( ! MASCP.IE ) {
                var event_names = ['click','mouseover','mousedown','mousemove','mouseout','mouseup','mouseenter','mouseleave'];
                for (var i = 0 ; i < event_names.length; i++) {
                    jQuery(new_el).bind(event_names[i], event_func);
                }
                if (new_el.addEventListener) {
                    new_el.addEventListener('touchstart',event_func,false);
                    new_el.addEventListener('touchmove',event_func,false);
                    new_el.addEventListener('touchend',event_func,false);
                }
            }
            new_el._has_proxy = true;
        };
        return an_array;
    };
    
    canvas.text = function(x,y,text) {
        var a_text = document.createElementNS(svgns,'text');
        if (typeof text != 'string') {
            a_text.appendChild(text);
        } else {
            a_text.textContent = text;
        }
        a_text.style.fontFamily = 'Helvetica, Verdana, Arial, Sans-serif';
        a_text.setAttribute('x',typeof x == 'string' ? x : x * RS);
        a_text.setAttribute('y',typeof y == 'string' ? y : y * RS);        
        this.appendChild(a_text);
        return a_text;
    };    
};

MASCP.CondensedSequenceRenderer.Navigation.prototype._extendWithSVGApi = MASCP.CondensedSequenceRenderer.prototype._extendWithSVGApi;

MASCP.CondensedSequenceRenderer.prototype._drawAminoAcids = function(canvas) {
    var RS = this._RS;
    var seq_chars = this.sequence.split('');
    var renderer = this;
    var aa_selection = document.createElement('div');
    // We need to prepend an extra > to the sequence since there is a bug with Safari failing
    // to select reliably when you set the start offset for the range to 0
    aa_selection.appendChild(document.createTextNode(">"+this.sequence));
    renderer._container.appendChild(aa_selection);
    aa_selection.style.top = '110%';
    aa_selection.style.height = '1px';
    aa_selection.style.overflow = 'hidden';
    
    var amino_acids = canvas.set();
    var amino_acids_shown = false;
    var x = 0;
    
    var has_textLength = true;
    
    try {
        var test_el = document.createElementNS(svgns,'text');
        test_el.setAttribute('textLength',10);
        test_el.textLength;
    } catch (e) {
        has_textLength = false;
    }
    
    renderer.select = function() {
        var vals = Array.prototype.slice.call(arguments);
        var from = vals[0];
        var to = vals[1];
        var sel = window.getSelection();
        if(sel.rangeCount > 0) sel.removeAllRanges();
        var range = document.createRange();
        range.selectNodeContents(aa_selection.childNodes[0]);
        sel.addRange(range);
        sel.removeAllRanges();
        range.setStart(aa_selection.childNodes[0],from+1);
        range.setEnd(aa_selection.childNodes[0],to+1);
        sel.addRange(range);
        this.moveHighlight.apply(this,vals);
    };

    if (has_textLength && ('lengthAdjust' in document.createElementNS(svgns,'text')) && ('textLength' in document.createElementNS(svgns,'text'))) {
        var a_text = canvas.text(0,12,document.createTextNode(this.sequence));
        a_text.style.fontFamily = "'Lucida Console', Monaco, monospace";
        a_text.setAttribute('lengthAdjust','spacing');
        a_text.setAttribute('textLength',RS*this.sequence.length);
        a_text.setAttribute('text-anchor', 'start');
        a_text.setAttribute('dx',5);
        a_text.setAttribute('font-size', RS);
        a_text.setAttribute('fill', '#000000');
        amino_acids.push(a_text);
    } else {    
        for (var i = 0; i < seq_chars.length; i++) {
            var a_text = canvas.text(x,12,seq_chars[i]);
            amino_acids.push(a_text);
            a_text.style.fontFamily = "'Lucida Console', Monaco, monospace";
            x += 1;
        }
        amino_acids.attr( { 'y':-1000,'width': RS,'text-anchor':'start','dominant-baseline':'hanging','height': RS,'font-size':RS,'fill':'#000000'});
    }
    canvas.addEventListener('panstart', function() {
        amino_acids.attr( { 'y' : '-1000'});
        jQuery(canvas).bind('panend', function() {
            if (amino_acids_shown) {
                amino_acids.attr( { 'y' : 12*RS});                
            }
            jQuery(canvas).unbind('panend',arguments.callee);
        });
    });
    
    canvas.addEventListener('zoomChange', function() {
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
           amino_acids.attr({'y': 12*RS});
           amino_acids_shown = true;
       } else {
           renderer._axis_height = 30;
           amino_acids.attr({'y':-1000});   
           amino_acids_shown = false;        
       }
       renderer.refresh();
   });
   
};

MASCP.CondensedSequenceRenderer.prototype._drawAxis = function(canvas,lineLength) {
    var RS = this._RS;
    var x = 0;
    
    
    var axis = canvas.set();
    axis.push(canvas.path('M0 '+15*RS+' l0 '+10*RS));

    axis.push(canvas.path('M'+(lineLength*RS)+' '+14*RS+' l0 '+10*RS));

    this._axis_height = 20;

    axis.attr({'pointer-events' : 'none'});

    var big_ticks = canvas.set();
    var little_ticks = canvas.set();
    var big_labels = canvas.set();
    var little_labels = canvas.set();
    
    
    for (var i = 0; i < (lineLength/5); i++ ) {

        if ( (x % 10) == 0) {
            big_ticks.push(canvas.path('M'+x*RS+' '+14*RS+' l 0 '+7*RS));
        } else {
            little_ticks.push(canvas.path('M'+x*RS+' '+16*RS+' l 0 '+4*RS));
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
        big_labels[i].setAttribute('text-anchor','middle');
        big_labels[i].setAttribute('dominant-baseline','hanging');
        big_labels[i].setAttribute('font-size',7*RS+'pt');
    }

    for ( var i = 0; i < little_labels.length; i++ ) {
        little_labels[i].style.textAnchor = 'middle';
        little_labels[i].setAttribute('text-anchor','middle');
        little_labels[i].setAttribute('dominant-baseline','hanging');
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
    });
};

MASCP.CondensedSequenceRenderer.prototype.setSequence = function(sequence) {
    var new_sequence = this._cleanSequence(sequence);
    if (new_sequence == this.sequence && new_sequence != null) {
        jQuery(this).trigger('sequenceChange');
        return;
    }
    
    if (! new_sequence) {
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

    var RS = this._RS;

    jQuery(this).unbind('svgready').bind('svgready',function(canv) {
        var canv = renderer._canvas;
        renderer._extendWithSVGApi(canv);
        canv.setAttribute('background', '#000000');
        canv.setAttribute('preserveAspectRatio','xMinYMin meet');
        
        var defs = document.createElementNS(svgns,'defs');
        renderer._container_canvas.appendChild(defs);

        var makeEl = function(name,attributes) {
            var result = document.createElementNS(svgns,name);
            for (var attribute in attributes) {
                result.setAttribute(attribute, attributes[attribute]);
            }
            return result;
        };

        var gradient = makeEl('linearGradient',{
            'id':'track_shine',
            'x1':'0%',
            'x2':'0%',
            'y1':'0%',
            'y2':'100%'
        });

        defs.appendChild(gradient);

        gradient.appendChild(makeEl('stop',{
            'offset':'0%',
            'style':'stop-color:#111111;stop-opacity:0.5',
        }));
        gradient.appendChild(makeEl('stop',{
            'offset':'50%',
            'style':'stop-color:#aaaaaa;stop-opacity:0.5',
        }));
        gradient.appendChild(makeEl('stop',{
            'offset':'100%',
            'style':'stop-color:#111111;stop-opacity:0.5',
        }));
        
        gradient = makeEl('linearGradient',{
            'id':'simple_gradient',
            'x1':'0%',
            'x2':'0%',
            'y1':'0%',
            'y2':'100%'
        });

        defs.appendChild(gradient);

        gradient.appendChild(makeEl('stop',{
            'offset':'0%',
            'style':'stop-color:#aaaaaa;stop-opacity:1',
        }));
        gradient.appendChild(makeEl('stop',{
            'offset':'100%',
            'style':'stop-color:#888888;stop-opacity:1',
        }));

        gradient = makeEl('linearGradient',{
            'id':'left_fade',
            'x1':'0%',
            'x2':'100%',
            'y1':'0%',
            'y2':'0%'
        });

        defs.appendChild(gradient);

        gradient.appendChild(makeEl('stop',{
            'offset':'0%',
            'style':'stop-color:#ffffff;stop-opacity:1',
        }));
        gradient.appendChild(makeEl('stop',{
            'offset':'100%',
            'style':'stop-color:#ffffff;stop-opacity:0',
        }));        


        gradient = makeEl('linearGradient',{
            'id':'right_fade',
            'x1':'0%',
            'x2':'100%',
            'y1':'0%',
            'y2':'0%'
        });

        defs.appendChild(gradient);

        gradient.appendChild(makeEl('stop',{
            'offset':'0%',
            'style':'stop-color:#ffffff;stop-opacity:0',
        }));
        gradient.appendChild(makeEl('stop',{
            'offset':'100%',
            'style':'stop-color:#ffffff;stop-opacity:1',
        }));        
        
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

        var shadow = makeEl('filter',{
            'id':'drop_shadow',
            'filterUnits':'objectBoundingBox',
            'x': '0',
            'y': '0',
            'width':'150%',
            'height':'130%',
        });
        // 'x': '-100%',
        // 'y': '-100%',
        // 'width': '300%',
        // 'height': '300%'
//        shadow.appendChild(makeEl('feFlood',{'result':'flooded','style':'flood-color:rgb(255,0,0);'}));        

        shadow.appendChild(makeEl('feGaussianBlur',{'in':'SourceGraphic', 'stdDeviation':'4', 'result' : 'blur_out'}));
        shadow.appendChild(makeEl('feOffset',{'in':'blur_out', 'result':'the_shadow', 'dx':'3','dy':'1'}));
        shadow.appendChild(makeEl('feBlend',{'in':'SourceGraphic', 'in2':'the_shadow', 'mode':'normal'}));
        
        defs.appendChild(shadow);

        var link_icon = makeEl('svg',{
            'width' : '100%',
            'height': '100%',
            'id'    : 'new_link_icon',
            'viewBox': '0 0 100 100',
            'preserveAspectRatio' : 'xMinYMin meet'
        });

        defs.appendChild(link_icon);

        link_icon.appendChild(makeEl('rect', {
            'x' : '5',
            'y' : '10',
            'stroke-width' : '1',
            'width' : '70',
            'height': '60',
            'stroke': '#ffffff',
            'fill'  : 'none'            
        }));
        link_icon.appendChild(makeEl('rect', {
            'x' : '5',
            'y' : '10',
            'stroke-width' : '0',
            'width' : '70',
            'height': '10',
            'stroke': '#ffffff',
            'fill'  : '#ffffff'            
        }));


        link_icon.appendChild(makeEl('rect', {
            'x' : '30',
            'y' : '0',
            'stroke-width' : '1',
            'width' : '70',
            'height': '60',
            'stroke': '#ffffff',
            'fill'  : '#bbbbbb',
            'fill-opacity': '1'            
        }));
        
        link_icon.appendChild(makeEl('rect', {
            'x' : '30',
            'y' : '0',
            'stroke-width' : '1',
            'width' : '70',
            'height': '10',
            'stroke': '#ffffff',
            'fill'  : '#222222'            
        }));


        var plus_icon = makeEl('svg',{
            'width' : '100%',
            'height': '100%',
            'id'    : 'plus_icon',
            'viewBox': '0 0 100 100',
            'preserveAspectRatio' : 'xMinYMin meet'
        });

        defs.appendChild(plus_icon);

        plus_icon.appendChild(makeEl('rect', {
            'x' : '40',
            'y' : '10',
            'stroke-width' : '1',
            'width' : '20',
            'height': '80',
            'stroke': '#ffffff',
            'fill'  : '#ffffff'            
        }));

        plus_icon.appendChild(makeEl('rect', {
            'x' : '10',
            'y' : '40',
            'stroke-width' : '1',
            'width' : '80',
            'height': '20',
            'stroke': '#ffffff',
            'fill'  : '#ffffff'            
        }));

        var minus_icon = makeEl('svg',{
            'width' : '100%',
            'height': '100%',
            'id'    : 'minus_icon',
            'viewBox': '0 0 100 100',
            'preserveAspectRatio' : 'xMinYMin meet'
        });

        defs.appendChild(minus_icon);

        minus_icon.appendChild(makeEl('rect', {
            'x' : '10',
            'y' : '40',
            'stroke-width' : '1',
            'width' : '80',
            'height': '20',
            'stroke': '#ffffff',
            'fill'  : '#ffffff'            
        }));
        renderer._highlight = [];
        renderer._createNewHighlight = function() {
            var highlight = canv.rect(0,0,0,'100%');
            highlight.setAttribute('fill','#eeeeee');
            this._highlight.push(highlight);
        };
        renderer._createNewHighlight();
        
        renderer._drawAxis(canv,line_length);
        renderer._drawAminoAcids(canv);
        
        jQuery(renderer).trigger('sequenceChange');
    });
    
    var canvas = this._createCanvasObject();
    
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
    
    seq_change_func['ready'] = function(other_func) {
        this.call(this,other_func);
    };
    
    return seq_change_func;
    
};

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
    
    this._layer_containers['hydropathy'].push(plot);    
    this._layer_containers['hydropathy'].push(axis);
    this._layer_containers['hydropathy'].fixed_track_height = (-1*min_value+max_value) / RS;
    return values;
};

(function() {
var addElementToLayer = function(layerName) {
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

    // var circ = canvas.text_circle(this._index+0.5,0.5,2,layerName.charAt(0).toUpperCase());
    // this._renderer._layer_containers[layerName].push(circ);
    // circ.zoom_level = 'summary';
    // circ.style.strokeWidth = '0px';
    // circ.setAttribute('fill',MASCP.layers[layerName].color);
    // circ.setAttribute('visibility', 'hidden');
    // circ.setAttribute('class',layerName);
    // circ.setAttribute('pointer-events','none');

    var bobble = canvas.circle(this._index+0.3,10,0.25);
    bobble.setAttribute('visibility','hidden');
    bobble.style.opacity = '0.4';
    var tracer = canvas.rect(this._index+0.3,10,0.1,0);
    tracer.style.strokeWidth = '0px';
    tracer.style.fill = MASCP.layers[layerName].color;
    tracer.setAttribute('visibility','hidden');
    
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
    var tracer_marker = canvas.marker(this._index+0.3,10,0.5,layerName.charAt(0).toUpperCase());
    
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
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.style.strokeWidth = '0px';
    rect.setAttribute('visibility', 'hidden');
    rect.style.opacity = fraction;
    rect.setAttribute('fill',MASCP.layers[layerName].color);
    rect.position_start = this._index;
    rect.position_end = this._index + width;
//    rect.setAttribute('pointer-events','none');
    
/*
    var shine = canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');
    shine._is_shine = true;
*/
    return rect;
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

    // BIG POTENTIAL PERFORMANCE HIT HERE?
//    rect.setAttribute('pointer-events','none');
    
/*
    var shine = canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(shine);    
    shine.style.strokeWidth = '0px';
    shine.style.fill = 'url(#track_shine)';
    shine.setAttribute('display','none');
    shine._is_shine = true;
*/
    return rect;
};

var all_annotations = {};
var default_annotation_height = 15;

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
        if ( typeof opts['angle'] == 'undefined' ) {
            opts['angle'] = 0;
        }
    }
    
    if ( ! all_annotations[layerName]) {
        all_annotations[layerName] = {};
    }
    
    var blob_id = this._index+'_'+opts['angle'];

    var blob_exists = (typeof all_annotations[layerName][blob_id]) !== 'undefined';

    var height = default_annotation_height;
    var offset = this._renderer._RS * height / 2;

    var blob = all_annotations[layerName][blob_id] ? all_annotations[layerName][blob_id] : canvas.growingMarker(0,offset,opts['content'],opts);
    blob.setAttribute('transform','translate('+((this._index + 0.25 - 0.1) * this._renderer._RS) +',0.01) scale(1,1) translate(0) rotate('+opts['angle']+',0.01,'+offset+')');
    all_annotations[layerName][blob_id] = blob;
    if ( ! blob_exists ) {
        blob._value = 0;
        this._renderer._layer_containers[layerName].push(blob);
        this._renderer._layer_containers[layerName].fixed_track_height = height;
    }
    
    blob._value += width;
    if ( ! blob_exists ) {
        var tracer = canvas.rect(this._index+0.25,10+height,0.05,0);
        tracer.style.strokeWidth = '0px';
        tracer.style.fill = '#777777'; //MASCP.layers[layerName].color;
        tracer.setAttribute('visibility','hidden');
    
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
    }
    
    if ( ! this._renderer._pause_rescale_of_annotations ) {    
        this._renderer.redrawAnnotations(layerName,height);
    }
    
};

MASCP.CondensedSequenceRenderer.prototype._extendElement = function(el) {
    el.addToLayer = addElementToLayer;
    el.addBoxOverlay = addBoxOverlayToElement;
    el.addToLayerWithLink = addElementToLayerWithLink;
    el.addAnnotation = addAnnotationToLayer;
};

MASCP.CondensedSequenceRenderer.prototype.resetAnnotations = function() {
    all_annotations = {};
};

MASCP.CondensedSequenceRenderer.prototype.removeAnnotations = function(layerName) {
    var canvas = this._canvas;
    if ( ! canvas || typeof layerName == 'undefined') {
        return;
    }

    for (var blob_id in all_annotations[layerName]) {
        var blob = all_annotations[layerName][blob_id];
        var container = this._layer_containers[layerName];
        delete container[blob_id];
        if (canvas.tracers && container.tracers) {
            for (var i = 0; i < container.tracers.length; i++ ) {
                var tracer = container.tracers[i];
                tracer.parentNode.removeChild(tracer);
                delete canvas.tracers[canvas.tracers.indexOf(tracer)];
            }
            container.tracers = canvas.set();
        }
        
        blob.parentNode.removeChild(blob);
        
    }
    all_annotations[layerName] = {};    
};

MASCP.CondensedSequenceRenderer.prototype.redrawAnnotations = function(layerName) {
    var canvas = this._canvas;
    var susp_id = canvas.suspendRedraw(10000);
    
    var max_value = 0;
    var height = default_annotation_height;
    var offset = this._RS * height / 2;
    for (var blob_idx in all_annotations[layerName]) {
        if ( all_annotations[layerName][blob_idx]._value > max_value ) {
            max_value = all_annotations[layerName][blob_idx]._value;
        }
        var a_parent = all_annotations[layerName][blob_idx].parentNode;
        if ( ! a_parent ) {
            continue;
        }
        a_parent.removeChild(all_annotations[layerName][blob_idx]);
        all_annotations[layerName][blob_idx]._parent = a_parent;
    }
    for (var blob_idx in all_annotations[layerName]) {
        var a_blob = all_annotations[layerName][blob_idx];
        var size_val = (0.3 + (0.6 * a_blob._value) / max_value)*(this._RS * height * 0.5);
        var curr_transform = a_blob.getAttribute('transform');
        var transform_shift = ((-315.0/1000.0)*size_val);
        var rotate_shift = (1.0/3.0)*size_val;
        curr_transform = curr_transform.replace(/translate\(\s*(-?\d+\.?\d*)\s*\)/,'translate('+transform_shift+')');
        curr_transform = curr_transform.replace(/,\s*(-?\d+\.?\d*)\s*,\s*\d+\.?\d*\s*\)/,','+rotate_shift+','+offset+')');
        a_blob.setAttribute('transform', curr_transform);
        a_blob.firstChild.setAttribute('width',size_val);
        a_blob.firstChild.setAttribute('height',size_val);
    }
    
    for (var blob_idx in all_annotations[layerName]) {
        var a_parent = all_annotations[layerName][blob_idx]._parent;
        a_parent.appendChild(all_annotations[layerName][blob_idx]);        
    }
    canvas.unsuspendRedraw(susp_id);
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
        this.bind('sequencechange',function() {
            this.addTrack(layer);
            this.unbind('sequencechange',arguments.callee);
        });
        console.log("No canvas, cannot add track, waiting for sequencechange event");
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
            
            if ( containers[layer.name].length <= 0 ) {
                return;
            }
            
            if (! visibility) {
                if (containers[layer.name].tracers) {
                    containers[layer.name].tracers.hide();
                }
                containers[layer.name].attr({ 'y': -1000 });
            }
            renderer.refresh();
        });
        var event_names = ['click','mouseover','mousedown','mousemove','mouseout','mouseup','mouseenter','mouseleave'];
        for (var i = 0 ; i < event_names.length; i++) {
            jQuery(this._layer_containers[layer.name]._event_proxy).bind(event_names[i],function(ev,original_event,element) {
                jQuery(layer).trigger(ev.type,[original_event,element.position_start,element.position_end]);
            });
        }
    }
    
/* BE VERY CAREFUL HERE.. I DISABLED THIS REFRESH TO SPEED UP RENDERING OF LOTS OF TRACKS.. I'M NOT SURE
   THIS IS THE CORRECT BEHAVIOUR
 */    
    
//    this.refresh();
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


MASCP.CondensedSequenceRenderer.prototype.moveHighlight = function() {
    var vals = Array.prototype.slice.call(arguments);
    var RS = this._RS;
    var idx = 0;
    for (var i = 0; i < vals.length; i+= 2) {
        var from = vals[i];
        var to = vals[i+1];
        var highlight = this._highlight[idx];
        if ( ! highlight ) {
            this._createNewHighlight();
            highlight = this._highlight[idx];
        }
        
        highlight.setAttribute('x',(from) * RS );
        highlight.setAttribute('width',(to - from) * RS );
        highlight.setAttribute('visibiilty','visible');
        idx += 1;
    }
    for (var i = idx; i < this._highlight.length; i++){
        this._highlight[i].setAttribute('visibility','hidden');
    }

    
};

/**
 * Deprecate the setHighlight method for the sequence renderer. There has to be a better way
 * to do this.
 * @private
 */
MASCP.CondensedSequenceRenderer.prototype._setHighlight = function(layer,doHighlight) {
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
        jQuery(layer_container).bind('_t_anim_begin',function() {
            if (layerObj._highlight_filter) {
                return;
            }
            layerObj._highlight_filter = [];
            for (var i = 0; i < layer_container.length; i++ ) {
                layerObj._highlight_filter[i] = layer_container[i].getAttribute('filter')+"";
                layer_container[i].removeAttribute('filter');
            }
        });

        jQuery(layer_container).bind('_t_anim_end',function() {
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
        layerObj._highlight_event_bound = true;
    }
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
            layer_container[i].removeAttribute('filter');
        }
    }
    
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
        
        var width = (this._zoomLevel || 1)*2*this.sequence.length;
        var height = (this._zoomLevel || 1)*2*(this._canvas._canvas_height/this._RS);
        this._canvas.setAttribute('width', width);
        this._canvas.setAttribute('height',height);
        this._nav_canvas.setAttribute('width',width);
        this._nav_canvas.setAttribute('height',height);        
        // We need to explicitly set the value for the height of the back rectangle, since Firefox doesn't scale
        // properly, and the drop shadow gets cut off
        this._Navigation._nav_pane_back.setAttribute('height',this._nav_canvas.height.baseVal.value - 30);
        
        if (this.grow_container) {
            this._container_canvas.setAttribute('height',height);
            this._container.style.height = height+'px';        
            // We need to explicitly set the value for the height of the back rectangle, since Firefox doesn't scale
            // properly, and the drop shadow gets cut off
            this._Navigation._nav_pane_back.setAttribute('height',this._container_canvas.height.baseVal.value - 30);
        } else {
            // var height,width,curr_style;
            // if (curr_style = document.defaultView.getComputedStyle(this._container, null)) {
            //     height = curr_style['height'];
            //     width = curr_style['width'];
            // } else if (this._container.style) {
            //     height = this._container.style.height;
            //     width = this._container.style.width;
            // } else {
            //     height = this._container.clientHeight;
            //     width = this._container.clientWidth;                
            // }
            this._container_canvas.setAttribute('height','100%');
            this._container_canvas.setAttribute('width','100%');
            this._Navigation.setZoom(this.zoom);
        }
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
    
    if ( ! layer || ! group) {
        return;
    }
    

    if (layer && layer._group_controller) {
        layer._setunexpanded();
        return;
    }
    
    layer._group_controller = true;
    layer._group_under_control = group;
    
    var sticky = false;
    var expanded = false;
    
    var self = this;
    
    layer._setunexpanded = function() {
        expanded = false;
    }
    
    layer._isExpanded = function() {
        return expanded;
    }
    
    jQuery(layer).bind('visibilityChange',function(ev,rend,visible) {
        if (rend == self && group.length > 0) {            
            self.setGroupVisibility(group, expanded && visible);
            self.refresh();
        }
    });
    jQuery(layer).bind('_expandevent',function(ev) {
        expanded = ! expanded;
        self.withoutRefresh(function() {
            self.setGroupVisibility(group,expanded);            
        });
        self.refresh(true);
    });
};

MASCP.CondensedSequenceRenderer.prototype.getElementDefinedStyle = function(el,pr) {
    return (function gs(){
        function R(c){return [].slice.call(c);}
        var sheets=R(document.styleSheets),
            sels={},
            r=[];
        sheets.map(function(a){
            r.splice.apply(r, [r.length, 0].concat(R(a.cssRules)));
        });
        r.reverse();
      return function getElementDefinedStyle(elm, prop){
        var rx=new RegExp( "(#"+elm.id+"(,|$))|(\\."+elm.className+"(,|$))" ,"i"), out="";
        r.some(function(a){
           if(a.selectorText && a.selectorText.match(rx) && document.querySelectorAll(a.selectorText)[0]==elm){
               return out=a.style[prop];
           }
        });
        return out;
      };
    }())(el,pr);//end builder wrap    
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
    var order = this._track_order || [];
    
    if (this._Navigation)
        this._Navigation.clearTracks();

    for (var i = 0; i < order.length; i++ ) {
        
        var name = order[i];
        var container = this._layer_containers[name];
        if (! this.isLayerActive(name)) {
            var attrs = { 'y' : (this._axis_height  + (track_heights - container.track_height )/ this.zoom)*RS, 'height' :  RS * container.track_height / this.zoom ,'visibility' : 'hidden' };
            if (container.fixed_track_height) {
                delete attrs['height'];
            }
            container.attr(attrs,animated);
            continue;
        } else {
            container.attr({ 'opacity' : '1' });
        }

        if (container.tracers) {
            var disp_style = (this.isLayerActive(name) && (this.zoom > 3.6)) ? 'visible' : 'hidden';
            var height = (1.5 + track_heights / this.zoom )*RS;
            
            if (container.fixed_track_height) {
                height += 0.5*container.fixed_track_height * RS;
            }
            container.tracers.attr({'visibility' : disp_style , 'y' : (this._axis_height - 1.5)*RS,'height' : height },animated);
        }
        if (container.fixed_track_height) {
            var track_height = container.fixed_track_height;
            var y_val = this._axis_height + (track_heights / this.zoom);
            container.attr({ 'visibility' : 'visible','y' : (y_val)*RS },animated);
            if (this._Navigation) {
                var grow_scale = this.grow_container ? 1 / this.zoom : 1;
                this._Navigation.renderTrack(MASCP.getLayer(name), (y_val+track_height/3)*RS , RS * track_height/3, { 'font-scale' : (container.track_height / track_height) * 3 * grow_scale } );
            }
            track_heights += (this.zoom * track_height) + this.trackGap;
        } else {
            container.attr({ 'visibility': 'visible', 'y' : (this._axis_height + track_heights / this.zoom )*RS, 'height' :  RS * container.track_height / this.zoom },animated);
            if (this._Navigation) {
                this._Navigation.renderTrack(MASCP.getLayer(name), (this._axis_height + track_heights / this.zoom )*RS , RS * container.track_height / this.zoom );
            }
            track_heights += container.track_height + this.trackGap;
        }

        container.refresh_zoom();

    }

    if (this._Navigation.edit_enabled) {
        this._Navigation._beginRotation();
    } else {
        this._Navigation._endRotation();        
    }

    var viewBox = [-1,0,0,0];
    viewBox[0] = -2*RS;
    viewBox[2] = (this.sequence.split('').length+(this.padding)+2)*RS;
    viewBox[3] = (this._axis_height + (track_heights / this.zoom)+ (this.padding))*RS;
    this._canvas.setAttribute('viewBox', viewBox.join(' '));
    this._canvas._canvas_height = viewBox[3];


    var outer_viewbox = [].concat(viewBox);

    outer_viewbox[0] = 0;
    outer_viewbox[2] = (this._zoomLevel || 1)*(2*this.sequence.length)+(this.padding);
    outer_viewbox[3] = (this._zoomLevel || 1)*2*(this._axis_height + (track_heights / this.zoom)+ (this.padding));
    if (! this.grow_container ) {//&& (this.getElementDefinedStyle(this._container,'width') != '100%')) {
        this._container_canvas.setAttribute('viewBox', outer_viewbox.join(' '));
    }
    


    this._resizeContainer();

    viewBox[0] = 0;
    if (this._Navigation) {

        this._Navigation._width_shift = 100 * RS / this.zoom;

        if (this._Navigation._is_open) {
            this._canvas.style.GomapScrollLeftMargin = this._Navigation._width_shift;
        } else {
            this._canvas.style.GomapScrollLeftMargin = 1000;            
        }
        this._Navigation.setViewBox(viewBox.join(' '));
        this._Navigation.setDimensions('100%','100%');//this._canvas.width.baseVal.value,'100%');
    }
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
var timeout = null;
var start_zoom = null;
var center_residue = null;
var start_x = null;
var accessors = { 
    setZoom: function(zoomLevel) {

        if (zoomLevel < 0.5) {
            zoomLevel = 0.5;
        }
        if (zoomLevel > 10) {
            zoomLevel = 10;
        }

        if (zoomLevel == this._zoomLevel) {
            return;
        }

        var self = this;

        if (! self._canvas) {
            return;
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
            start_zoom = parseFloat(this._zoomLevel || 1);
        }

        self._zoomLevel = parseFloat(zoomLevel);        


        var curr_transform = self._canvas.parentNode.getAttribute('transform') || '';
        curr_transform = curr_transform.replace(/scale\([^\)]+\)/,'');
        var scale_value = Math.abs(parseFloat(zoomLevel)/start_zoom);
        curr_transform = 'scale('+scale_value+') '+(curr_transform || '');
        self._canvas.parentNode.setAttribute('transform',curr_transform);
        jQuery(self._canvas).trigger('_anim_begin');

        if (center_residue) {
            var delta = ((start_zoom - self._zoomLevel)/(scale_value*25))*center_residue;
            delta += start_x/(scale_value);
            self._canvas.setCurrentTranslateXY(delta,0);
        }
        
        timeout = setTimeout(function() {
            timeout = null;
            var scale_value = Math.abs(parseFloat(self._zoomLevel)/start_zoom);

            var curr_transform = self._canvas.parentNode.getAttribute('transform') || '';
            curr_transform = curr_transform.replace(/scale\([^\)]+\)/,'');
            self._canvas.parentNode.setAttribute('transform',curr_transform);

            jQuery(self._canvas).trigger('_anim_end');

            jQuery(self._canvas).one('zoomChange',function() {
                if (typeof center_residue != 'undefined') {
                    var delta = ((start_zoom - self._zoomLevel)/(25))*center_residue;
                    delta += start_x;
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
                self._canvas.zoom = parseFloat(self._zoomLevel);
                if (document.createEvent) {
                    var evObj = document.createEvent('Events');
                    evObj.initEvent('zoomChange',false,true);
                    self._canvas.dispatchEvent(evObj);
                } else {
                    jQuery(self._canvas).trigger('zoomChange');
                }
            }
            jQuery(self).trigger('zoomChange');


        },1000);
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

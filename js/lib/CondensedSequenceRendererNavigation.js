MASCP.CondensedSequenceRenderer.Navigation = function(canvas) {
    SVGCanvas(canvas);

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
            self._toggleMouseEvents(true);
        } else {
            self._toggleMouseEvents(false);
        }
        
        self.hide();
        self.show();
        
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
        visible = ( vis === false || vis === true ) ? vis : ! visible;
        var close_transform;
        
        if (visible) {
            self._track_canvas.setAttribute('display','inline');
            panel_back.setAttribute('visibility','visible');
            canvas.show();

            rect.setAttribute('filter','url(#drop_shadow)');
            close_group._button.removeAttribute('filter');
            close_transform = close_group.getAttribute('transform') || ' ';
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
            close_transform = close_group.getAttribute('transform') || ' ';
            close_transform = close_transform + ' translate(-150,0) rotate(45,179,12) ';
            close_group.setAttribute('transform',close_transform);
            scroll_controls.setAttribute('display','none');
        }
        self._is_open = visible;
        return true;
    };
    
    self._is_open = true;
    self._toggler = toggler;
    self.hide = function() {
        toggler.call(this,false);
    };
    self.show = function() {
        toggler.call(this,true);
    };
    self.visible = function() {
        return this._is_open;
    };
    
    self.setZoom = function(zoom) {
        this._zoom_scale = zoom;
        close_group.setAttribute('transform','scale('+zoom+','+zoom+') ');
        rect.setAttribute('transform','scale('+zoom+',1) ');
    };

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
        element.track = track;

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

        var single_touch_event = function(fn) {
            return function(e) {
                if (e.touches && e.touches.length == 1) {
                    fn.call(this,e);
                }
            };
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

            p_orig.x = ev.pageX || ev.touches[0].pageX;
            p_orig.y = ev.pageY || ev.touches[0].pageY;

            var rootCTM = lbl_grp.nearestViewportElement.getScreenCTM();
            var matrix = rootCTM.inverse();

            p_orig = p_orig.matrixTransform(matrix);

            var oX = p_orig.x;
            var oY = p_orig.y;

            var dragfn = function(e) {
                var p = lbl_grp.nearestViewportElement.createSVGPoint();
                p.x = e.pageX || e.touches[0].pageX;
                p.y = e.pageY || e.touches[0].pageY;
                p = p.matrixTransform(matrix);

                var dX = (p.x - oX);
                var dY = (p.y - oY);
                var curr_transform = lbl_grp.getAttribute('transform') || '';
                curr_transform = curr_transform.replace(/\s?translate\([^\)]+\)/,'');
                curr_transform += ' translate('+dX+','+dY+') ';
                curr_transform = curr_transform.replace(/\s*$/,'');
                lbl_grp.setAttribute('transform',curr_transform);
                self.targets.forEach(function(targ){
                    var bb = targ.getBBox();
                    if (bb.y < p.y && bb.y > (p.y - bb.height) && bb.x < p.x && bb.x > (p.x - bb.width)) {
                        el_move.call(targ,e,targ.track);
                    }
                });
                e.stopPropagation();
                e.preventDefault();
                return false;
            };
            if ("ontouchend" in document) {
                dragfn = single_touch_event(dragfn);
            }

            var enddrag = function(e) {
                if (e.relatedTarget && (e.relatedTarget == lbl_grp || e.relatedTarget.nearestViewportElement == lbl_grp.nearestViewportElement || e.relatedTarget.nearestViewportElement == target)) {
                    if (self.in_drag && self.targets.indexOf(e.relatedTarget) >= 0) {                        
                        self.resetDrag();
                    }
                    return;
                }

                if (self.in_drag && (e.type == 'mouseup' || e.type == 'touchend')) {
                    if (self.spliceBefore || self.spliceAfter) {
                        nav._spliceTrack(self.trackToSplice, self.spliceBefore, self.spliceAfter);
                    }
                }
                target.removeEventListener('touchmove',dragfn,false);
                target.removeEventListener('mousemove',dragfn,false);
                target.removeEventListener('touchend',arguments.callee,false);
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
            lbl_grp.addEventListener('touchmove',dragfn,false);
            lbl_grp.addEventListener('touchend',single_touch_event(dragfn),false);
            target.addEventListener('mousemove',dragfn,false);
            target.addEventListener('mouseup',enddrag,false);
            target.addEventListener('mouseout',enddrag,false);
            
            self.in_drag = track;
            self.drag_el = lbl_grp;
        };

        var handle_start = function(e) {
            beginDragging(e,track,element);
        };

        var el_move = function(e,trk) {
            var trck = trk ? trk : track;
            var elem = this ? this : element;
            
            if ( self.in_drag && self.in_drag != trck && trck != self._last_target) {
                self._last_target = trck;
                if (self._hover_timeout) {
                    window.clearTimeout(self._hover_timeout);
                }
                self._hover_timeout = window.setTimeout(function() {
                    if ( (self.in_drag.group || trck.group) &&                    
                         (self.in_drag.group ? trck.group :  ! trck.group ) ) {
                        if (self.in_drag.group.name != trck.group.name) {
                            return;
                        }
                    } else {
                        if ( self.in_drag.group || trck.group ) {
                            return;
                        }
                    }

                    if (self._anim) {
                        window.clearInterval(self._anim);
                        self._anim = null;
                    }
                    
                    self.resetDrag();
                    
                    var current_sibling = elem;
                    
                    var elements_to_shift = [];

                    while (current_sibling !== null) {
                        if (current_sibling != self.drag_el && self.targets.indexOf(current_sibling) >= 0) {
                            elements_to_shift.push(current_sibling);
                        }
                        current_sibling = current_sibling.nextSibling;
                        if (current_sibling == self.drag_el) {
                            break;
                        }
                    }
                    
                    current_sibling = elem.previousSibling;
                    
                    var elements_to_shift_up = [];
                    
                    while (current_sibling !== null) {
                        if (current_sibling != self.drag_el && self.targets.indexOf(current_sibling) >= 0) {
                            elements_to_shift_up.push(current_sibling);
                        }
                        current_sibling = current_sibling.previousSibling;
                        if (current_sibling == self.drag_el) {
                            break;
                        }
                    }
                    var anim_steps = 1;
                    var height = 100.0 / nav._zoom_scale;
                    self._anim = window.setInterval(function() {
                        var curr_transform, i = 0;
                        
                        if (anim_steps < 5) {
                            for (i = 0; i < elements_to_shift.length; i++ ) {
                                curr_transform = elements_to_shift[i].getAttribute('transform') || '';
                                curr_transform = curr_transform.replace(/\s?translate\([^\)]+\)/,'');
                                curr_transform += ' translate(0,'+anim_steps*height+')';
                                elements_to_shift[i].setAttribute('transform',curr_transform);
                            }

                            for (i = 0; (elements_to_shift.length > 0) && i < elements_to_shift_up.length; i++ ) {

                                curr_transform = elements_to_shift_up[i].getAttribute('transform') || '';
                                curr_transform = curr_transform.replace(/\s?translate\([^\)]+\)/,'');
                                curr_transform += ' translate(0,'+anim_steps*-1*height+')';
                                elements_to_shift_up[i].setAttribute('transform',curr_transform);
                            }


                            anim_steps += 1;
                        } else {
                            self.spliceBefore = trck;
                            self.trackToSplice = self.in_drag;
                            window.clearInterval(self._anim);
                            self._anim = null;
                        }
                    },30);

                },300);
            }
        };
        
        
        handle.addEventListener('mousedown', handle_start,false);
//        element.addEventListener('mousemove',el_move,false);
        handle.addEventListener('touchstart',single_touch_event(handle_start),false);
//        element.addEventListener('touchmove',single_touch_event(el_move),true);
};

MASCP.CondensedSequenceRenderer.Navigation.prototype._toggleMouseEvents = function(on) {
    var self = this;
    if (self._track_rects) {
        self._track_rects.forEach(function(el) {
//            el.setAttribute('fill',on ? '#ffffff': 'url(#simple_gradient)');
            el.setAttribute('opacity',on ? '1': (("ontouchend" in document) ? "0.5" : "0.1") );

            el.setAttribute('pointer-events', on ? 'all' : 'none');
        });
    }
};

MASCP.CondensedSequenceRenderer.Navigation.prototype._buildTrackPane = function(canvas) {
    var self = this;
    SVGCanvas(canvas);
    canvas.setAttribute('preserveAspectRatio','xMinYMin meet');
    
    this.clearTracks = function() {
        while (canvas.firstChild) {
            canvas.removeChild(canvas.firstChild);
        }
        this._enableDragAndDrop.targets = null;
        this._track_rects = [];
    };
    
    this.setViewBox = function(viewBox) {
        canvas.setAttribute('viewBox',viewBox);
    };
    
    this.setDimensions = function(width,height) {
        canvas.style.height = height;
        canvas.style.width = width;
        canvas.setAttribute('height',height);        
        canvas.setAttribute('width',width);
    };
    
    this.renderTrack = function(track,y,height,options) {
        var label_group = canvas.group();
        var a_rect = canvas.rect(0,y-1*height,'100%',3*height);
        a_rect.setAttribute('stroke','#000000');
        a_rect.setAttribute('stroke-width','2');
        a_rect.setAttribute('fill','url(#simple_gradient)');
        a_rect.setAttribute('opacity',("ontouchend" in document) ? '0.5' : '0.1');
        a_rect.setAttribute('pointer-events','none');
        self._track_rects = self._track_rects ? self._track_rects : [];
        
        self._track_rects.push(a_rect);
        
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
        var text_left;
        if ("ontouchend" in document) {
            text_left = 8*height*text_scale;
        } else {
            text_left = 4*height*text_scale;            
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
        
        var circ;
        
        if (track.href && ! track._group_controller) {
            a_anchor = canvas.a(track.href);
            var icon_name = null;
            var icon_metrics = [0.5*height*text_scale,0,2.5*height*text_scale];
            if ("ontouchend" in document) {
                icon_metrics[2] = icon_metrics[2] * 2;
            }
            icon_metrics[1] = -0.5*(icon_metrics[2] - height);

            circ = canvas.circle(icon_metrics[0]+0.5*icon_metrics[2],0.5*height,0.5*icon_metrics[2]);
            circ.setAttribute('fill','#ffffff');
            circ.setAttribute('opacity','0.1');
            a_anchor.appendChild(circ);
            
            var url_type = track.href;
            if (typeof url_type === 'string' && url_type.match(/^javascript\:/)) {
                icon_name = '#plus_icon';
            } else if (typeof url_type === 'function') {
                icon_name = '#plus_icon';
                a_anchor.setAttribute('href','#');
                a_anchor.removeAttribute('target');
                a_anchor.addEventListener('click',function(e) {
                    url_type.call();

                    if (e.preventDefault) {
                        e.preventDefault();
                    } else {
                        e.returnResult = false;
                    }
                    if (e.stopPropagation) {
                        e.stopPropagation();
                    } else {
                        e.cancelBubble = true;
                    }

                    return false;
                },false);
            } else {
                icon_name = '#new_link_icon';
            }
            if (track.icon) {
                icon_name = track.icon;
            }
            var a_use = canvas.use(icon_name,icon_metrics[0],icon_metrics[1],icon_metrics[2],icon_metrics[2]);
            a_use.style.cursor = 'pointer';
            a_anchor.appendChild(a_use);
            a_anchor.setAttribute('transform','translate(0,'+y+')');
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
            closer.firstChild.setAttribute('fill','url(#red_3d)');
            for (var nodes = closer.childNodes, i = 0, len = nodes.length; i < len; i++) {
                nodes[i].setAttribute('stroke-width',(t_height/4).toString());
            }
            closer.addEventListener('click',function() {
                self._spliceTrack(track);
            },false);
            label_group.push(closer);
            self._close_buttons.push(closer);
            closer.setAttribute('visibility', self.edit_enabled ? 'visible' : 'hidden');
            
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
            circ = canvas.circle(1.5*t_height,0,t_height);
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

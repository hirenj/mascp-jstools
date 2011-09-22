MASCP.CondensedSequenceRenderer.Navigation = (function() {
    var Navigation = function(canvas) {
        construct.call(this,canvas);
    };


    function construct(parent_canvas)  {

    var toggleMouseEvents, DragAndDrop, close_buttons, controller_buttons, close_group, track_canvas, renderer;
        
    var buildNavPane = function(canvas) {
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
    

        var edit_enabled;

        self.refresh = function() {
            (close_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'visible' : 'hidden');
            });
            (controller_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'hidden' : 'visible');
            });
        };

        jQuery(self).bind('toggleEdit',function() {
            edit_enabled = typeof edit_enabled == 'undefined' ? true : ! edit_enabled;
            DragAndDrop.disabled = ! edit_enabled;
            if (edit_enabled) {
                toggleMouseEvents.call(self,true);
            } else {
                toggleMouseEvents.call(self,false);
            }
        
            self.hide();
            self.show();
            
            (close_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'visible' : 'hidden');
            });
            (controller_buttons || []).forEach(function(button) {
                button.setAttribute('visibility', edit_enabled ? 'hidden' : 'visible');
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
                track_canvas.setAttribute('display','inline');
                panel_back.setAttribute('visibility','visible');
                canvas.show();

                close_group._button.removeAttribute('filter');
                close_transform = close_group.getAttribute('transform') || ' ';
                close_transform = close_transform.replace(/translate\(.*\)/,'');
                close_transform = close_transform.replace(/rotate\(.*\)/,'');
            
                close_group.setAttribute('transform',close_transform);

                scroll_controls.setAttribute('display','inline');
            } else {
                track_canvas.setAttribute('display','none');
                panel_back.setAttribute('visibility','hidden');
                canvas.hide();
                close_group._button.setAttribute('filter','url(#drop_shadow)');            
                close_transform = close_group.getAttribute('transform') || ' ';
                close_transform = close_transform + ' translate(-150,0) rotate(45,179,12) ';
                close_group.setAttribute('transform',close_transform);
                scroll_controls.setAttribute('display','none');
            }
            return true;
        };
    
        self.hide = function() {
            toggler.call(this,false);
        };
        self.show = function() {
            toggler.call(this,true);
        };

        self.visible = function() {
            return visible;
        };

        self.setZoom = function(zoom) {
            close_group.setAttribute('transform','scale('+zoom+','+zoom+') ');
            rect.setAttribute('transform','scale('+zoom+',1) ');
        };

        close_group.addEventListener('click',toggler,false);
    };

    DragAndDrop = (function() {    
        var targets = [];
        var in_drag = false, drag_el;
        
        var splice_before, splice_after, trackToSplice;
        
        var last_target;

        var timeouts = {};

        var drag_func = function(handle,element,track,canvas) {
            var nav = this;

            var old_reset = nav.reset;

            nav.reset = function() {
                targets = [];
                old_reset.call(this);
            };

            var resetDrag = function() {
                window.clearTimeout(timeouts.anim);
                window.clearTimeout(timeouts.hover);
                for (var i = 0; i < targets.length; i++) {
                    if (targets[i] != drag_el) {
                        targets[i].removeAttribute('transform');
                        targets[i].setAttribute('pointer-events','all');
                    }
                }
            };
        
            targets.push(element);
            element.track = track;

            var single_touch_event = function(fn) {
                return function(e) {
                    if (e.touches && e.touches.length == 1) {
                        fn.call(this,e);
                    }
                };
            };

            var beginDragging = function(ev,tr,lbl_grp) {
            
                if (drag_disabled()) {
                    return;
                }

                var target = canvas.nearestViewportElement;

                if (in_drag) {
                    return;                
                }


                spliceBefore = null;
                spliceAfter = null;

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
                    targets.forEach(function(targ){
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
                        if (in_drag && targets.indexOf(e.relatedTarget) >= 0) {                        
                            resetDrag();
                        }
                        return;
                    }

                    if (in_drag && (e.type == 'mouseup' || e.type == 'touchend')) {
                        if (spliceBefore || spliceAfter) {
                            spliceTrack(trackToSplice, spliceBefore, spliceAfter);
                        }
                    }
                    target.removeEventListener('touchmove',dragfn,false);
                    target.removeEventListener('mousemove',dragfn,false);
                    target.removeEventListener('touchend',arguments.callee,false);
                    target.removeEventListener('mouseup',arguments.callee,false);
                    target.removeEventListener('mouseout',arguments.callee,false);
                    if (in_drag) {
                        lbl_grp.setAttributeNS(null, 'pointer-events', 'all');
                        lbl_grp.removeAttribute('transform');
                        resetDrag();
                        in_drag = false;
                    }
                };
                lbl_grp.setAttributeNS(null, 'pointer-events', 'none');
                lbl_grp.addEventListener('touchmove',dragfn,false);
                lbl_grp.addEventListener('touchend',single_touch_event(dragfn),false);
                target.addEventListener('mousemove',dragfn,false);
                target.addEventListener('mouseup',enddrag,false);
                target.addEventListener('mouseout',enddrag,false);
            
                in_drag = track;
                drag_el = lbl_grp;
            };

            var handle_start = function(e) {
                beginDragging(e,track,element);
            };

            var el_move = function(e,trk) {
                var trck = trk ? trk : track;
                var elem = this ? this : element;
            
                if ( in_drag && in_drag != trck && trck != last_target) {
                    last_target = trck;
                    if (timeouts.hover) {
                        window.clearTimeout(timeouts.hover);
                    }
                    timeouts.hover = window.setTimeout(function() {
                        if ( (in_drag.group || trck.group) &&                    
                             (in_drag.group ? trck.group :  ! trck.group ) ) {
                            if (in_drag.group.name != trck.group.name) {
                                return;
                            }
                        } else {
                            if ( in_drag.group || trck.group ) {
                                return;
                            }
                        }

                        if (timeouts.anim) {
                            window.clearInterval(timeouts.anim);
                            timeouts.anim = null;
                        }
                    
                        resetDrag();
                    
                        var current_sibling = elem;
                    
                        var elements_to_shift = [];

                        while (current_sibling !== null) {
                            if (current_sibling != drag_el && targets.indexOf(current_sibling) >= 0) {
                                elements_to_shift.push(current_sibling);
                            }
                            current_sibling = current_sibling.nextSibling;
                            if (current_sibling == drag_el) {
                                break;
                            }
                        }
                    
                        current_sibling = elem.previousSibling;
                    
                        var elements_to_shift_up = [];
                    
                        while (current_sibling !== null) {
                            if (current_sibling != drag_el && targets.indexOf(current_sibling) >= 0) {
                                elements_to_shift_up.push(current_sibling);
                            }
                            current_sibling = current_sibling.previousSibling;
                            if (current_sibling == drag_el) {
                                break;
                            }
                        }
                        var anim_steps = 1;
                        var height = drag_el.getBBox().height / 4;
                        timeouts.anim = window.setInterval(function() {
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
                                spliceBefore = trck;
                                trackToSplice = in_drag;
                                window.clearInterval(timeouts.anim);
                                timeouts.anim = null;
                            }
                        },30);

                    },300);
                }
            };
        
            handle.addEventListener('mousedown', handle_start,false);
            handle.addEventListener('touchstart',single_touch_event(handle_start),false);
        };

        var drag_disabled = function() {
            return drag_func.disabled;
        };

        return drag_func;
    })();

    var buildTrackPane = function(canvas) {
        var self = this;
        SVGCanvas(canvas);
        canvas.setAttribute('preserveAspectRatio','xMinYMin meet');

        var track_rects = [];

        this.reset = function() {
            while (canvas.firstChild) {
                canvas.removeChild(canvas.firstChild);
            }
            track_rects = [];
            this.refresh();
        };

        toggleMouseEvents = function(on) {
            var self = this;
            if (track_rects) {
                (track_rects || []).forEach(function(el) {
                    el.setAttribute('opacity',on ? '1': (("ontouchend" in document) ? "0.5" : "0.1") );
                    el.setAttribute('pointer-events', on ? 'all' : 'none');
                });
            }
        };
        
        this.setViewBox = function(viewBox) {
            canvas.setAttribute('viewBox',viewBox);
        };
    
        canvas.style.height = '100%';
        canvas.style.width = '100%';
        canvas.setAttribute('height','100%');        
        canvas.setAttribute('width','100%');
    
        this.renderTrack = function(track,y,height,options) {
            var label_group = canvas.group();
            var a_rect = canvas.rect(0,y-1*height,'100%',3*height);
            a_rect.setAttribute('stroke','#000000');
            a_rect.setAttribute('stroke-width','2');
            a_rect.setAttribute('fill','url(#simple_gradient)');
            a_rect.setAttribute('opacity',("ontouchend" in document) ? '0.5' : '0.1');
            a_rect.setAttribute('pointer-events','none');
            track_rects = track_rects || [];
        
            track_rects.push(a_rect);
        
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
        
            DragAndDrop.call(this,a_rect,label_group,track,canvas);
        
            (function() {
            
                if (track.group) {
                    return;
                }
            
                var t_height = 1.5*height;            
                if ("ontouchend" in document) {
                    t_height = 3*height;
                }
                if ( ! close_buttons) {
                    close_buttons = [];
                }
            
                var closer = canvas.crossed_circle(1.5*t_height,0,t_height);
                closer.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
                closer.firstChild.setAttribute('fill','url(#red_3d)');
                for (var nodes = closer.childNodes, i = 0, len = nodes.length; i < len; i++) {
                    nodes[i].setAttribute('stroke-width',(t_height/4).toString());
                }
                closer.addEventListener('click',function() {
                    spliceTrack(track);
                },false);
                label_group.push(closer);
                close_buttons.push(closer);
                closer.setAttribute('visibility', 'hidden');
            
            })();
        
            if (track._group_controller) {
                if ( ! controller_buttons) {
                    controller_buttons = [];
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

                controller_buttons.push(expander);
                expander.setAttribute('visibility', 'hidden');
            }
        };
    };

    var spliceTrack = function(track,before,after){

        var t_order = renderer._track_order;

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
                renderer.hideGroup(track._group_under_control);                
            }
            renderer.hideLayer(track,true);            
            track.disabled = true;
            t_order.push(track.name);
            t_order = t_order.concat(extra_to_push);
        }
        
        renderer.trackOrder = t_order;
    };


    SVGCanvas(parent_canvas);

    buildNavPane.call(this,parent_canvas);
    
    close_group = parent_canvas.lastChild;

    track_group = parent_canvas.group();

    parent_canvas.insertBefore(track_group,close_group);

    track_canvas = document.createElementNS(svgns,'svg');    
    buildTrackPane.call(this,track_canvas);
    
    track_group.appendChild(track_canvas);

    track_group.setAttribute('clip-path','url(#nav_clipping)');

    this.setRenderer = function(rend) {
        renderer = rend;
    };

    this.demote = function() {
        track_canvas.setAttribute('display','none');
        return;
    };

    this.promote = function() {
        track_canvas.setAttribute('display',this.visible() ? 'inline' : 'none');
    };

    
    }
    return Navigation;
})();
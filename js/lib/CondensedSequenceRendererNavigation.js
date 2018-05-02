
const svgns = 'http://www.w3.org/2000/svg';

import SVGCanvas from './SVGCanvas';
import bean from '../bean';

var touch_scale = 1, touch_enabled = false;
if ("ontouchend" in document) {
    touch_scale = window.devicePixelRatio > 1 ? 2 : 1;
    touch_enabled = true;
}

var Navigation = function(parent_canvas,renderer) {
    SVGCanvas(parent_canvas);

    this.win = function() {
        return renderer.win();
    };

    buildNavPane.call(this,parent_canvas);

    var track_group = parent_canvas.group();

    parent_canvas.insertBefore(track_group,parent_canvas.lastChild);

    var track_canvas = document.createElementNS(svgns,'svg');    
    buildTrackPane.call(this,track_canvas,connectRenderer.call(this,renderer));

    track_group.appendChild(track_canvas);

    track_group.setAttribute('clip-path','url(#'+this.clipping_id+')');

    this.disable = function() {
        parent_canvas.style.display = 'none';
        track_canvas.style.display = 'none';

    };

    this.enable = function() {
        parent_canvas.style.display = 'block';
        track_canvas.style.display = 'block';
    }

    this.demote = function() {
        track_canvas.hide();
        return;
    };

    this.promote = function() {
        if (this.visible()) {
            track_canvas.show();
        } else {
            track_canvas.hide();
        }
    };
    
    this.setDimensions = function(width,height) {
        parent_canvas.setAttribute('width',width);
        parent_canvas.setAttribute('height',height);
    };
    
};

var connectRenderer = function(renderer) {

    /**
     * Create a layer based controller for a group. Clicking on the nominated layer will animate out the expansion of the
     * group.
     * @param {Object} lay Layer to turn into a group controller
     * @param {Object} grp Group to be controlled by this layer.
     */
    
    var controller_map = {};
    var expanded_map = {};
    
    var old_remove_track = renderer.removeTrack;

    renderer.removeTrack = function(layer) {
        old_remove_track.call(this,layer);
        delete controller_map[layer.name];
        delete expanded_map[layer.name];
    };


    this.isController = function(layer) {
        if (controller_map[layer.name]) {
            return true;
        } else {
            return false;
        }
    };
    
    this.getController = function(group) {
        for (var lay in controller_map) {
            if (controller_map.hasOwnProperty(lay) && controller_map[lay] == group) {
                return MASCP.getLayer(lay);
            }
        }
        return null;
    };
    
    this.isControllerExpanded = function(layer) {
        return expanded_map[layer.name];
    };
    
    renderer.createGroupController = function(lay,grp) {
        var layer = MASCP.getLayer(lay);
        var group = MASCP.getGroup(grp);

        if ( ! layer || ! group) {
            return;
        }

        if (controller_map[layer.name]) {
            return;
        }

        controller_map[layer.name] = group;
        
        expanded_map[layer.name] = false;
        
        var self = this;

        bean.add(layer,'removed',function(ev,rend) {
            self.setGroupVisibility(group);
        });

        bean.add(layer,'visibilityChange',function(rend,visible) {
            if (group.size() > 0) {
                if (! expanded_map.hasOwnProperty(layer.name)) {
                    expanded_map[layer.name] = false;
                }
                self.setGroupVisibility(group, expanded_map[layer.name] && visible,true);
                renderer.refresh();
            }
        });
        bean.add(group,'visibilityChange',function(rend,visible) {
            if (visible) {
                self.showLayer(layer,true);
                expanded_map[layer.name] = true;
            }
        });
        bean.remove(layer,'_expandevent')
        bean.add(layer,'_expandevent',function(ev) {
            expanded_map[layer.name] = ! expanded_map[layer.name];
            self.withoutRefresh(function() {
                self.setGroupVisibility(group,expanded_map[layer.name]);
            });
            self.refresh(true);
        });
    };

    return DragAndDrop(function(track,before,after){
        var t_order = renderer.trackOrder;

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
        if (controller_map[track.name]) {
            let layer_func = function(lay) {
                if (MASCP.getGroup(lay) === lay) {
                    MASCP.getGroup(lay).eachLayer(layer_func);
                }
                if (t_order.trackIndex(lay) >= 0) {
                    extra_to_push = [t_order.splice(t_order.trackIndex(lay),1)[0]].concat(extra_to_push);
                }
            }
            MASCP.getGroup(controller_map[track.name]).eachLayer(layer_func);
        }
        if (before) {
            t_order.splice(t_order.trackIndex(before),1,track.name, before ? before.name : undefined );
            for (var i = 0; i < extra_to_push.length; i++ ) {
                if (extra_to_push[i]) {
                    t_order.splice(t_order.trackIndex(before),0,extra_to_push[i]);
                }
            }
        } else {
            renderer.hideLayer(track);
            MASCP.getLayer(track).disabled = true;                

            extra_to_push.forEach(function(lay) {
                
                renderer.hideLayer(lay);
                MASCP.getLayer(lay).disabled = true;                    
            });
            t_order.push(track.name);
            t_order = t_order.concat(extra_to_push);
        }
    
        renderer.trackOrder = t_order;
    });
};

var DragAndDrop = function(spliceFunction) {    
    var targets = [];
    var in_drag = false, drag_el;
    
    var splice_before, splice_after, trackToSplice;
    
    var last_target;

    var timeouts = {};
    
    var nav_reset_set = null;

    let spliceBefore;
    let spliceAfter;


    var drag_func = function(handle,element,track,canvas) {
        var nav = this;


        var old_reset = nav.reset;
        if (nav_reset_set === null) {
            nav.reset = function() {
                targets = [];
                old_reset.call(this);
            };
            nav_reset_set = true;
        }
        var resetDrag = function() {
            window.clearTimeout(timeouts.anim);
            window.clearTimeout(timeouts.hover);
            for (var i = 0; i < targets.length; i++) {
                if (targets[i] != drag_el) {
                    targets[i].removeAttribute('dragging');
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
            lbl_grp.setAttribute('dragging','true');

            spliceBefore = null;
            spliceAfter = null;

            var p_orig = lbl_grp.nearestViewportElement.createSVGPoint();

            p_orig.x = ev.clientX || (window.pageXOffset + ev.touches[0].clientX);
            p_orig.y = ev.clientY || (window.pageYOffset + ev.touches[0].clientY);

            var rootCTM = lbl_grp.nearestViewportElement.getScreenCTM();
            var matrix = rootCTM.inverse();

            p_orig = p_orig.matrixTransform(matrix);

            var oX = p_orig.x;
            var oY = p_orig.y;

            var dragfn = function(e) {
                var p = lbl_grp.nearestViewportElement.createSVGPoint();
                p.x = e.clientX || (window.pageXOffset + e.touches[0].clientX);
                p.y = e.clientY || (window.pageYOffset + e.touches[0].clientY);
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
            if (touch_enabled) {
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
                        spliceFunction(trackToSplice, spliceBefore, spliceAfter);
                    }
                }
                target.removeEventListener('touchmove',dragfn,false);
                target.removeEventListener('mousemove',dragfn,false);
                target.removeEventListener('touchend',enddrag,false);
                target.removeEventListener('mouseup',enddrag,false);
                target.removeEventListener('mouseout',enddrag,false);
                if (in_drag) {
                    lbl_grp.setAttributeNS(null, 'pointer-events', 'all');
                    lbl_grp.removeAttribute('transform');
                    resetDrag();
                    in_drag = false;
                    last_target = null;
                }
            };
            lbl_grp.setAttributeNS(null, 'pointer-events', 'none');
            lbl_grp.addEventListener('touchmove',dragfn,false);
            lbl_grp.addEventListener('touchend',enddrag,false);
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

    drag_func.spliceFunction = spliceFunction;
    
    return drag_func;
};

var setElementTransform = function(el,transform) {
    var ua = window.navigator.userAgent;
    if (ua.indexOf('Edge/') >= 0) {
        transform = transform.replace(/px/g,'');
        el.setAttribute('transform',transform);
    } else {
        el.style.transform = transform;
    }
};

var buildNavPane = function(back_canvas) {
    var self = this;
    self.zoom = 1;
    self.nav_width_base = 200;
    var nav_width = self.nav_width_base;
    self.nav_width = self.nav_width_base;
    var panel_back = back_canvas.group();
    var button_group = back_canvas.group();
    
    var rect = back_canvas.rect(-10,0,nav_width.toString(),'100%');
    var base_rounded_corner = [12*touch_scale,10*touch_scale];
    rect.setAttribute('rx',base_rounded_corner[0].toString());
    rect.setAttribute('ry',base_rounded_corner[1].toString());    
    if (! touch_enabled) {
        rect.setAttribute('opacity','0.8');
    }
    rect.style.stroke = '#000000';
    rect.style.strokeWidth = '2px';
    rect.style.fill = '#000000';
    rect.id = 'nav_back';

    panel_back.push(rect);

    self.clipping_id = 'nav_clipping'+(new Date()).getTime();
    var clipping = document.createElementNS(svgns,'clipPath');
    clipping.id = self.clipping_id;
    var rect2 = rect.cloneNode();
    rect2.removeAttribute('id');
    rect2.removeAttribute('opacity');
    rect2.setAttribute('x','0');
    rect2.setAttribute('width',""+(parseInt(rect2.getAttribute('width')) - 10));
    rect2.removeAttribute('style');
    rect2.setAttribute('height','10000');

    back_canvas.insertBefore(clipping,back_canvas.firstChild);
    clipping.appendChild(rect2);

    var close_group = back_canvas.crossed_circle(nav_width-(10 + touch_scale*11),(12*touch_scale),(10*touch_scale));

    close_group.style.cursor = 'pointer';
    if (typeof matchMedia !== 'undefined') {
        (this.win() || window).matchMedia('print').addListener(function(match) {
            if (match.matches) {
                close_group.setAttribute('display','none');
                tracks_button.setAttribute('display','none');
            } else {
                close_group.setAttribute('display','block'); 
                tracks_button.setAttribute('display','none');
            }
        });
    }

    button_group.push(close_group);

    var tracks_button = MASCP.IE ? back_canvas.svgbutton(10,5,65,25,'Edit') : back_canvas.button(10,5,65,25,'Edit');
    tracks_button.id = 'controls';
    tracks_button.parentNode.setAttribute('clip-path','url(#'+self.clipping_id+')');

    panel_back.push(MASCP.IE ? tracks_button : tracks_button.parentNode);

    tracks_button.addEventListener('click',function() {
        bean.fire(self,'toggleEdit');
        bean.fire(self,'click');
    },false);


    panel_back.setAttribute('style','transition: all 0.25s;');

    var old_tracks_style = tracks_button.getAttribute('style');
    var transform_origin = ""+(nav_width-(10 + touch_scale*11))+"px "+(12*touch_scale)+"px";
    var translate = function(amount,rotate) {
        var trans = " translate3d("+amount+"px,0px,0px)";
        if (rotate) {
            trans = trans + " rotate("+rotate+")";
        }
        return "-webkit-transform:"+trans+"; -moz-transform:"+trans+"; -ms-transform:"+trans.replace('3d','').replace(',0px)',')')+"; transform: "+trans+";";
    };


    tracks_button.setAttribute('style',old_tracks_style+" transition: all 0.25s;");
    close_group.style.transition = 'all 0.25s';
    close_group.style.transformOrigin = transform_origin;
    var visible = true;

    
    var toggler = function(vis,interactive) {
        visible = ( vis === false || vis === true ) ? vis : ! visible;
        var close_transform;
        var needs_transition = interactive ? "all ease-in-out 0.4s" : "";
        let parent_transform = back_canvas.parentNode.style.transform;
        let scaleval;
        let yscale = touch_scale;
        if (scaleval = parent_transform.match(/scale\(([\d\.]+)\)/)) {
            yscale = 1;
        }
        var transform_origin = ""+(self.nav_width_base-(10 + touch_scale*11))+"px "+(12*yscale)+"px";

        if (visible) {
            self.promote();
            setElementTransform(panel_back,'translate(0,0)');
            panel_back.style.transition = needs_transition;

            close_group._button.removeAttribute('filter');
            if ("ontouchend" in window || window.getComputedStyle(close_group).getPropertyValue("-ms-transform")) {
                setElementTransform(close_group,'');
            }
            setElementTransform(close_group, 'translate(0,0)');
            close_group.style.transition = needs_transition;
            close_group.style.transformOrigin = close_group.getBoundingClientRect().left+'px ' +close_group.getBoundingClientRect().top+' px';
            self.refresh();
        } else {
            self.demote();
            // Chrome bug Jan 2015 with the drop shadow
            //close_group._button.setAttribute('filter','url(#drop_shadow)');
            close_group.style.transition = needs_transition;
            close_group.style.transition = needs_transition;
            // close_group.style.transformOrigin = transform_origin;
            close_group.style.transformOrigin = close_group.getBoundingClientRect().left+'px ' +close_group.getBoundingClientRect().top+' px';

            setElementTransform(close_group, 'translate('+-0.75*self.nav_width_base+'px,0) rotate(405deg)');
            if ("ontouchend" in window) {
                // No longer special casing IE
                setElementTransform(close_group,'translate('+-0.75*self.nav_width_base+'px,0) rotate(45,'+(self.nav_width_base-(10 + touch_scale*11))+'px,'+(12*touch_scale)+'px)');
                setElementTransform(panel_back, 'translate('+(-1*self.nav_width*self.zoom)+'px,0)');
                panel_back.style.transition = needs_transition;
            } else {
                setElementTransform(panel_back,'translate('+(-1*self.nav_width*self.zoom)+'px,0)');
                panel_back.style.transition = needs_transition;
            }
        }
        return true;
    };

    self.move_closer = function() {
        if (visible) {
            return;
        }
        setElementTransform(close_group,'translate('+-0.75*self.nav_width_base+'px,0) rotate(405deg)');
        if ("ontouchend" in window) {
            // No longer special casing IE
            setElementTransform(close_group,'translate('+-0.75*self.nav_width_base+'px,0) rotate(45,'+(self.nav_width_base-(10 + touch_scale*11))+'px,'+(12*touch_scale)+'px)');
        }
    };

    self.hide = function(interactive) {
        toggler.call(this,false,interactive);
    };
    self.show = function(interactive) {
        toggler.call(this,true,interactive);
    };

    self.visible = function() {
        return visible;
    };

    self.setZoom = function(zoom) {
        self.nav_width = self.nav_width_base / zoom;
        close_group.setAttribute('transform','scale('+zoom+','+zoom+') ');
        let parent_transform = back_canvas.parentNode.style.transform;
        let scaleval;
        let yscale = touch_scale;
        if (scaleval = parent_transform.match(/scale\(([\d\.]+)\)/)) {
            yscale = 1;
        }
        var transform_origin = ""+(self.nav_width_base-(10 + touch_scale*11)).toFixed(2)+"px "+(12*yscale)+"px";

        close_group.style.transformOrigin = transform_origin;

        close_group.move(self.nav_width_base-(10 + touch_scale*11),12*touch_scale);
        rect.setAttribute('transform','scale('+zoom+',1) ');
        rect.setAttribute('ry', (base_rounded_corner[1]).toString());
        rect.setAttribute('rx', (base_rounded_corner[0]/zoom).toString());
        rect.setAttribute('x', parseInt(-10 / zoom).toString());
        rect.setAttribute('width', (self.nav_width).toString());
        self.zoom = zoom;
        toggler.call(this,visible);
        self.refresh();
    };

    close_group.addEventListener('click',function() {
        if (visible) {
            self.hide(true);
        } else {
            self.show(true);
        }
    },false);
};

var buildTrackPane = function(track_canvas,draganddrop) {
    var self = this;

    var close_buttons, controller_buttons, edit_enabled;

    var nav_width_track_canvas_ctm = 0;

    SVGCanvas(track_canvas);
    track_canvas.setAttribute('preserveAspectRatio','xMinYMin meet');



    var track_rects = [];

    self.reset = function() {
        while (track_canvas.firstChild) {
            track_canvas.removeChild(track_canvas.firstChild);
        }
        track_rects = [];
        ctm_refresh = [];
//            self.refresh();
    };

    var ctm_refresh = [];

    self.isEditing = function() {
        return edit_enabled;
    };

    self.refresh = function() {
        (close_buttons || []).forEach(function(button) {
            button.setAttribute('visibility', edit_enabled ? 'visible' : 'hidden');
        });
        (controller_buttons || []).forEach(function(button) {
            button.setAttribute('visibility', edit_enabled ? 'hidden' : 'visible');
        });
        if (edit_enabled) {
            toggleMouseEvents.call(this,true);
        } else {
            toggleMouseEvents.call(this,false);
        }

        if (track_canvas.getAttribute('display') == 'none' || track_canvas.style.display == 'none') {
            return;
        }
        if (ctm_refresh.length < 1) {
            return;
        }
        var nav_back = track_canvas.ownerSVGElement.getElementById('nav_back');

        var ctm = nav_back.getScreenCTM().inverse().multiply(track_canvas.getScreenCTM()).inverse();
        var back_width = (nav_back.getBBox().width + nav_back.getBBox().x);
        var point = track_canvas.createSVGPoint();
        point.x = back_width;
        point.y = 0;
        nav_width_track_canvas_ctm = point.matrixTransform(ctm).x;
        ctm_refresh.forEach(function(el) {
            var width = 0;
            try {
                width = el.getBBox().width;
            } catch (err) {
                // This is a bug with Firefox on some elements getting
                // the bounding box. We silently fail here, as I can't
                // figure out why the call to getBBox fails.
            }
            if ( width > 0) {
                var a_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(el.getAttribute('transform') || '');
                if (typeof a_y != 'undefined') {
                    a_y = a_y[2];
                } else {
                    return;
                }
                
                var new_x = nav_width_track_canvas_ctm- 1.5*parseInt(el.getAttribute('width'),10);
                el.setAttribute('transform','translate('+new_x+','+a_y+')');
            }
        });
    };

    var toggleMouseEvents = function(on) {
        if (track_rects) {
            (track_rects || []).forEach(function(el) {
                el.setAttribute('opacity',on ? '1': (touch_enabled ? "0.5" : "0.1") );
                el.setAttribute('pointer-events', on ? 'all' : 'none');
                on ? el.parentNode.setAttribute('dragenabled','true') : el.parentNode.removeAttribute('dragenabled');
            });
        }
    };

    bean.add(self,'toggleEdit',function() {
        edit_enabled = typeof edit_enabled == 'undefined' ? true : ! edit_enabled;
        draganddrop.disabled = ! edit_enabled;
        toggleMouseEvents.call(self,edit_enabled);
    
        self.hide();
        self.show();
        
        (close_buttons || []).forEach(function(button) {
            button.setAttribute('visibility', edit_enabled ? 'visible' : 'hidden');
        });
        (controller_buttons || []).forEach(function(button) {
            button.setAttribute('visibility', edit_enabled ? 'hidden' : 'visible');
        });

    });
    
    this.setViewBox = function(viewBox) {
        track_canvas.setAttribute('viewBox',viewBox);
    };

    track_canvas.style.height = '100%';
    track_canvas.style.width = '100%';
    track_canvas.setAttribute('height','100%');        
    track_canvas.setAttribute('width','100%');


    this.renderTrack = function(track,y,height,options) {
        var label_group = track_canvas.group();
        var a_rect = track_canvas.rect(0,y,'100%',height);
        a_rect.setAttribute('stroke','#000000');
        a_rect.setAttribute('stroke-width','2');
        a_rect.setAttribute('fill','url(#simple_gradient)');
        a_rect.setAttribute('opacity',touch_enabled ? '0.5' : '0.1');
        a_rect.setAttribute('pointer-events','none');
        track_rects = track_rects || [];
    
        track_rects.push(a_rect);
    
        label_group.push(a_rect);

        // Use these for debugging positioning
    
        // var r = track_canvas.rect(0,y-height,height,height);
        // r.setAttribute('fill','#ff0000');
        // label_group.push(r);
        // 
        // r = track_canvas.rect(0,y+height,height,height);
        // r.setAttribute('fill','#ff0000');
        // label_group.push(r);
    
    
        var text_scale = (options && options['font-scale']) ? options['font-scale'] : 1;
        var text_left = 4/3*touch_scale*height*text_scale;            
        var a_text = track_canvas.text(text_left,y+0.5*height,track.fullname || track.name);
        a_text.setAttribute('height', height);
        a_text.setAttribute('width', height);
        a_text.setAttribute('font-size',0.6*height*text_scale);
        a_text.setAttribute('fill','#ffffff');
        a_text.setAttribute('stroke','#ffffff');
        a_text.setAttribute('stroke-width','0');
        a_text.firstChild.setAttribute('dy', '0.5ex');

        // r = track_canvas.rect(3*height*text_scale,y+0.5*height,2*height,2*height);
        // r.setAttribute('fill','#00ff00');
        // label_group.push(r);

        label_group.push(a_text);
    
        a_text.setAttribute('pointer-events','none');
    
        var circ;
    
        if (track.href ) {
            a_anchor = track_canvas.a(track.href);
            var icon_name = null;
            var icon_metrics = [0.5*height*text_scale,0,height*text_scale*touch_scale];
            icon_metrics[1] = -0.5*(icon_metrics[2] - height);

            circ = track_canvas.circle(icon_metrics[0]+0.5*icon_metrics[2],0.5*height,0.5*icon_metrics[2]);
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
            var a_use = track_canvas.use(icon_name,icon_metrics[0],icon_metrics[1],icon_metrics[2],icon_metrics[2]);
            a_use.style.cursor = 'pointer';
            a_anchor.appendChild(a_use);
            a_anchor.setAttribute('transform','translate('+(nav_width_track_canvas_ctm - 1.5*icon_metrics[2])+','+y+')');
            a_anchor.setAttribute('width',icon_metrics[2].toString());
            ctm_refresh.push(a_anchor);
        }
    
        label_group.addEventListener('touchstart',function() {
            label_group.onmouseover = undefined;
            label_group.onmouseout = undefined;
        },false);

        label_group.addEventListener('touchend',function() {
            label_group.onmouseover = undefined;
            label_group.onmouseout = undefined;
        },false);
    
        draganddrop.call(this,a_rect,label_group,track,track_canvas);
    
        (function() {
        
            if (track.group) {
                return;
            }
        
            var t_height = 0.5*height*touch_scale;            

            if ( ! close_buttons) {
                close_buttons = [];
            }
        
            var closer = track_canvas.crossed_circle(1.5*t_height,0,t_height);
            closer.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
            closer.firstChild.setAttribute('fill','url(#red_3d)');
            for (var nodes = closer.childNodes, i = 0, len = nodes.length; i < len; i++) {
                nodes[i].setAttribute('stroke-width',(t_height/4).toString());
            }
            closer.addEventListener('click',function() {
                draganddrop.spliceFunction(track);
            },false);
            label_group.push(closer);
            close_buttons.push(closer);
            closer.setAttribute('visibility', 'hidden');
        
        })();
        if (this.isController(track)) {
            if ( ! controller_buttons) {
                controller_buttons = [];
            }

            var t_height = 0.5*height*touch_scale;
            var expander = track_canvas.group();
            circ = track_canvas.circle(1.5*t_height,0,t_height);
            circ.setAttribute('fill','#ffffff');
            circ.setAttribute('opacity','0.1');
            expander.push(circ);

            var t_metrics = [1.1*t_height,-1.25*t_height,2.25*t_height,(-0.5*t_height),1.1*t_height,0.25*t_height];
        
            t_metrics[1] += 0.5*(t_height - 0*height);
            t_metrics[3] += 0.5*(t_height - 0*height);
            t_metrics[5] += 0.5*(t_height - 0*height);

        
            var group_toggler = track_canvas.poly(''+t_metrics[0]+','+t_metrics[1]+' '+t_metrics[2]+','+t_metrics[3]+' '+t_metrics[4]+','+t_metrics[5]);
            if (this.isControllerExpanded(track)) {
                expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+') rotate(90,'+(1.5*t_height)+','+t_metrics[3]+')');
            } else {
                expander.setAttribute('transform','translate(0,'+(y+0.5*height)+') scale('+text_scale+')');
            }
            group_toggler.setAttribute('height', 1.75*t_height);
            group_toggler.setAttribute('font-size',1.5*t_height);
            group_toggler.setAttribute('fill','#ffffff');
            group_toggler.setAttribute('pointer-events','none');
        
            expander.push(group_toggler);

            expander.style.cursor = 'pointer';
            expander.addEventListener('click',function(e) {
                e.stopPropagation();
                bean.fire(track,'_expandevent');
                if (self.isControllerExpanded(track)) {
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

export default Navigation;

/**
 *  @fileOverview   Basic classes and definitions for an SVG-based sequence renderer
 */

/*
 *  Include the svgweb library when we include this script. Set the SVGWEB_PATH environment variable if
 *  you wish to retrieve svgweb from a relative path other than ./svgweb/src
 */
if (document.write && (typeof svgweb == 'undefined') && (typeof SVGWEB_LOADING == 'undefined') && ! window.svgns ) {

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

    canvas.setAttribute('data','blank.svg');
    canvas.setAttribute('type','image/svg+xml');
    canvas.setAttribute('width','100%');
    canvas.setAttribute('height','100%');
    
    canvas.addEventListener('load',function() {
        var container_canv = (this.contentDocument || this.getAttribute('contentDocument')).rootElement;
        
        var nav_group = document.createElementNS(svgns,'g');
        renderer._nav_canvas = document.createElementNS(svgns,'svg');
        
        var group = document.createElementNS(svgns,'g');        
        renderer._canvas = document.createElementNS(svgns,'svg');

        var canv = renderer._canvas;
    
        var oldAddEventListener = canv.addEventListener;
    
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

        jQuery(renderer._canvas).bind('pan',function() {
            if (renderer._canvas.currentTranslate.x == 0) {
                left_fade.style.display = 'none';
            } else {
                left_fade.style.display = 'block';                
            }
        });
        jQuery(renderer._canvas).bind('_anim_begin',function() {
            left_fade.style.display = 'none';
        });

        jQuery(renderer._canvas).bind('_anim_end',function() {
            jQuery(renderer._canvas).trigger('pan');
        });
        
        container_canv.appendChild(left_fade);
        container_canv.appendChild(right_fade);
        
        
        container_canv.appendChild(nav_group);
        nav_group.appendChild(renderer._nav_canvas);


        renderer._canvas.setCurrentTranslateXY = function(x,y) {
                group.setAttribute('transform','translate('+x+', '+y+')');            
                this.currentTranslate.x = x;
                this.currentTranslate.y = y;
        };
        
        renderer._nav_canvas.setCurrentTranslateXY = function(x,y) {
                nav_group.setAttribute('transform','translate('+x+', '+y+')');            
                this.currentTranslate.x = x;
                this.currentTranslate.y = y;
        };
        renderer._addNav();
        
        renderer._container_canvas = container_canv;
        container_canv.setAttribute('preserveAspecRatio','xMinYMin slice');
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
    jQuery(this._canvas).bind('panstart',function() {
       nav.demote(); 
       nav.hideFilters();
    });
    jQuery(this._canvas).bind('panend',function() {
       nav.promote(); 
       nav.showFilters();
    });
    jQuery(this._canvas).bind('_anim_begin',function() {
        nav.demote();
        nav.hideFilters();
    });
    jQuery(this._canvas).bind('_anim_end',function() {
        nav.promote();
        nav.showFilters();
    });

};

MASCP.CondensedSequenceRenderer.Navigation = function(canvas) {
    this._RS = 1;
    this._extendWithSVGApi(canvas);

    this._canvas = canvas;
    
    this._buildNavPane(canvas);

    track_group = canvas.group();

    var track_canvas = document.createElementNS(svgns,'svg');    
    this._buildTrackPane(track_canvas);

    track_group.appendChild(track_canvas);

    track_group.setAttribute('clip-path','url(#nav_clipping)');
    
    this._track_canvas = track_group;
    
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.hideFilters = function() {
    this._nav_pane_back.removeAttribute('filter');
//    this._nav_pane_back.setAttribute('opacity',1);
//    this._nav_pane_back.style.fill = '#494949';
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.showFilters = function() {
    if (this._is_open) {
        this._nav_pane_back.setAttribute('filter','url(#drop_shadow)');
    }
//    this._nav_pane_back.setAttribute('opacity',0.8);
//    this._nav_pane_back.style.fill = '#000000';
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.demote = function() {
    var canv = this._track_canvas;
    if (canv.fader) {
        window.clearTimeout(canv.fader);
    }
    canv.style.display = 'none';
    return;
};

MASCP.CondensedSequenceRenderer.Navigation.prototype.promote = function() {
    var canv = this._track_canvas;
    if (canv.fader) {
        window.clearTimeout(canv.fader);
    }
    // canv.setCurrentTranslateXY(-192,0);
    if (canv.style.display == 'block') {
        canv.style.width = '100%';
        // canv.setCurrentTranslateXY(0,0);
        return;
    }
    canv.style.display = 'block';
    var width_counter = -192;
    // canv.fader = window.setTimeout(function() {
    //     if (width_counter < 0) {
    //         canv.setCurrentTranslateXY(width_counter,0);
    //         width_counter += 10;
    //         canv.fader = window.setTimeout(arguments.callee,1);
    //     } else {
    //         canv.setCurrentTranslateXY(0,0);
    //     }
    // },100);
};


MASCP.CondensedSequenceRenderer.Navigation.prototype._buildNavPane = function(canvas) {
    var self = this;
    var rect = canvas.rect(-10,0,'200px','99%');
    rect.setAttribute('rx','10');
    rect.setAttribute('ry','10');    
    rect.setAttribute('opacity','0.8');
    rect.style.stroke = '#000000';
    rect.style.strokeWidth = '2px';
    rect.style.fill = '#000000';

    rect.setAttribute('filter','url(#drop_shadow)');

    this._nav_pane_back = rect;

    // WebKit has problems with clipping paths. Tracking bug: https://bugs.webkit.org/show_bug.cgi?id=15162

    var clipping = document.createElementNS(svgns,'clipPath');
    clipping.id = 'nav_clipping';
    var rect2 = canvas.rect(0,0,'190px','100%');
    canvas.appendChild(clipping);
    clipping.appendChild(rect2);

//    canvas.setAttribute('width','200px');
    var close_group = canvas.crossed_circle('179px','12px','10px');

    close_group.style.cursor = 'pointer';


    var tracks_button = canvas.button(100,5,65,25,'Options');
    tracks_button.id = 'controls';
    tracks_button.parentNode.setAttribute('clip-path','url(#nav_clipping)');

    var scroll_controls = document.createElementNS(svgns,'foreignObject');
    scroll_controls.setAttribute('x','0');
    scroll_controls.setAttribute('y','0');
    scroll_controls.setAttribute('width','100');
    scroll_controls.setAttribute('height','45');
    scroll_controls.setAttribute('clip-path',"url(#nav_clipping)");
    var body = document.createElementNS('http://www.w3.org/1999/xhtml','body');
    body.setAttribute('id','sequence_control_con');
    body.setAttribute('style','width: 100px; height: 1em; margin: 5px; position: relative; -webkit-transform: translate(0px,5px);');
    scroll_controls.appendChild(body);

    var style = document.createElementNS('http://www.w3.org/1999/xhtml','style');
    style.setAttribute('type','text/css');
    style.textContent = '@media print { #sequence_control_con { display: none; } #controls { display: none; } }';
    body.appendChild(style);
    
    canvas.appendChild(scroll_controls);
    
    this._scroll_control = body;
    
    tracks_button.addEventListener('click',function() {
        jQuery(self).trigger('click');
    },false);
    
    var visible = true;

    /*
    <animateTransform begin="startButton.click" attributeName="transform" type="rotate" from="0" to="270" dur="5s" additive="sum" fill="freeze" xlink:href="#snow" />
    */
    
    var toggler = function(vis) {
        visible = ( vis == false || vis == true ) ? vis : ! visible;
        if (visible) {
            canvas.setCurrentTranslateXY(0,0);
            rect.setAttribute('filter','url(#drop_shadow)');
            close_group._button.removeAttribute('filter');
            close_group.setAttribute('transform','');

            scroll_controls.style.display = 'block';
            tracks_button.parentNode.style.display = 'block';
        } else {
            canvas.setCurrentTranslateXY(-192,0);
            rect.removeAttribute('filter');
            close_group._button.setAttribute('filter','url(#drop_shadow)');            
            close_group.setAttribute('transform','translate(30,0) rotate(45,179,12) ');
            scroll_controls.style.display = 'none';
            tracks_button.parentNode.style.display = 'none';
        }
        self._is_open = visible;
        return true;
    };
    this._is_open = true;
    this._toggler = toggler;
    close_group.addEventListener('click',toggler,false);
    
};

MASCP.CondensedSequenceRenderer.Navigation.prototype._buildTrackPane = function(canvas) {
    this._extendWithSVGApi(canvas);

    canvas.setAttribute('preserveAspectRatio','xMinYMin meet');
    
    this.clearTracks = function() {
        while (canvas.firstChild) 
            canvas.removeChild(canvas.firstChild);
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

        var a_rect = canvas.rect(0,y-height,'100%',3*height);
        a_rect.setAttribute('stroke','#000000');
        a_rect.setAttribute('stroke-width','2');
        a_rect.setAttribute('fill','url(#simple_gradient)');
        a_rect.setAttribute('opacity','0.1');
        
        label_group.push(a_rect);
        
        var a_text = canvas.text(3*height,y,track.fullname);
        a_text.setAttribute('height', 2*height);
        a_text.setAttribute('width', 2*height);
        a_text.setAttribute('font-size',2*height);
        a_text.setAttribute('font-family','Gill Sans');
        a_text.setAttribute('fill','#ffffff');
        a_text.setAttribute('stroke','#ffffff');
        a_text.setAttribute('stroke-width','1');
        a_text.setAttribute('dominant-baseline', 'hanging');


        label_group.push(a_text);
        
        if (track.href) {
            a_anchor = canvas.a(track.href);
            var a_use = canvas.use('#new_link_icon',21.5*height,y-0.5*height,2.5*height,2.5*height);
            a_use.style.cursor = 'pointer';
            a_anchor.appendChild(a_use);
            // a_use.addEventListener('click',function() {
            //     if (track.href) {
            //         window.open(track.href);
            //     }                
            // },false);
        }
        

//        label_group.style.cursor = 'pointer';
        
        label_group.addEventListener('click',function(e) {
            jQuery(track).trigger('click');
            return true;
        },false);
        
        var label_begin = function() {            
            a_rect.setAttribute('opacity','1');
            a_text.style.fill = '#eeeeee';
            return true;
        };
        
        var label_end = function() {
            a_rect.setAttribute('opacity','0.1');
            a_text.style.fill = '#ffffff';
            return true;
        };
        
        label_group.addEventListener('touchstart',function() {
            label_group.onmouseover = undefined;
            label_group.onmouseout = undefined;
            label_begin();
        },false);
        label_group.addEventListener('touchend',function() {
            label_group.onmouseover = undefined;
            label_group.onmouseout = undefined;
            label_end();
        },false);
        
//        label_group.addEventListener('mouseover',label_begin,false);
//        label_group.addEventListener('mouseout',label_end,false);
//        label_group.addEventListener('mouseup',label_end,false);
        
//        label_group.style.zIndex = -10000;
        if (track._group_controller) {
            var expander = canvas.group();            

            var circ = canvas.circle(1.5*height,y+0.5*height,1.3*height);
            circ.setAttribute('fill','#ffffff');
            circ.setAttribute('opacity','0.1');
            expander.push(circ);


            var group_toggler = canvas.poly(''+1.1*height+','+(y-0.25*height)+' '+2.25*height+','+(y + 0.5*height)+' '+1.1*height+','+(y+1.25*height));//canvas.text(height,y+1.1*height, '▶');            
            if (track._isExpanded()) {
                expander.setAttribute('transform','rotate(90,'+(1.5*height)+','+(y+0.5*height)+')');                
            }
            group_toggler.setAttribute('height', 1.75*height);
            group_toggler.setAttribute('font-size',1.5*height);
            group_toggler.setAttribute('fill','#ffffff');
            group_toggler.setAttribute('dominant-baseline','central');
            expander.push(group_toggler);

            expander.style.cursor = 'pointer';
            expander.addEventListener('click',function(e) {
                e.stopPropagation();
                jQuery(track).trigger('longclick');
                if (track._isExpanded()) {
                    expander.setAttribute('transform','rotate(90,'+(1.5*height)+','+(y+0.5*height)+')');                
                } else {
                    expander.setAttribute('transform','');                    
                }
            },false);
            label_group.push(expander);
        }
        
    };
};

MASCP.CondensedSequenceRenderer.prototype._extendWithSVGApi = function(canvas) {
    // We're going to use a render scale
    
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
        this.appendChild(fo);
        var button = document.createElement('button');
        button.style.display = 'block';
//        button.setAttribute('style','-webkit-appearance: button; -webkit-transform: translate('+x+'px,'+y+'px)');
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

    canvas.marker = function(cx,cy,r,symbol) {
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

        marker.push(this.circle(0,-0.5*r,r));
        marker.push(this.circle(0,1.5*r,r));
        var arrow = this.poly((-0.9*r*RS)+','+(0*r*RS)+' 0,'+(-2.5*r*RS)+' '+(.9)*r*RS+','+(0*r*RS));
        arrow.setAttribute('style','fill:#000000;stroke-width: 0;');
        marker.push(arrow);
        marker.setAttribute('transform','translate('+(cx*RS + 2)+','+cy*RS+') scale(1)');
        marker.setAttribute('height', dim.R*RS);
        if (symbol) {
            marker.push(this.text_circle(0,0.5*r,1.75*r,symbol));
        } else {
            marker.push(this.rect(-r,0,2*r,2*r));            
        }
        return marker;
    };

    canvas.text_circle = function(cx,cy,r,txt) {
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

        var marker_group = this.group();

        var back = this.circle(0,dim.CY,9/10*dim.R);
        back.setAttribute('fill','url(#simple_gradient)');
        back.setAttribute('stroke', '#000000');
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

    canvas.set = function() {
        var an_array = new Array();
        an_array.attr = function(hsh,animated) {
            
            var hash = jQuery.extend({},hsh);
            
            if (animated && typeof hash['y'] != 'undefined') {
                
                if ( ! canvas._anim_clock_funcs ) {
                    canvas._anim_clock_funcs = [];
                    canvas._in_anim = true;
                    jQuery(canvas).trigger('_anim_begin');
                    renderer._frame_count = 0;
                    canvas._anim_clock = setInterval(function() {
                        if ( ! canvas._anim_clock_funcs || canvas._anim_clock_funcs.length == 0 ) {
                            clearInterval(canvas._anim_clock);
                            canvas._anim_clock = null;
                            canvas._in_anim = false;
                            jQuery(canvas).trigger('_anim_end');
                            return;
                        }
                        var susp_id = canvas.suspendRedraw(1000);
                        for (var i = 0; i < (canvas._anim_clock_funcs || []).length; i++ ) {
                            canvas._anim_clock_funcs[i].apply();
                        }
                        canvas.unsuspendRedraw(susp_id);
                        renderer._frame_count += 1;
                        
                    },1);
                }
                
                if (an_array.animating) {
                    for (var i = 0; i < (canvas._anim_clock_funcs || []).length; i++ ) {                    
                        if (canvas._anim_clock_funcs[i].target_set != an_array) {
                            continue;
                        }
                        canvas._anim_clock_funcs.splice(i,1);
                    }
                }
                
                
                var counter = 0;
                if (an_array.length == 0) {
                    return;
                }
                var curr_y = an_array[0] ? parseInt(an_array[0].getAttribute('y')) : 0;
                var curr_disp = 'none';
                for (var i = 0 ; i < an_array.length; i++ ) {
                    var a_disp = an_array[i].getAttribute('display');
                    if (a_disp && a_disp != 'none') {
                        curr_disp = a_disp;
                        break;
                    }
                }
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
                }

                an_array.attr(hash);
                if (target_y != curr_y) {
                    var anim_steps = 1 * (Math.abs(parseInt(((target_y - curr_y) / 2000))) + 1);
                    var diff = (target_y - curr_y) / anim_steps;
                    hash['y'] = curr_y || 0;
                    var orig_func = arguments.callee;
                    an_array.animating = true;
                    jQuery(an_array).trigger('_t_anim_begin');
                    canvas._anim_clock_funcs.push(                    
                        function() {
                            orig_func.apply(an_array,[hash]);
                            counter += 1;
                            if (counter <= anim_steps) {
                                hash['y'] += diff;
                                return;
                            }
                            an_array.animating = false;
                            if (target_disp) {
                                an_array.attr({'display' : target_disp});
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
                    var value = hash[key];
                    if (key == 'style' && an_array[i].hasAttribute('style')) {
                        var curr_style = an_array[i].getAttribute('style');
                        curr_style += '; '+hash[key];
                        value = curr_style;
                    }
                    if (key == 'height' && an_array[i].hasAttribute('transform')) {
                        var curr_transform = an_array[i].getAttribute('transform');

                        var curr_scale = /scale\((\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                        
                        var curr_height = parseFloat(an_array[i].getAttribute('height') || 1);
                        
                        var new_scale = 1;
                        if (curr_scale == null) {
                            curr_transform += ' scale(1) ';
                            curr_scale = 1;
                        } else {
                            curr_scale = parseFloat(curr_scale[1]);
                        }
                        
                        
                        new_scale = ( parseFloat(hash[key]) / curr_height ) * curr_scale;
                        
                        curr_transform = curr_transform.replace(/scale\((\d+\.?\d*)\)/,'scale('+new_scale+')');

                        an_array[i].setAttribute('transform',curr_transform);
                    }

                    an_array[i].setAttribute(key, value);
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
                        
                        var curr_x = /translate\((\d+\.?\d*)\s*,\s*(\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                        if (curr_x == null) {
                            continue;
                        }
                        curr_x = curr_x[1];
                        
                        curr_transform = curr_transform.replace(/translate\((\d+\.?\d*)\s*,\s*(\d+\.?\d*)\)/,'translate('+curr_x+','+value+')');
                        an_array[i].setAttribute('transform',curr_transform);                        
                    }
                    if (key == 'x' && an_array[i].hasAttribute('transform')) {
                        var curr_transform = an_array[i].getAttribute('transform');
                        
                        var curr_y = /translate\((\d+\.?\d*)\s*,\s*(\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                        if (curr_y == null) {
                            continue;
                        }
                        curr_y = curr_y[2];
                        curr_transform = curr_transform.replace(/translate\((\d+\.?\d*)\s*,\s*(\d+\.?\d*)\)/,'translate('+value+','+curr_y+')');
                        an_array[i].setAttribute('transform',curr_transform);                        
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

        an_array.refresh_zoom = function() {
            for (var i = 0; i < an_array.length; i++ ) {
                if (an_array[i].zoom_level && an_array[i].zoom_level == 'text') {
                    if (canvas.zoom > 3.5) {
                        an_array[i].setAttribute('display', 'block');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }                        
                }
            
                if (an_array[i].zoom_level && an_array[i].zoom_level == 'summary') {
                    if (canvas.zoom <= 3.5) {
                        an_array[i].setAttribute('display', 'block');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }
                }
            }
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
            
            if (canvas._in_anim) {
                return;
            }
            
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
    var amino_acids = canvas.set();
    var amino_acids_shown = false;
    var x = 0;
    
    for (var i = 0; i < seq_chars.length; i++) {
        var a_text = canvas.text(x,12,seq_chars[i]);
        amino_acids.push(a_text);
        a_text.class = 'aa';
        a_text.style.fontFamily = "'Lucida Console', Monaco, monospace";
        x += 1;
    }
    amino_acids.attr( { 'y':-1000,'width': RS,'text-anchor':'start','dominant-baseline':'hanging','height': RS,'font-size':RS,'fill':'#000000'});

    try {
        var noop = canvas.addEventListener;
    } catch(err) {
        log("Browser does not support addEventListener");
        return;
    }
    jQuery(canvas).bind('panstart', function() {
        amino_acids.attr( { 'y' : '-1000'});
        jQuery(canvas).bind('panend', function() {
            if (amino_acids_shown) {
                amino_acids.attr( { 'y' : 12*RS});                
            }
            jQuery(canvas).unbind('panend',arguments.callee);
        });
    });
    
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
           amino_acids.attr({'y': 12*RS});
           amino_acids_shown = true;
       } else {
           renderer._axis_height = 36;
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
    
    little_ticks.attr({ 'stroke':'#555555', 'stroke-width':0.5*RS+'pt'});
    little_ticks.hide();
    little_labels.hide();

    try {
        var noop = canvas.addEventListener;
    } catch(err) {
        log("Browser does not support addEventListener");
        return;
    }
    jQuery(canvas).bind('zoomChange', function() {
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

    // var container = jQuery('<div class="track"></div>')[0];
    // container.style.height = '100%';
    
    // jQuery(this._container).append(container);
    
    

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

        
        renderer._drawAxis(canv,line_length);
        renderer._drawAminoAcids(canv);
        jQuery(renderer).trigger('sequenceChange');
    });
    
    if (this._canvas) {
       jQuery(this).trigger('svgready');
    } else {
        if (typeof svgweb != 'undefined') {
            svgweb.appendChild(canvas,this._container);
        } else {
            this._container.appendChild(canvas);
        }
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
    var circ = canvas.text_circle(this._index+0.5,0.5,2,layerName.charAt(0).toUpperCase());
    this._renderer._layer_containers[layerName].push(circ);
    circ.zoom_level = 'summary';
    circ.style.strokeWidth = '0px';
    circ.setAttribute('fill',MASCP.layers[layerName].color);
    circ.setAttribute('display', 'none');
    circ.setAttribute('class',layerName);

    var bobble = canvas.circle(this._index+0.3,10,0.25);
    bobble.setAttribute('display','none');
    bobble.style.opacity = '0.4';
    var tracer = canvas.rect(this._index+0.3,10,0.1,0);
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
    var tracer_marker = canvas.marker(this._index+0.3,10,0.5,layerName.charAt(0).toUpperCase());
    
    tracer_marker.zoom_level = 'text';
    tracer_marker.setAttribute('display','none');

    this._renderer._layer_containers[layerName].tracers.push(tracer);
    this._renderer._layer_containers[layerName].tracers.push(bobble);
    this._renderer._layer_containers[layerName].push(tracer_marker);
    canvas.tracers.push(tracer);
    return circ;
};

var addBoxOverlayToElement = function(layerName,fraction,width) {
    var canvas = this._renderer._canvas;
    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.setAttribute('class',layerName);
    rect.style.strokeWidth = '0px';
    rect.setAttribute('display', 'none');
    rect.style.opacity = fraction;
    rect.setAttribute('fill',MASCP.layers[layerName].color);
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
    var rect =  canvas.rect(-0.25+this._index,60,width || 1,4);
    this._renderer._layer_containers[layerName].push(rect);
    rect.style.strokeWidth = '0px';    
    rect.setAttribute('fill',MASCP.layers[layerName].color);
    rect.setAttribute('display', 'none');
    rect.setAttribute('class',layerName);
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
        this._canvas.setAttribute('width', (this._zoomLevel || 1)*2*this.sequence.length+'px');
        this._canvas.setAttribute('height',(this._zoomLevel || 1)*2*(this._canvas._canvas_height/this._RS)+'px');
        this._container_canvas.setAttribute('height',(this._zoomLevel || 1)*2*(this._canvas._canvas_height/this._RS)+'px');
        this._nav_canvas.setAttribute('width',(this._zoomLevel || 1)*2*this.sequence.length+'px');
        this._Navigation._nav_pane_back.setAttribute('height','99%');
//        this._container.style.width = (this._zoomLevel || 1)*2*this.sequence.length+'px';
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
    
    if ( ! layer || ! group) {
        return;
    }
    
    if (layer && layer._group_controller) {
        return;
    }
    
    layer._group_controller = true;
    
    var expanded = false;
    var sticky = false;
    
    var self = this;
    
    layer._isExpanded = function() {
        return expanded;
    }
    
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
    
    if (this._Navigation)
        this._Navigation.clearTracks();

    for (var i = 0; i < this._track_order.length; i++ ) {
        if (! this.isLayerActive(this._track_order[i])) {
            this._layer_containers[this._track_order[i]].attr({ 'y' : (this._axis_height  + (track_heights - this._layer_containers[this._track_order[i]].track_height )/ this.zoom)*RS, 'height' :  RS * this._layer_containers[this._track_order[i]].track_height / this.zoom ,'display' : 'none' },animated);
            continue;
        } else {
            this._layer_containers[this._track_order[i]].attr({ 'opacity' : '1' });
        }

        if (this._layer_containers[this._track_order[i]].tracers) {
            var disp_style = (this.isLayerActive(this._track_order[i]) && (this.zoom > 3.6)) ? 'block' : 'none';
            this._layer_containers[this._track_order[i]].tracers.attr({'display' : disp_style , 'y' : (this._axis_height - 1.5)*RS,'height' : (1.5 + track_heights / this.zoom )*RS },animated);
        }

        if (this._layer_containers[this._track_order[i]].fixed_track_height) {
            var track_height = this._layer_containers[this._track_order[i]].fixed_track_height;
            this._layer_containers[this._track_order[i]].attr({ 'display' : 'block','y' : (this._axis_height + track_heights / this.zoom)*RS },animated);
            track_heights += this.zoom * (track_height) + this.trackGap;
        } else {
            this._layer_containers[this._track_order[i]].attr({ 'display': 'block', 'y' : (this._axis_height + track_heights / this.zoom )*RS, 'height' :  RS * this._layer_containers[this._track_order[i]].track_height / this.zoom },animated);
            if (this._Navigation) {
                this._Navigation.renderTrack(MASCP.getLayer(this._track_order[i]), (this._axis_height + track_heights / this.zoom )*RS , RS * this._layer_containers[this._track_order[i]].track_height / this.zoom );
            }
            track_heights += this._layer_containers[this._track_order[i]].track_height + this.trackGap;
        }

        this._layer_containers[this._track_order[i]].refresh_zoom();

    }

    var viewBox = [-1,0,0,0];
    viewBox[0] = -2*RS;
    viewBox[2] = (this.sequence.split('').length+(this.padding)+2)*RS;
    viewBox[3] = (this._axis_height + (track_heights / this.zoom)+ (this.padding))*RS;
    this._canvas.setAttribute('viewBox', viewBox.join(' '));
    this._canvas._canvas_height = viewBox[3];

    this._resizeContainer();

    viewBox[0] = 0;
//    viewBox[2] = '200';
    if (this._Navigation) {
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
var accessors = { 
    setZoom: function(zoomLevel) {
        if (zoomLevel < 0.5) {
            zoomLevel = 0.5;
        }
        if (zoomLevel > 10) {
            zoomLevel = 10;
        }
        var start_zoom = parseFloat(this._zoomLevel);

        this._zoomLevel = parseFloat(zoomLevel);
        if (this._canvas) {
            this._canvas.zoom = parseFloat(zoomLevel);
            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('zoomChange',false,true);
                this._canvas.dispatchEvent(evObj);
            } else {
                jQuery(this._canvas).trigger('zoomChange');
            }
        }
        jQuery(this).trigger('zoomChange');

        if (this._canvas && this.zoomCenter) {            
            var cx = this.zoomCenter.x;
            var viewBox = this._canvas.getAttribute('viewBox').split(' ');
            var end_zoom = this._zoomLevel;

            if (this._canvas.shiftPosition && (end_zoom - start_zoom) != 0) {
                var shift_pos = this._canvas.currentTranslate.x - (end_zoom - start_zoom)*2*this.sequence.length*(cx / parseFloat(viewBox[2]) );
                this._canvas.shiftPosition(shift_pos,0);
            }
        }
        
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
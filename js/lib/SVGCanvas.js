var SVGCanvas = SVGCanvas || (function() {
    
    var extended_elements = [];
    var DEFAULT_RS = 1;
    var svgns = 'http://www.w3.org/2000/svg';
    
    function extend_array(an_array,RS) {
        var curr_x, curr_y, curr_transform, targ_disp, a_disp;
        
        an_array.visibility = function() {
            var curr_disp = 'hidden';

            for (var i = 0 ; i < an_array.length; i++ ) {
                a_disp = an_array[i].getAttribute('visibility');
                if (a_disp && a_disp != 'hidden') {
                    curr_disp = a_disp;
                    break;
                }
            }
            return curr_disp;
        };
        
        an_array.currenty = function() {
            var a_y;
            
            if (an_array[0] && an_array[0].getAttribute('transform')) {
                a_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(an_array[0].getAttribute('transform'));
                if (typeof a_y != 'undefined') {
                    a_y = a_y[2];
                }
            }
            return an_array[0] ? parseInt( a_y || an_array[0].getAttribute('y') || 0,10) : 0;
        };
        
        an_array.animate = function(hsh) {
            if (typeof hsh.y == 'undefined') {
                attr(hsh);
                return;
            }
            if (an_array.length === 0) {
                return;
            }

            var hash = {};
            var key;
            
            for (key in hsh) {
                if (hsh.hasOwnProperty(key)) {
                    hash[key] = hsh[key];
                }
            }
            
            setup_anim_clocks();
                        
            if (an_array.animating) {
                for (var i = 0; i < (anim_clock_funcs || []).length; i++ ) {                    
                    if (anim_clock_funcs[i].target_set != an_array) {
                        continue;
                    }
                    an_array.animating = false;
                    anim_clock_funcs.splice(i,1);
                }
            }
            

            
            var curr_disp = an_array.visibility();

            var target_disp = hash.visibility;
            if (curr_disp == target_disp && target_disp == 'hidden') {
                attr(hsh);
                return;
            }

            var curr_y = an_array.currenty();

            if (isNaN(parseInt(curr_y,10))) {
                console.log("Have a NaN y value, skipping");
                return;
            }

            var target_y = parseInt(hash.y,10);

            delete hash.y;

            if (curr_disp == target_disp && target_disp == 'visible' ) {
                delete hash.visibility;
                target_disp = null;                    
                attr({'visibility' : 'visible'});
            }

            if (hash.visibility == 'hidden') {
                delete hash.visibility;
            }

            attr(hash);
            var counter = 0;

            if (target_y != curr_y) {
                var anim_steps = 1 * (Math.abs(parseInt(((target_y - curr_y)/(50*RS)),10)/rate) + 1);
                var diff = (target_y - curr_y) / anim_steps;
                hash.y = curr_y || 0;
                var orig_func = arguments.callee;
                an_array.animating = true;
                hash.y = curr_y + diff*1;
                
                anim_clock_funcs.push(
                    function(step) {
                        if (diff < 0 && (hash.y < target_y) ) {
                            hash.y = target_y;
                        }
                        if (diff > 0 && (hash.y > target_y) ) {
                            hash.y = target_y;
                        }
                        attr(hash);
                        counter += (step || 1);
                        if (hash.y != target_y) {
                            hash.y = curr_y + diff*(counter+1);
                            return;
                        }
                        an_array.animating = false;
                        if (target_disp) {
                            attr({'visibility' : target_disp});
                        }
                        anim_clock_funcs.splice(anim_clock_funcs.indexOf(arguments.callee),1);
                    }
                );
                anim_clock_funcs[anim_clock_funcs.length - 1].target_set = an_array;
            }
            return;
        };
        
        an_array.attr = function(hsh) {
            if (in_anim) {
                return this.animate(hsh);
            }
            return attr(hsh);
        };
        
        var attr = function(hsh) {
            var hash = {};
            var key;
            for (key in hsh) {
                if (hsh.hasOwnProperty(key)) {
                    hash[key] = hsh[key];
                }
            }
            
            var curr_disp = an_array.visibility();
            
            var targ_y = parseInt(hash.y,10);
            targ_disp = hash.visibility;
            
            for (key in hash) {
                if (hash.hasOwnProperty(key)) {
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
                        var has_translate = an_array[i].hasAttribute('transform') && (an_array[i].getAttribute('transform').indexOf('translate') >= 0);

                        if (key == 'height' && an_array[i].setHeight ) { //hasAttribute('transform') && ! an_array[i].no_scale) {
                            an_array[i].setHeight(hash[key]);
                        } else if  (! (has_translate && (key == 'y' || key == 'x'))) {
                            an_array[i].setAttribute(key, value);                        
                        }
                        if (key == 'y' && an_array[i].hasAttribute('d')) {
                            var curr_path = an_array[i].getAttribute('d');
                            var re = /M\s*([\d\.]+) ([\d\.]+)/;
                            curr_path = curr_path.replace(re,'');
                            if (isNaN(parseInt(value,10))) {
                                throw "Error "+key+" is "+hash[key];
                            }
                            an_array[i].setAttribute('d', 'M0 '+parseInt(value,10)+' '+curr_path);
                        }
                        if (key == 'y' && an_array[i].hasAttribute('cy')) {
                            an_array[i].setAttribute('cy', hash[key]);
                        }
                    
                    
                        if (key == 'y' && an_array[i].hasAttribute('transform')) {
                            curr_transform = an_array[i].getAttribute('transform');
                        
                            curr_x = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                            if (curr_x === null) {
                                continue;
                            }
                            curr_x = curr_x[1];
                            curr_transform = curr_transform.replace(/translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/,'translate('+curr_x+','+value+')');
                            an_array[i].setAttribute('transform',curr_transform);                        
                        }
                        if (key == 'x' && an_array[i].hasAttribute('transform')) {
                            curr_transform = an_array[i].getAttribute('transform');
                        
                            curr_y = /translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/.exec(an_array[i].getAttribute('transform'));
                            if (curr_y === null) {
                                continue;
                            }
                            curr_y = curr_y[2];
                            curr_transform = curr_transform.replace(/translate\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/,'translate('+value+','+curr_y+')');
                            an_array[i].setAttribute('transform',curr_transform);                        
                        }                    
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
                    if (an_array[i].ownerSVGElement.zoom > 3.5) {
                        an_array[i].setAttribute('display', 'inline');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }                        
                }
            
                if (an_array[i].zoom_level && an_array[i].zoom_level == 'summary') {
                    if (an_array[i].ownerSVGElement.zoom <= 3.5) {
                        an_array[i].setAttribute('display', 'inline');
                        an_array[i].setAttribute('opacity', 1);
                    } else {
                        an_array[i].setAttribute('display', 'none');                            
                    }
                }
            }
        };
        
        return an_array;
    }

    var anim_clock_funcs = null, in_anim = false;
    var anim_clock = null;
    var rate = 75;
    var new_rate = null;
    
    var setup_anim_clocks = function() {
        if (anim_clock_funcs === null) {
            anim_clock_funcs = [];
        } else {
            anim_clock_funcs.forEach(function(func) {
                func._last_step = null;
            });
            clearInterval(anim_clock);
        }
        if ( ! in_anim ) {
            extended_elements.forEach(function(canv) {
                jQuery(canv).trigger('_anim_begin');
            });
            in_anim = true;
        }
        var start = null;
        anim_clock = setInterval(function() {
            if ( ! anim_clock_funcs || anim_clock_funcs.length === 0 ) {
                clearInterval(anim_clock);
                anim_clock = null;
                anim_clock_funcs = null;
                in_anim = false;
                extended_elements.forEach(function(canv) {
                    jQuery(canv).trigger('_anim_end');
                });
                return;
            }
            
            var suspended_ids = [];
            
            extended_elements.forEach(function(canv) {
                suspended_ids.push(canv.suspendRedraw(5000));
            });
            var tic = (new Date()).getTime();
                                                
            if (! start) {
                start = (new Date()).getTime();
            }
            
            for (var i = 0; i < (anim_clock_funcs || []).length; i++ ) {
                var end = (new Date()).getTime();
                var step_id = parseInt((end - start)/rate,10);
                if ( new_rate === null && (step_id - anim_clock_funcs[i]._last_step) > 2) {
                    new_rate = Math.round(1.6*rate);
                }
                anim_clock_funcs[i].apply(null,[step_id - (anim_clock_funcs[i]._last_step || step_id)]);
                if (anim_clock_funcs && anim_clock_funcs[i]) {
                    anim_clock_funcs[i]._last_step = step_id;
                }
            }
            var toc = (new Date()).getTime();

            extended_elements.forEach(function(canv) {
                canv.unsuspendRedraw(suspended_ids.shift());
            });
            
            var actual_speed = (toc - tic);
            if (( actual_speed < rate) && (new_rate === null) && actual_speed >= 1 ) {
                rate = Math.round(1.5*(toc - tic));
                setup_anim_clocks();
            } else if (new_rate !== null && new_rate != rate) {
                rate = new_rate;
                setup_anim_clocks();
            }
            
            
        },rate);
    };
    var scale_re = /scale\((-?\d+\.?\d*)\)/;
    var setHeight = function(height) {
        var curr_transform = this.getAttribute('transform').toString();

        var curr_scale = scale_re.exec(curr_transform);
    
        var curr_height = parseFloat(this.getAttribute('height') || 1);

        var new_scale = 1;
        if (curr_scale === null) {
            curr_transform += ' scale(1) ';
            curr_scale = 1;
        } else {
            curr_scale = parseFloat(curr_scale[1]);
        }
        new_scale = ( parseFloat(height) / curr_height ) * curr_scale;

        curr_transform = curr_transform.replace(scale_re,'scale('+new_scale+')');

        this.setAttribute('transform',curr_transform);
        this.setAttribute('height',height);
        return new_scale;
    };

    return (function(canvas) {
        
        var RS = canvas.RS || DEFAULT_RS;
        canvas.RS = RS;
        canvas.font_order = 'Helvetica, Verdana, Arial, Sans-serif'
        extended_elements.push(canvas);
        
        canvas.makeEl = function(name,attributes) {
            var result = document.createElementNS(svgns,name);
            for (var attribute in attributes) {
                if (attributes.hasOwnProperty(attribute)) {
                    result.setAttribute(attribute, attributes[attribute]);
                }
            }
            return result;
        };

        canvas.make_gradient = function(id,x2,y2,stops,opacities) {
            var gradient = this.makeEl('linearGradient',{
                'id': id,
                'x1':'0%',
                'x2': x2,
                'y1':'0%',
                'y2': y2
            });
            var total_stops = stops.length;
            while(stops.length > 0) {
                var stop_id = Math.round( ((total_stops - stops.length) / total_stops) * 100 );
                var stop = stops.shift();
                var opacity = opacities.shift();
                gradient.appendChild(this.makeEl('stop',{
                    'offset': stop_id+'%',
                    'style':'stop-color:'+stop+';stop-opacity:'+opacity
                }));
            }
            return gradient;
        };


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
        };

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

        canvas.roundRect = function(x,y,width,height,r) {
            var a_rect = this.rect(x,y,width,height);
            if (typeof r != 'object' || ! r.x ) {
                r = { 'x' : r, 'y' : r };
            }
            a_rect.setAttribute('rx',r.x*RS);
            a_rect.setAttribute('ry',r.y*RS);
            return a_rect;
        };

        canvas.ellipticalRect = function(x,y,width,height) {
            return this.roundRect(x,y,width,height,{'x' : 0.25*width, 'y' : 0.5*height});
        };
        canvas.pentagon = function(x,y,width,height,rotate) {
            return this.nagon(x,y,width,height,5,rotate);
        }
        canvas.hexagon = function(x,y,width,height,rotate) {
            return this.nagon(x,y,width,height,6,rotate);
        }
        canvas.nagon = function(x,y,width,height,n,rotate) {
            var a = 0.5*width*RS;
            var shape = this.poly("");
            shape.setAttribute('transform','translate('+(x*RS)+','+(RS*y)+')');
            shape.setHeight = function(hght) {
                var b = 0.5*hght;
                var points = [];
                var min_x = null;
                var max_x = null;
                for (var i = 0 ; i < n; i++) {
                    var angle = (rotate/360 * 2*Math.PI) + 2/n*Math.PI*i;
                    var a_x = parseInt(a+a*Math.cos(angle));
                    var a_y = parseInt(b+b*Math.sin(angle));
                    points.push( [a_x, a_y] );
                    if (min_x === null || a_x < min_x ) {
                        min_x = a_x;
                    }
                    if (max_x === null || a_x > max_x) {
                        max_x = a_x;
                    }
                }
                points.map(function(points) {
                    if (points[0] == min_x) {
                        points[0] = 0;
                    }
                    if (points[0] == max_x) {
                        points[0] = (width)*RS;
                    }
                    return points.join(",");
                });
                this.setAttribute('points',points.join(" "));
            };
            shape.setHeight(height*RS);
            return shape;
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
        };

        canvas.svgbutton = function(x,y,width,height,txt) {
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

            var text = this.text(x+width/2,y+(height/3),txt);        
            text.setAttribute('text-anchor', 'middle');
            text.firstChild.setAttribute('dy', '1.5ex');
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

        canvas.callout = function(x,y,content,opts) {
            var callout = this.group();
            var back = this.roundRect(-0.5*(opts.width+4),20,opts.width+4,opts.height+4,4);
            back.setAttribute('fill','#000000');
            var pres_box = this.roundRect(-0.5*(opts.width+1),22,opts.width+1,opts.height,4);
            pres_box.setAttribute('fill','#eeeeee');
            callout.push(back);
            callout.push(pres_box);
            var poly = this.poly('0,500 500,1000 -500,1000');
            poly.setAttribute('fill','#000000');
            callout.push(poly);
            var fo = document.createElementNS(svgns,'foreignObject');
            fo.setAttribute('x',-0.5*(opts.width+1)*RS);
            fo.setAttribute('y',22*RS);
            fo.setAttribute('width',opts.width*RS);
            fo.setAttribute('height',opts.height*RS);
            callout.push(fo);
            var html = document.createElementNS('http://www.w3.org/1999/xhtml','html');
            html.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
            var body = document.createElementNS('http://www.w3.org/1999/xhtml','body');
            body.style.fontSize = (15*RS) +'px';
            body.style.margin = (5*RS)+'px';
            body.style.height = opts.height*RS*10+'px';
            html.appendChild(body);
            body.appendChild(content);
            fo.appendChild(html);
            callout.setAttribute('transform','translate('+(x*RS)+','+((y+20)*RS)+')');
            callout.setHeight = setHeight;
            if ( ! opts.align ) {
                var currVbox = parseFloat(this.getAttribute('viewBox').split(/\s+/)[2]);
                if (((x + 10) + 0.5*opts.width)*RS > currVbox ) {
                    opts.align = 'right';
                }
                if ((x - 0.5*opts.width)*RS < 0) {
                    opts.align = 'left';
                }
            }
            if (opts.align) {
                var shifter = opts.align == "right" ? -0.5 : 0.5;
                back.setAttribute('transform', 'translate('+(shifter*opts.width*RS)+',0)');
                pres_box.setAttribute('transform', 'translate('+(shifter*opts.width*RS)+',0)');
                poly.setAttribute('transform', 'translate('+(0*shifter*opts.width*RS)+',0)');
                poly.setAttribute('points', shifter > 0 ? "0,500 500,1000 0,1000" : "0,500 0,1000 -500,1000");
                fo.setAttribute('transform', 'translate('+(shifter*opts.width*RS)+',0)');
            }
            return callout;
        };

        canvas.growingMarker = function(x,y,symbol,opts) {
            var container = document.createElementNS(svgns,'svg');
            container.setAttribute('viewBox', '-50 -100 200 250');
            container.setAttribute('preserveAspectRatio', 'xMinYMin meet');
            container.setAttribute('x',x);
            container.setAttribute('y',y);
            var the_marker = this.marker(50/RS,(50)/RS,50/RS,symbol,opts);
            container.appendChild(the_marker);
            container.contentElement = the_marker.contentElement;
            var result = this.group();
            var positioning_group = this.group();
            result.appendChild(positioning_group);
            positioning_group.appendChild(container);
            container.setAttribute('width','200');
            container.setAttribute('height','250');
            result.setAttribute('height','250');
            result.setAttribute('transform','scale(1)');
            result.setHeight = function(height) {
                // this.setAttribute('height',height);
                var scale_val = setHeight.call(this,height);
                this.setAttribute('height',height);
                var top_offset = this.offset || 0;
                var widget_height = parseFloat(this.firstChild.firstChild.getAttribute('height'));
                if ( ! this.angle ) {
                    this.angle = 0;
                }
                if (this.angle > 10) {
                    centering_offset = 0;
                }
                if (top_offset == 0) {
                    centering_offset = 0;
                }
                this.firstChild.setAttribute('transform','translate(-100,'+(top_offset*RS)+') rotate('+this.angle+',100,0)');
            };
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
            if (! opts ) {
                opts = {};
            }
            var fill_color = (opts && opts.border) ? opts.border : 'rgb(0,0,0)';
            if ( ! opts.bare_element ) {
                marker.push(this.circle(0,-0.5*r,r));

                marker.lastChild.style.fill = fill_color;

                marker.push(this.circle(0,1.5*r,r));

                marker.lastChild.style.fill = fill_color;

                var arrow = this.poly((-0.9*r*RS)+','+(0*r*RS)+' 0,'+(-2.5*r*RS)+' '+(0.9)*r*RS+','+(0*r*RS));


                arrow.setAttribute('style','fill:'+fill_color+';stroke-width: 0;');
                marker.push(arrow);
            }
            marker.setAttribute('transform','translate('+((cx)*RS)+','+0.5*cy*RS+') scale(1)');
            marker.setHeight = setHeight;
            marker.setAttribute('height', dim.R*RS);
            if (typeof symbol == 'string') {
                marker.contentElement = this.text_circle(0,0.5*r,1.75*r,symbol,opts);
                marker.push(marker.contentElement);
            } else {
                marker.contentElement = this.group();
                if (! opts.bare_element ) {
                    marker.contentElement.push(this.text_circle(0,0.5*r,1.75*r,"",opts));
                }
                if (symbol) {
                    if ( ! opts.bare_element ) {
                        symbol.setAttribute('transform','translate(0,'+(0.5*r*RS)+')');
                    }
                    marker.contentElement.push(symbol);
                }
                marker.push(marker.contentElement);
            }
            return marker;
        };

        canvas.text_circle = function(cx,cy,r,txt,opts) {

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
            window.matchMedia('print').addListener(function(match) {
                back.setAttribute('fill',match.matches ? '#aaaaaa': 'url(#simple_gradient)');
            });
            back.setAttribute('stroke', opts.border || '#000000');
            back.setAttribute('stroke-width', (r/10)*RS);

            marker_group.push(back);
            var text = this.text(0,dim.CY-0.5*dim.R,txt);
            text.setAttribute('font-size',r*RS);
            text.setAttribute('font-weight','bolder');
            text.setAttribute('fill','#ffffff');
            text.setAttribute('style','font-family: sans-serif; text-anchor: middle;');
            text.firstChild.setAttribute('dy','1.5ex');
            text.setAttribute('text-anchor','middle');
            marker_group.push(text);

            marker_group.setAttribute('transform','translate('+dim.CX*RS+', 1) scale(1)');
            marker_group.setAttribute('height', (dim.R/2)*RS );
            marker_group.setHeight = setHeight;
            return marker_group;
        };

        canvas.crossed_circle = function(cx,cy,r) {

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
        canvas.text = function(x,y,text) {
            var a_text = document.createElementNS(svgns,'text');
            var a_tspan = document.createElementNS(svgns, 'tspan');
            if (typeof text != 'string') {
                a_text.appendChild(text);
            } else {
                a_text.appendChild(a_tspan);
                a_tspan.textContent = text;
                a_tspan.setAttribute('dy','0');
            }
            a_text.style.fontFamily = this.font_order || 'Helvetica, Verdana, Arial, Sans-serif';
            a_text.setAttribute('x',typeof x == 'string' ? x : x * RS);
            a_text.setAttribute('y',typeof y == 'string' ? y : y * RS);        
            this.appendChild(a_text);
            return a_text;
        };
        canvas.plus = function(x,y,height) {
            var g = this.group();
            g.appendChild(this.makeEl('rect', {
                'x' : Math.round((0.4)*height*RS).toString(),
                'y' : Math.round((0.1)*height*RS).toString(),
                'stroke-width' : '1',
                'width' : Math.round((0.2)*height*RS).toString(),
                'height': Math.round((0.8)*height*RS).toString(),
                'stroke': '#ffffff',
                'fill'  : '#ffffff'            
            }));

            g.appendChild(this.makeEl('rect', {
                'x' : Math.round((0.1)*height*RS).toString(),
                'y' : Math.round((0.4)*height*RS).toString(),
                'stroke-width' : '1',
                'width' : Math.round((0.8)*height*RS).toString(),
                'height': Math.round((0.2)*height*RS).toString(),
                'stroke': '#ffffff',
                'fill'  : '#ffffff'            
            }));
            g.setAttribute('transform','translate('+x*RS+','+y*RS+')');
            return g;
        };
        canvas.minus = function(x,y,height) {
            var g = this.group();

            g.appendChild(this.makeEl('rect', {
                'x' : Math.round((0.1)*height*RS).toString(),
                'y' : Math.round((0.4)*height*RS).toString(),
                'stroke-width' : '1',
                'width' : Math.round((0.8)*height*RS).toString(),
                'height': Math.round((0.2)*height*RS).toString(),
                'stroke': '#ffffff',
                'fill'  : '#ffffff'            
            }));
            g.setAttribute('transform','translate('+x*RS+','+y*RS+')');
            return g;
        };

        // Calculate the bounding box of an element with respect to its parent element
        // Thanks to http://stackoverflow.com/questions/10623809/get-bounding-box-of-element-accounting-for-its-transform
        canvas.transformedBoundingBox = function(el){
            var bb  = el.getBBox(),
                svg = el.ownerSVGElement,
                m   = el.getTransformToElement(el.parentNode);
            // Create an array of all four points for the original bounding box
            var pts = [
                svg.createSVGPoint(), svg.createSVGPoint(),
                svg.createSVGPoint(), svg.createSVGPoint()
            ];
            pts[0].x=bb.x;          pts[0].y=bb.y;
            pts[1].x=bb.x+bb.width; pts[1].y=bb.y;
            pts[2].x=bb.x+bb.width; pts[2].y=bb.y+bb.height;
            pts[3].x=bb.x;          pts[3].y=bb.y+bb.height;

            // Transform each into the space of the parent,
            // and calculate the min/max points from that.
            var xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
            pts.forEach(function(pt){
                pt = pt.matrixTransform(m);
                xMin = Math.min(xMin,pt.x);
                xMax = Math.max(xMax,pt.x);
                yMin = Math.min(yMin,pt.y);
                yMax = Math.max(yMax,pt.y);
            });

            // Update the bounding box with the new values
            bb.x = xMin; bb.width  = xMax-xMin;
            bb.y = yMin; bb.height = yMax-yMin;
            return bb;
        };
        
        canvas.set = function() {
            var an_array = [];
            extend_array(an_array,RS);
            return an_array;
        };
        canvas.hide = function() {
            this.setAttribute('display','none');
        };
        canvas.show = function() {
            this.setAttribute('display','inline');
        };
    });

})();
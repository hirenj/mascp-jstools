(function(win) {

var PieMenu = function() {

};

PieMenu.zoomIn = function(el,canvas,x,y) {
    var props = {
            "TransformOriginX" : canvas.RS*x + 'px',
            "TransformOriginY" : canvas.RS*y + 'px',
            "Transform" : 'scale(0)',
            "webkitTransition" : '-webkit-transform 0.2s',
            "mozTransition" : '-moz-transform 0.2s;',
            "transition" : 'transform 0.2s;'
        };
    for (var key in props) {
        if (key.match(/^[a-z]/)) {
            el.style[key] = props[key];
        }
        ["webkit","moz","ms",null].forEach(function(browser) {
            el.style[browser ? browser+key : (key.charAt(0).toLowerCase() + key.slice(1))] = props[key];
        });
    }
    setTimeout(function() {
        el.style.webkitTransform = '';
        el.style.msTransform = '';
        el.style.mozTransform = '';
        el.style.transform = '';
    },10);
};

var rational_tanh = function(x)
{
    if( x < -3 )
        return -1;
    else if( x > 3 )
        return 1;
    else
        return x * ( 27 + x * x ) / ( 27 + 9 * x * x );
};

PieMenu.create = function(canvas,x,y,contents,opts) {
    if (typeof canvas.supports_use == 'undefined') {
        (function() {
            canvas.supports_use = true;
            // var use = canvas.use('#sugar_glcnac',-1000,-1000,100,100);
            // setTimeout(function() {
            //     if (use.instanceRoot) {
            //         canvas.supports_use = true;
            //     } else {
            //         canvas.supports_use = false;
            //     }
            //     use.parentNode.removeChild(use);
            // },1000);
        })();
    }
    var i = 0;
    var center = { 'x' : x, 'y' : y };
    if ( ! opts ) {
        opts = {};
    }
    var radius = ("ontouchstart" in window) ? (3 * (opts.size || 10) / canvas.zoom) : (2 * (opts.size || 10) / canvas.zoom);
    var icon_size = (opts.size || 10) / canvas.zoom;
    if ("ontouchstart" in window) {
        icon_size *= 1.4;
    }
    var phase = contents ? (2 * Math.PI / contents.length) : 0;
    var menu = new PieMenu();
    var els = [];
    menu.container = canvas.group();
    if (window.MutationObserver || window.webkitMutationObserver || window.MozMutationObserver) {
        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type == "childList" && menu.container.nextSibling !== null) {
                    menu.container.parentNode.appendChild(menu.container);
                }
            });
        });
        observer.observe(canvas,{ childList : true });
        menu.observer = observer;
    }
    var last_target = null;
    var touch_dispatcher = function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var rpos = canvas.createSVGRect();
        var boundingRect = canvas.getBoundingClientRect();
        rpos.x = ev.touches[0].clientX - boundingRect.left;
        rpos.y = ev.touches[0].clientY - boundingRect.top;
        rpos.width = rpos.height = 1;
        var target;
        var list = canvas.getIntersectionList(rpos, null);
        for (var i = 0 ; ! target && i < list.length ; i++) {
            if (list[i].move_func) {
                target = list[i];
            }
        }
        if (! target) {
            return;
        }
        if (last_target !== null && target !== last_target) {
            if (last_target.moveout_func) {
                last_target.moveout_func();
            }
        }
        if (target.move_func) {
            target.move_func(ev);
            last_target = target;
        }
    };
    canvas.addEventListener('touchmove',touch_dispatcher,true);

    canvas.addEventListener('touchend',function(ev) {
        if (last_target && last_target.end_func) {
            last_target.end_func();
            ev.stopPropagation();
        }
        canvas.removeEventListener('touchmove',touch_dispatcher,true);
        canvas.removeEventListener('touchend',arguments.callee);
    },false);

    (contents || []).forEach(function(item) {
        var x_pos;
        var y_pos;
        x_pos = center.x + radius * Math.cos(i*phase);
        y_pos = center.y + radius * 1.3 * Math.sin(i*phase);
        if (opts.ellipse) {
            var content_diff = contents.length - 5;
            if (content_diff < 0) {
                content_diff = 0;
            }
            var rot =  -1*(Math.PI/3 + (7/18*Math.PI - Math.PI/3)*rational_tanh(content_diff*content_diff/100));
            var scale = 1 + (content_diff / 6);
            var scale_x = 1 + (content_diff / 15);
            x_pos = center.x + radius * scale_x * Math.cos(i*phase)*Math.cos(rot) - radius * scale * Math.sin(i*phase) * Math.sin(rot);
            y_pos = center.y + radius * scale_x * Math.cos(i*phase)*Math.sin(rot) + radius * scale * Math.sin(i*phase) * Math.cos(rot);
        }

        i++;
        var circ = canvas.circle(x_pos,y_pos,icon_size);
        circ.setAttribute('fill','#eed');
        circ.setAttribute('stroke','#eee');
        circ.setAttribute('stroke-width', 1.5 * canvas.RS / canvas.zoom );
        PieMenu.zoomIn(circ,canvas,x,y);
        els.push(circ);
        var symbol = item.symbol;
        if (typeof symbol == 'string') {
            if (symbol.match(/^#[0123456789ABCDEF]{3,6}$/) || symbol.match(/^url/)) {
                circ.setAttribute('fill',symbol);
            } else if (symbol.match(/^(:?https?:)?\/?.*#/)) {
                if (false && ! canvas.supports_use ) {
                    item.text = item.text_alt || item.symbol;
                } else {
                    var g = canvas.group();
                    var next_g = canvas.group();
                    g.push(next_g);
                    var use = canvas.use(symbol,0,0,100,100);
                    var icon_scale = 0.8;
                    next_g.setAttribute('transform','translate('+(((x_pos-icon_scale*icon_size)*canvas.RS))+','+((y_pos-icon_scale*icon_size)*canvas.RS)+') scale('+(icon_scale*icon_size)+')');
                    next_g.push(use);
                    g.setAttribute('pointer-events','none');
                    els.push(g);
                }
            } else {
                symbol = canvas.text_circle(x_pos,y_pos,icon_size,symbol);
                var g = canvas.group();
                g.push(symbol);
                els.push(g);
                g.setAttribute('pointer-events','none');
            }
        } else if (symbol) {
            var g = canvas.group();
            var next_g = canvas.group();
            next_g.setAttribute('transform','translate('+(((x_pos)*canvas.RS))+','+((y_pos)*canvas.RS)+') scale('+(0.75*icon_size)+')');
            next_g.push(symbol);
            g.push(next_g);
            els.push(g);
            g.setAttribute('pointer-events','none');
        }

        if (item.text) {
            symbol = canvas.text_circle(x_pos,y_pos,0.8*icon_size,item.text,{"stretch" : (x_pos > (center.x + icon_size)) ? 'right' : ((Math.abs(x_pos - center.x) < icon_size ) ? true : 'left'), 'weight' : 'normal', 'fill' : '#000'});
            var g = canvas.group();
            g.push(symbol);
            els.push(g);
            g.setAttribute('pointer-events','none');
            circ.setAttribute('opacity','0.5');
        }

        circ.move_func = function(ev) {
            this.setAttribute('stroke','#0f0');
            if (item.hover_function) {
                item.hover_function();
            }
            ev.stopPropagation();
        };
        circ.end_func = function(ev) {
            if (item.select_function) {
                item.select_function();
            }
        };
        circ.moveout_func = function(ev) {
            this.setAttribute('stroke','#eee');
        };
        circ.addEventListener('mouseover',circ.move_func,true);
        circ.addEventListener('mouseup',circ.end_func);
        circ.addEventListener('mouseout',circ.moveout_func);
    });
    menu.elements = els;
    menu.elements.forEach(function(el) {
        PieMenu.zoomIn(el,canvas,x,y);
        menu.container.push(el);
    });
    return menu;
};


PieMenu.prototype.destroy = function() {
    var self = this;
    if (this.elements) {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.elements.forEach(function(el) {
            if (el.setAttribute) {
                el.setAttribute('pointer-events','none');
            }
            if (el.style) {
                var style_dec = 'scale(0)';
                el.style.webkitTransform = style_dec;
                el.style.msTransform = style_dec;
                el.style.mozTransform = style_dec;
                el.style.transform = style_dec;
            }
            setTimeout(function() {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            },750);
        });
        this.elements = [];
    }
    setTimeout(function() {
        if (self.container && self.container.parentNode) {
            self.container.parentNode.removeChild(self.container);
        }
    },1000);
};

win.PieMenu = PieMenu;

})(window);
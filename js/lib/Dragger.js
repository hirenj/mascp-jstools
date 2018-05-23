/**
 *  @fileOverview   Basic classes and defitions for a Gene Ontology ID based map
 */

import '../hammer.js';
import bean from '../bean';

/**
 * @class       State class for adding panning functionality to an element. Each element that is to be panned needs a new instance
 *              of the Dragger to store state.
 * @author      hjjoshi
 * @requires    svgweb
 */
const Dragger = function() {
  this.oX = 0;
  this.oY = 0;
  this.dX = 0;
  this.dY = 0;
  this.dragging = false;
  this.targetElement = null;
};

/**
 * Connect this dragger to a particular element. If an SVG element is given, panning occurs within the bounding box of the SVG, and
 * the image is shifted by using the currentTranslate property. If a regular HTML element is given, the scrollLeft and scrollTop attributes
 * are used to move the viewport around. 
 * @param {Element} targetElement Element to enable panning upon.
 */
Dragger.prototype.applyToElement = function(targetElement,enabled) {
    var self = this;
    if (typeof enabled !== 'undefined') {
        self.enabled = enabled;        
    }
    
    var momentum = [];

    if (targetElement.nodeName == 'svg') {
        targetElement.getPosition = function() {
            var translate = targetElement.currentTranslateCache || targetElement.currentTranslate;
            var dX = translate.x;
            var dY = translate.y;

            return [dX, dY];
        };
        
        targetElement.shiftPosition = function(x,y) {
            var p = {'x' : x, 'y' : y };
            var viewBoxScale = 1;
            var vbox = this.getAttribute('viewBox');

            var min_x,min_y,width,height;

            if (vbox) {
                var viewBox = this.getAttribute('viewBox').split(' ');
                viewBoxScale = parseFloat(this.width.baseVal.value) / parseFloat(viewBox[2]);
                min_x = 0;
                min_y = parseInt(viewBox[1],10);
                width = parseInt(viewBox[2],10);
                height = parseInt(viewBox[3],10);
            } else {
                min_x = 0;
                min_y = 0;
                width = targetElement.width;
                height = targetElement.height;
            }

            if (targetElement.style.GomapScrollLeftMargin) {
                min_x += targetElement.style.GomapScrollLeftMargin;
            }
            
            if ( self.dragging ) {
                p.x = viewBoxScale*(p.x - self.oX);
                p.y = viewBoxScale*(p.y - self.oY);

                p.x += self.dX;
                p.y += self.dY;
                p.y = 0;
            }

            if (targetElement._snapback) {
                clearTimeout(targetElement._snapback);
                targetElement._snapback = null;
            }
            
            if (p.x > viewBoxScale * min_x && self.enabled) {
                /* Element has shifted too far to the right
                   Induce some gravity towards the left side
                   of the screen
                */

                let do_snapback = function() {
                    var evObj;
                    var translate = targetElement.currentTranslateCache || targetElement.currentTranslate;
                    if (Math.abs(translate.x - (viewBoxScale * min_x)) > 35 ) {
                        var new_pos = 0.95*(translate.x - (viewBoxScale * min_x));
                        if (new_pos < (viewBoxScale * min_x)) {
                            new_pos = (viewBoxScale * min_x);
                        }
                        
                        targetElement.setCurrentTranslateXY( new_pos, 0);
                        window.requestAnimationFrame(do_snapback, targetElement);
//                        targetElement._snapback = setTimeout(arguments.callee,10);
                        if (document.createEvent) {
                            var evObj = document.createEvent('Events');
                            evObj.initEvent('panstart',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                    } else {
                        targetElement.setCurrentTranslateXY( (viewBoxScale * min_x), 0 );
                        if (document.createEvent) {
                            var evObj = document.createEvent('Events');
                            evObj.initEvent('pan',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                        if (! self.dragging) {
                            bean.fire(targetElement,'panend');
                        }
                        targetElement._snapback = null;
                    }
                };
                targetElement._snapback = setTimeout(do_snapback,300);
            }
            
            var min_val = viewBoxScale * ( width - 2 * min_x );
            
            if (min_x === 0) {
                min_val *= 0.90;
            }
            if (p.x < 0 && Math.abs(p.x) > min_val && self.enabled) {
                /* Element has shifted too far to the left
                   Induce some gravity to the right side of the screen
                */
                let do_snapback = function() {
                    var evObj;
                    var translate = targetElement.currentTranslateCache || targetElement.currentTranslate;
                    if (Math.abs(translate.x - (-1 * min_val)) > 35 ) {
                        var new_pos = 0.95*(translate.x);
                        if (new_pos > (-1*min_val)) {
                            new_pos = -1*min_val;
                        }
                        targetElement.setCurrentTranslateXY( new_pos, 0);
                        window.requestAnimationFrame(do_snapback, targetElement);
//                        targetElement._snapback = setTimeout(arguments.callee,10);
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('panstart',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                    } else {
                        targetElement.setCurrentTranslateXY( -1*min_val, 0);                        
                        if (document.createEvent) {
                            evObj = document.createEvent('Events');
                            evObj.initEvent('pan',false,true);
                            targetElement.dispatchEvent(evObj);
                        }
                        if (! self.dragging) {
                            bean.fire(targetElement,'panend');
                        }
                        targetElement._snapback = null;
                    }
                };
                targetElement._snapback = setTimeout(do_snapback,300);
            }

            if (p.y > viewBoxScale * min_y) {
                p.y = viewBoxScale * min_y;
            }
            if (Math.abs(p.y) > 0.50*viewBoxScale * height ) {
                p.y = -0.50 * viewBoxScale * height;
            }
            if (this.setCurrentTranslateXY) {
                this.setCurrentTranslateXY(p.x,p.y);
            } else if (this.currentTranslate.setXY) {
                this.currentTranslate.setXY(p.x,p.y);
            } else {
                this.currentTranslate.x = p.x;
                this.currentTranslate.y = p.y;          
            }            

            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('pan',false,true);
                this.dispatchEvent(evObj);
            }
        };
    } else {
        targetElement.getPosition = function() {
            return [this.scrollLeft, this.scrollTop];
        };
        targetElement.shiftPosition = function(x,y) {
            this.scrollLeft = self.dX + (self.oX - x);
            this.scrollTop = self.dY + (self.oY - y);

            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('pan',false,true);
                this.dispatchEvent(evObj);
            }
        };
    }

    var stationary;

    var svgMouseDown = function(evt) {
      if ( ! self.enabled ) {
          return true;
      }

      var targ = self.targetElement ? self.targetElement : targetElement;
      var positions = mousePosition(evt);
      self.dragging = true;
      self.moved = false;
      targ.setAttribute('dragging','true');

      if (self.targetElement) {

          self.oX = positions[0];
          self.oY = positions[1];
          self.dX = self.targetElement.scrollLeft;
          self.dY = self.targetElement.scrollTop;
          evt.preventDefault(true);
          return;
      }

      var p = targetElement.createSVGPoint();
      positions = mousePosition(evt);
      p.x = positions[0];
      p.y = positions[1];

      var rootCTM = this.firstElementChild.getScreenCTM();
      self.matrix = rootCTM.inverse();
      
      p = p.matrixTransform(self.matrix);

      self.dX = targetElement.getPosition()[0];
      self.dY = targetElement.getPosition()[1];

      self.oX = p.x;
      self.oY = p.y;

      evt.preventDefault(true);
      
      if (document.createEvent) {
          self.clicktimeout = setTimeout(function() {
              var evObj = document.createEvent('Events');
              self.clicktimeout = null;
              evObj.initEvent('panstart',false,true);
              targ.dispatchEvent(evObj);
          },200);
      }

    };
    
    var mousePosition = function(evt) {
        var posx = 0;
        var posy = 0;
        if (!evt) {
            evt = window.event;
        }
        if (evt.pageX || evt.pageY)     {
            posx = evt.pageX;
            posy = evt.pageY;
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
    
    var mouseMove = function(evt) {
        var positions = mousePosition(evt);
        if (self.clicktimeout && Math.abs(positions[0] - self.oX) < 10 ) {
            mouseUp();
        }
        if (!self.dragging) {
           return;
        }

        targetElement.shiftPosition(positions[0],positions[1]);
        
        evt.preventDefault(true);
    };
    
    var mouseDown = function(evt) {
        self.dragging = true;
        self.moved = false;
        var positions = mousePosition(evt);
        self.oX = positions[0];
        self.oY = positions[1];
        self.dX = targetElement.getPosition()[0];
        self.dY = targetElement.getPosition()[1];
        evt.preventDefault(true);
        var targ = self.targetElement ? self.targetElement : targetElement;
        targ.setAttribute('dragging','true');
        if (document.createEvent) {
            var evObj = document.createEvent('Events');
            evObj.initEvent('panstart',false,true);
            targ.dispatchEvent(evObj);
        }
    };
    
    var svgMouseMove = function(evt) {
        if (!self.enabled) {
            return true;
        }
        // this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/openhand_8_8.cur), move';
        if (!self.dragging) {
            return;
        }

        // if (stationary) {
        //     clearTimeout(stationary);
        //     stationary = null;
        // }
        // 
        // stationary = window.setTimeout(function() {
        //     self.dragging = false;
        // },200);        
        
        doMouseMove.call(this,evt);
    };

    var doMouseMove = function(evt) {        
        var positions = mousePosition(evt);
        // this.style.cursor = 'url(http://maps.gstatic.com/intl/en_us/mapfiles/closedhand_8_8.cur), -moz-grabbing';

        if (self.targetElement) {
            self.targetElement.shiftPosition(positions[0],positions[1]);
            self.moved = true;
            return;
        }

        
        var p = targetElement._cachedpoint || targetElement.createSVGPoint();
        targetElement._cachedpoint = p;
        
        positions = mousePosition(evt);

        p.x = positions[0];
        p.y = positions[1];

        var rootCTM = targetElement._cachedrctm || targetElement.firstElementChild.getScreenCTM();
        targetElement._cachedrctm = rootCTM;
        
        p = p.matrixTransform(self.matrix);
        targetElement.shiftPosition(p.x,p.y);
        self.moved = true;
//        momentum = p.x;        
    };

    var captureClick = function(evt) {
       evt.stopPropagation();
       this.removeEventListener('click', captureClick, true);
    };

    var mouseUp = function(evt) { 
      if (self.clicktimeout) {
          clearTimeout(self.clicktimeout);
          self.clicktimeout = null;
      }
      if ( ! self.enabled ) {
          return true;
      }
      self.oX = 0;
      self.oY = 0;
      self.dX = null;
      self.dY = null;
      self.dragging = false;
      evt.preventDefault(true);
      
      var targ = self.targetElement ? self.targetElement : targetElement;      

      targ.removeAttribute('dragging');
      
      if (! targ._snapback) {
        bean.fire(targ,'panend',true);
      }

      if (evt.type == 'mouseup' && self.moved) {
        targ.addEventListener('click',captureClick,true);
      }
      self.moved = false;

    };

    var mouseOut = function(e) {
        if (!self.dragging || ! self.enabled) {
            return true;
        }
        if (this == self.targetElement) {
            mouseUp(e);
        }
        
        
        if ( e.target != this && ! e.currentTarget ) {
            return;
        }

        var toTarget = e.relatedTarget ? e.relatedTarget : e.toElement;
        
        while (toTarget !== null) {
            if (toTarget == this) {
                return;
            }
            toTarget = toTarget.parentNode;
        }
        mouseUp(e);
    };
        
    
    if ( ! targetElement.addEventListener) {
        targetElement.addEventListener = function(name,func,bool) {
            this.attachEvent(name,func);
        };
    }
    
    targetElement.addEventListener('touchstart',function(e) {
        if ( ! self.enabled ) {
            return;
        }
        var targ = self.targetElement ? self.targetElement : targetElement;
        if (self.momentum) {
            window.clearTimeout(self.momentum);
            self.momentum = null;
        }
        if (e.touches.length == 1) {
            var positions = mousePosition(e.touches[0]);
            var p;
            if (targ.nodeName == 'svg') {
                p = targ.createSVGPoint();
                p.x = positions[0];
                p.y = positions[1];
                var rootCTM = this.getScreenCTM();
                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
            } else {
                p.x = positions[0];
                p.y = positions[1];
            }
            self.oX = p.x;
            self.oY = p.y;
            
            self.dragging = true;
            self.dX = targ.getPosition()[0];
            self.dY = targ.getPosition()[1];
            
            self._momentum_shrinker = setInterval(function() {
                momentum.shift();
            },20);
            if (document.createEvent) {
                var evObj = document.createEvent('Events');
                evObj.initEvent('panstart',false,true);
                targ.dispatchEvent(evObj);
            }
            e.preventDefault();
        }
    },false);


    // document.addEventListener('touchmove',function(e) {
    //     console.log('touchmove for the document');
    //     console.log(self.dragging);
    //     if ( ! self.dragging ) {
    //         return;
    //     }
    //     console.log("Ending the drag for document move");
    //     self.oX = 0;
    //     self.oY = 0;
    //     self.dX = null;
    //     self.dY = null;
    //     self.dragging = false;
    // 
    //     var targ = self.targetElement ? self.targetElement : targetElement;      
    // 
    //     if (document.createEvent) {
    //         var evObj = document.createEvent('Events');
    //         evObj.initEvent('panend',false,true);
    //         targ.dispatchEvent(evObj);
    //     }      
    // },false);

    targetElement.addEventListener('touchmove',function(e) {
        if (self.drag_zoom) {
            return;
        }
        if (self.momentum) {
            window.clearTimeout(self.momentum);
            self.momentum = null;
        }

        if (e.touches.length != 1) {
            self.dragging = false;
        }

        var targ = self.targetElement ? self.targetElement : targetElement;

        var positions = mousePosition(e.touches[0]);

        if (! positions || ! self.matrix) {
            return;
        }

        var p;
        if (targ.nodeName == 'svg') {
            p = targ.createSVGPoint();
            p.x = positions[0];
            p.y = positions[1];
            p = p.matrixTransform(self.matrix);
        } else {
            p.x = positions[0];
            p.y = positions[1];
        }
        
        if (self.dragging && ((6*Math.abs(self.oX - p.x)) > Math.abs(self.oY - p.y))) {
            // FIXME - PASSIVE
            // e.preventDefault();
        }

        if (!self.dragging) {
            self.oX = 0;
            self.oY = 0;
            self.dX = null;
            self.dY = null;
            return;
        }
        if (momentum.length > 3) {
            momentum.splice(2);
        }
        targ.shiftPosition(p.x,p.y);
        momentum.push(targ.getPosition()[0] - self.dX);
    },{passive:true});
    // FIXME - PASSIVE
    
    var momentum_func = function(e) {
        if ( ! self.enabled ) {
            return true;
        }
        if ( ! self.dragging ) {
            clearInterval(self._momentum_shrinker);
            mouseUp(e);
            return;
        }
        var targ = self.targetElement ? self.targetElement : targetElement;
        var delta = 0;
        
        if (momentum.length > 0) {
            var last_val = momentum[0];
            momentum.forEach(function(m) {
                if ((typeof last_val) != 'undefined') {
                    delta += m - last_val;
                }
                last_val = m;
            });
            delta = delta / momentum.length;
        }
        var start = targ.getPosition()[0];
        var start_delta = delta;
        self.dragging = false;
        if (self.momentum) {
            window.clearTimeout(self.momentum);
        }
        self.momentum = 1;
        let moment = (function() {
            start = targ.getPosition()[0];
            if (self.dragging) {
                start += self.oX - self.dX;
            } else {
                self.oX = 0;
                self.dX = 0;
            }
            targ.shiftPosition(start+delta,0);
            start = start+delta;
            delta = delta * 0.5;
            
            if (delta > 0 && Math.abs(start_delta / delta) < 10) {
                window.requestAnimationFrame(moment, targ);
//                window.setTimeout(arguments.callee,50);
            } else {
                self.momentum = null;
                clearInterval(self._momentum_shrinker);
                mouseUp(e);
            }
        });

        moment();
    };
    
    targetElement.addEventListener('touchend',momentum_func,false);


    if (targetElement.nodeName == 'svg') {
        targetElement.addEventListener('mousedown', svgMouseDown, false);
        targetElement.addEventListener('mousemove', svgMouseMove, false);        
        targetElement.addEventListener('mouseup',mouseUp,false);
        targetElement.addEventListener('mouseout',mouseOut, false); 
        if (self.targetElement) {
            self.targetElement.addEventListener('mouseout',mouseOut,false);
        }
        // targetElement.addEventListener('click',function(ev) { ev.preventDefault(); ev.stopPropagation(); },false);
    } else {
        targetElement.addEventListener('mousedown', mouseDown, false);
        targetElement.addEventListener('mousemove', mouseMove, false);        
        targetElement.addEventListener('mouseup', mouseUp, false);        
        targetElement.addEventListener('mouseout',mouseOut, false);
    }

};


Dragger.addTouchZoomControls = function(zoomElement,touchElement,controller) {
    if ( ! controller ) {
        controller = {"enabled" : true};
    }
    Dragger.prototype.addTouchZoomControls.call(controller,zoomElement,touchElement);
    return controller;
};

Dragger.prototype.addTouchZoomControls = function(zoomElement,touchElement) {
    var self = this;
    var last_touch_start = null;
    var xform = null;
    var max_y = null;
    var mousePosition = function(evt) {
        var posx = 0;
        var posy = 0;
        if (!evt) {
            evt = window.event;
        }
        if (evt.pageX || evt.pageY)     {
            posx = evt.pageX;
            posy = evt.pageY;
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

    var drag_zoom_move = function(evt) {
        if ( ! self.enabled || ! self.drag_zoom ) {
            return;
        }
        if (evt.touches.length == 1) {
            var positions = mousePosition(evt.touches[0]);
            var p = {};
            p.x = positions[0];
            p.y = positions[1];

            if (touchElement.nodeName == 'svg') {
                p = touchElement.createSVGPoint();
                p.x = positions[0];
                p.y = positions[1];
                p = p.matrixTransform(xform);
            }
            zoomElement.zoom = self.zoom_start * Math.pow(10, (p.y - zoomElement.zoomCenter.y)/max_y );
        }
    };

    var drag_zoom_end = function(evt) {
        touchElement.removeEventListener('touchmove',drag_zoom_move);
        touchElement.removeEventListener('touchend',drag_zoom_end);
        self.drag_zoom = false;
    };

    touchElement.addEventListener('touchstart',function(e) {
        if ( ! self.enabled ) {
            return;
        }
        if (e.touches.length == 1) {
            if ((new Date().getTime() - last_touch_start) <= 300) {
                self.drag_zoom = true;
                self.zoom_start = zoomElement.zoom;

                var positions = mousePosition(e.touches[0]);
                var positions2 = mousePosition(e.touches[0]);
                var p;
                if (touchElement.nodeName == 'svg') {
                    p = touchElement.createSVGPoint();
                    p.x = 0.5*(positions[0] + positions2[0]);
                    p.y = 0.5*(positions[1] + positions2[1]);
                    var rootCTM = this.getScreenCTM();
                    xform = rootCTM.inverse();
                    p = p.matrixTransform(xform);
                    max_y = parseInt(touchElement.getAttribute('viewBox').split(' ')[3]);
                } else {
                    p.x = 0.5*(positions[0] + positions2[0]);
                    p.y = 0.5*(positions[1] + positions2[1]);
                }
                zoomElement.zoomCenter = p;
                touchElement.addEventListener('touchmove',drag_zoom_move,{passive:true});
                touchElement.addEventListener('touchend',drag_zoom_end,false);
                e.preventDefault();
                return;
            }

            last_touch_start = (new Date()).getTime();
            return;
        }
        if (e.touches.length == 2) {
            var positions = mousePosition(e.touches[0]);
            var positions2 = mousePosition(e.touches[1]);
            var p;
            if (touchElement.nodeName == 'svg') {
                p = touchElement.createSVGPoint();
                p.x = 0.5*(positions[0] + positions2[0]);
                p.y = 0.5*(positions[1] + positions2[1]);
                var rootCTM = this.getScreenCTM();
                self.matrix = rootCTM.inverse();
                p = p.matrixTransform(self.matrix);
            } else {
                p.x = 0.5*(positions[0] + positions2[0]);
                p.y = 0.5*(positions[1] + positions2[1]);
            }
            zoomElement.zoomCenter = p;  
            e.preventDefault();
        }
    },false);


    // touchElement.addEventListener('gesturestart',function(e) {
    Hammer(touchElement).on("touch",function(e) {
        if ( ! self.enabled ) {
            return;
        }
        // zoomElement.zoomLeft = null;
        var zoomStart = zoomElement.zoom;

        var zoomscale = function(ev) {
            if ( zoomElement.zoomCenter ) {
                zoomElement.zoom = zoomStart * ev.gesture.scale;
            }
            ev.preventDefault();
        };
        Hammer(touchElement).on('pinch',zoomscale,false);
        let hammer_release = function(ev) {
            Hammer(touchElement).off('pinch',zoomscale);
            Hammer(touchElement).off('release',hammer_release);
            zoomElement.zoomCenter = null;
            zoomElement.zoomLeft = null;
            bean.fire(zoomElement,'gestureend')
        };
        Hammer(touchElement).on('release',hammer_release,false);
        e.preventDefault();
    },false);

};

/**
 * Given an element that implements a zoom attribute, creates a div that contains controls for controlling the zoom attribute. The
 * zoomElement must have a zoom attribute, and can fire the zoomChange event whenever the zoom value is changed on the object. The
 * scrollwheel is connected to this element so that when the mouse hovers over the controls, it can control the zoom using only
 * the scroll wheel.
 * @param {Object} zoomElement Element to control the zooming for.
 * @param {Number} min Minimum value for the zoom attribute (default 0)
 * @param {Number} max Maximum value for the zoom attribute (default 10)
 * @param {Number} precision Step precision for the zoom control (default 0.5)
 * @param {Number} value Default value for this control
 * @returns DIV element containing the controls
 * @type Element
 * @see GOMap.Diagram#event:zoomChange
 */
Dragger.addZoomControls = function(zoomElement,min,max,precision,value) {
    min = min || 0;
    max = max || 10;
    precision = precision || 0.5;
    value = value || zoomElement.zoom || min; 
    
    var controls_container = document.createElement('div');
    
    var zoomIn = document.createElement('input');
    zoomIn.setAttribute('type','button');
    zoomIn.setAttribute('value','+');
    var zoomOut = document.createElement('input');
    zoomOut.setAttribute('type','button');
    zoomOut.setAttribute('value','-');
    var reset = document.createElement('input');
    reset.setAttribute('type','button');
    reset.setAttribute('value','Reset');

    controls_container.appendChild(reset);    

    reset.addEventListener('click',function() {
        zoomElement.zoom = zoomElement.defaultZoom || value;
    },false);
    
    var range = document.createElement('input');
    range.setAttribute('min',min);
    range.setAttribute('max',max);
    range.setAttribute('step',precision);
    range.setAttribute('value',value); 
    range.setAttribute('type','range');
    range.setAttribute('style','-webkit-appearance: slider-horizontal; width: 100%; position: absolute; top: 0px; bottom: 0px; margin-top: 0.5em; left: 100%; margin-left: -0.5em;');

    if (range.type == 'range') {
        
        range.addEventListener('change',function() {
            zoomElement.zoom = this.value;
        },false);
        
        var evFunction = null;
        if (zoomElement.addEventListener) {
            evFunction = zoomElement.addEventListener;
        } else if (zoomElement.bind){
            evFunction = zoomElement.bind;
        }
        
        evFunction.apply(zoomElement,['zoomChange',function() {
            range.value = zoomElement.zoom;
        },false]);
        

        reset.style.margin = '0px';
        reset.style.display = 'block';
        reset.style.position = 'absolute';
        reset.style.top = '0px';
        
        controls_container.appendChild(range);
        controls_container.style.height = '100%';
    } else {
        if (! zoomIn.addEventListener) {
            var addevlis = function(name,func) {
                this.attachEvent(name,func);
            };
            zoomIn.addEventListener = addevlis;
            reset.addEventListener = addevlis;
            zoomOut.addEventListener = addevlis;        
        }
        zoomIn.addEventListener('click',function() {
            zoomElement.zoom += precision;
        },false);
        zoomOut.addEventListener('click',function() {
            zoomElement.zoom -= precision;
        },false);

        zoomIn.style.margin = '0px';
        zoomIn.style.display = 'block';
        zoomIn.style.position = 'absolute';
        zoomIn.style.top = '0px';
        zoomIn.style.left = '29px';

        zoomOut.style.margin = '0px';
        zoomOut.style.display = 'block';
        zoomOut.style.position = 'absolute';
        zoomOut.style.top = '0px';

        reset.style.margin = '0px';
        reset.style.display = 'block';
        reset.style.position = 'absolute';
        reset.style.top = '23px';
        reset.style.left = '3px';

        controls_container.appendChild(zoomOut);
        controls_container.appendChild(zoomIn);
        controls_container.appendChild(reset);
    }

    this.addScrollZoomControls(zoomElement,controls_container,precision);

    return controls_container;
};

Dragger.addScrollBar = function(target,controlElement,scrollContainer) {
    return;
    var scroller = document.createElement('div');
    while (scrollContainer.childNodes.length > 0) {
        scrollContainer.removeChild(scrollContainer.firstChild);
    }
    scrollContainer.appendChild(scroller);
    if ( ! scrollContainer.style.position ) {
        scrollContainer.style.position = 'relative';
    }
    scrollContainer.style.overflowX = 'scroll';
    scrollContainer.style.overflowY = 'hidden';

    scroller.style.position = 'absolute';
    scroller.style.left = '0px';
    scroller.style.width = '100%';
    scroller.style.height= '100%';

    bean.remove(scrollContainer,'scroll');
    bean.remove(scrollContainer,'mouseenter');
    bean.add(scrollContainer,'mouseenter',function() {
        var size = 100*target.getTotalLength() / (target.getVisibleLength());
        scroller.cached_width = scroller.clientWidth / size;
        disabled = true;
        scrollContainer.scrollLeft += 1;
        scrollContainer.scrollLeft -= 1;
        setTimeout(function() {
            disabled = false;
        },0);
        bean.remove(scrollContainer,'scroll',scroll_func);
        bean.add(scrollContainer,'scroll',scroll_func);
    });
    var disabled = false;

    if (window.matchMedia) {
        window.matchMedia('print').addListener(function(matcher) {
            disabled = true;
            setTimeout(function() {
                disabled = false;
            },0);
        });
    }
    var scroll_func = function() {
        if (disabled || ! console) {
            return;
        }
        if (document.createEvent) {
            var evObj = document.createEvent('Events');
            evObj.initEvent('panstart',false,true);
            controlElement.dispatchEvent(evObj);
        }
        var size = 100*target.getTotalLength() / (target.getVisibleLength());
        var width = scroller.cached_width ? parseInt(scroller.cached_width * size) : scroller.clientWidth ;
        target.setLeftPosition(parseInt(scrollContainer.scrollLeft * target.getTotalLength() / width));
        bean.fire(controlElement,'panend');
    };

    bean.add(scrollContainer,'scroll',scroll_func);

    var left_setter;

    bean.add(controlElement,'pan',function() {
        cancelAnimationFrame(left_setter);
        var size = 100*target.getTotalLength() / (target.getVisibleLength());
        scroller.style.width = parseInt(size)+'%';
        var width = scroller.cached_width ? parseInt(scroller.cached_width * size) : scroller.clientWidth ;
        scroller.cached_width = width / size;

        var left_shift = parseInt(width * (target.getLeftPosition() / target.getTotalLength() ));
        bean.remove(scrollContainer,'scroll',scroll_func);
        left_setter = requestAnimationFrame(function() {
            // Rendering bottleneck
            scrollContainer.scrollLeft = left_shift;
        });
    });
};

/**
 * Connect the scroll wheel to the controls to control zoom
 */
Dragger.addScrollZoomControls = function(target,controlElement,precision) {
    precision = precision || 0.5;
    var self;

    if (this.enabled === null ) {
        self = {'enabled' : true };
    } else {
        self = this;
    }
    var hookEvent = function(element, eventName, callback) {
      if (typeof(element) == 'string') {
        element = document.getElementById(element);
      }

      if (element === null) {
        return;
      }

      if (element.addEventListener) {
        if (eventName == 'mousewheel') {
          element.addEventListener('DOMMouseScroll', callback, false);  
          element.addEventListener('wheel', callback, false);
        }
        element.addEventListener(eventName, callback, false);
      } else if (element.attachEvent) {
        element.attachEvent("on" + eventName, callback);
      }
    };


    var mousePosition = function(evt) {
          if ( ! self.enabled ) {
            return;
          }
          var posx = 0;
          var posy = 0;
          if (!evt) {
              evt = window.event;
          }
          if (evt.pageX || evt.pageY)   {
              posx = evt.pageX;
              posy = evt.pageY;
          } else if (evt.clientX || evt.clientY)    {
              posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
              posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
          }

          var p = {};

          if (controlElement.nodeName == 'svg') {
              p = controlElement.createSVGPoint();
              p.x = posx;
              p.y = posy;
              /* Fix for mouse position in firefox - http://jsfiddle.net/JNKgR/6/ */
              var rootCTM = controlElement.firstElementChild.getScreenCTM();
              self.matrix = rootCTM.inverse();
              p = p.matrixTransform(self.matrix);
          } else {
              p.x = posx;
              p.y = posy;
          }
          return p;
    };

    var mouseWheel = function(e) {
      if ( ! self.enabled ) {
        return;
      }
      e = e ? e : window.event;
      var wheelData = e.detail ? e.detail * -1 : e.wheelDelta;
      if ( ! wheelData ) {
        wheelData = e.deltaY;
      }
      target.zoomCenter = mousePosition(e);

      if (wheelData > 0) {
        target.zoom = target.zoom += precision;
      } else {
        target.zoom = target.zoom -= precision;
      }
      
      
      if (e.preventDefault) {
        e.preventDefault();
      }

      e.returnValue = false;
      e.stopPropagation();

      return false;
    };

    var isFF = false;

    if (navigator.userAgent.indexOf('Gecko') >= 0) {
      isFF = parseFloat(navigator.userAgent.split('Firefox/')[1]) || undefined;
    }                         

    if (isFF && (typeof svgweb != 'undefined')&& svgweb.getHandlerType() == 'native') {
      hookEvent(controlElement, 'mousewheel',
                mouseWheel);
    } else {
      hookEvent(controlElement, 'mousewheel', mouseWheel);
    }

    hookEvent(controlElement,'mousemove', function(e) {
        if (! self.enabled ) {
            return;
        }
        if (target.zoomCenter && Math.abs(target.zoomCenter.x - mousePosition(e).x) > 100) {
            target.zoomCenter = null;
            target.zoomLeft = null;
        }
    });

    return self;
};

export default Dragger;

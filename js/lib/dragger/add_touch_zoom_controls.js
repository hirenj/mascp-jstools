import bean from '../../bean';
import Hammer from 'hammerjs';

const addTouchZoomControls = function(zoomElement,touchElement,precision) {
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
            zoomElement.zoom = self.zoom_start * 10 * precision * Math.pow(10, (p.y - zoomElement.zoomCenter.y)/max_y );
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


    const hammerel = Hammer(touchElement);
    hammerel.get('pinch').set({ enable: true });

    // touchElement.addEventListener('gesturestart',function(e) {
    hammerel.on('pinchstart',function(e) {
        if ( ! self.enabled ) {
            return;
        }
        // zoomElement.zoomLeft = null;
        var zoomStart = zoomElement.zoom;

        var zoomscale = function(ev) {
            if ( zoomElement.zoomCenter ) {
                zoomElement.zoom = zoomStart * ev.scale;
            }
            ev.preventDefault();
        };
        hammerel.on('pinch',zoomscale,false);
        let hammer_release = function(ev) {
            hammerel.off('pinch',zoomscale);
            hammerel.off('pinchend',hammer_release);
            zoomElement.zoomCenter = null;
            zoomElement.zoomLeft = null;
            bean.fire(zoomElement,'gestureend')
        };
        hammerel.on('pinchend',hammer_release,false);
        e.preventDefault();
    },false);

};

export default addTouchZoomControls;
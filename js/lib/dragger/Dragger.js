/**
 *  @fileOverview   Basic classes and defitions for a Gene Ontology ID based map
 */

import bean from '../../bean';

import addTouchZoomControls from './add_touch_zoom_controls';
import addScrollZoomControls from './add_scroll_zoom_controls';
import applyToElement from './apply_to_element';


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
Dragger.prototype.applyToElement = applyToElement;

Dragger.addTouchZoomControls = function(zoomElement,touchElement,controller) {
    if ( ! controller ) {
        controller = {"enabled" : true};
    }
    Dragger.prototype.addTouchZoomControls.call(controller,zoomElement,touchElement);
    return controller;
};

Dragger.prototype.addTouchZoomControls = addTouchZoomControls;

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
Dragger.addScrollZoomControls = addScrollZoomControls;
export default Dragger;

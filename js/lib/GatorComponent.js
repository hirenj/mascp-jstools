
console.log('Here');

import Dragger from './Dragger';
import CondensedSequenceRenderer from './CondensedSequenceRenderer';
import Service from './Service';
import MASCP from './MASCP';

class DraggableRenderer extends CondensedSequenceRenderer {
  constructor(container) {
    super(container);
  }
  getVisibleLength() {
    return this.rightVisibleResidue() - this.leftVisibleResidue();
  }
  getTotalLength() {
    return this.sequence.length;
  }
  getLeftPosition() {
    return this.leftVisibleResidue();
  }
  setLeftPosition(pos) {
    return this.setLeftVisibleResidue(pos);
  }
}

const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
  }
  :host([resizeable]) {
    resize: both;
    overflow: auto;
    padding-right: 5px;
    padding-bottom: 5px;
  }
  #container, .widget_contents {
    width: 100%;
    height: 100%;
  }
  #container {
  }
</style>
<div class="widget_contents" >
  <div id="container">
  </div>
</div>
`;

const interactive_symb = Symbol('interactive');

class InteractiveState {
  constructor(component) {
    this.component = component;
  }
  get enabled() {
    return this.component.interactive;
  }
  set enabled(toggle) {
    this.component.interactive = toggle;
  }
}

class ComponentDragger extends Dragger {
  constructor(component) {
    super();
    this.component = component;
  }
  get enabled() {
    return this.component.interactive;
  }
  set enabled(toggle) {
    this.component.interactive = toggle;
  }
}

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

if (window.ShadyCSS) {
  ShadyCSS.prepareTemplate(tmpl, 'x-protviewer');
}

let setup_renderer = function(renderer) {
  renderer.font_order = 'Helvetica, Arial, sans-serif';
  renderer.zoom = 0.81;
  renderer.padding = 10;
  renderer.trackOrder = [];
  renderer.reset();
  renderer.trackGap = 6;
  renderer.trackHeight = 5;
  renderer.fixedFontScale = 1;
};

let create_renderer = function(container){
  let renderer = new DraggableRenderer(container);
  setup_renderer(renderer);
  wire_renderer_sequence_change.call(this,renderer);
  return renderer;
};

let try_import_symbols = (renderer,namespace,url) => {
  Service.request(url,function(err,doc) {
    if (doc) {
      renderer.importIcons(namespace,doc.documentElement,url);
    }
  },"xml");
};

let zoom_to_fit = (renderer) => {
  let zoomFactor = 0.95 * renderer._container.parentNode.clientWidth / (2 * renderer.sequence.length);
  renderer.zoom = zoomFactor;
};

let make_draggable = function(renderer,dragger) {
  dragger.applyToElement(renderer._canvas);
  dragger.addTouchZoomControls(renderer, renderer._canvas,this[interactive_symb]);
  Dragger.addScrollZoomControls.call(this[interactive_symb],renderer, renderer._canvas,0.1);
};

let wire_renderer_sequence_change = function(renderer) {
  var dragger = new ComponentDragger(this);
  let seq_change_func = () => {
    try_import_symbols(renderer, "ui", "https://glycodomain.glycomics.ku.dk/icons.svg");
    try_import_symbols(renderer, "sugar", "https://glycodomain.glycomics.ku.dk/sugars.svg");
    zoom_to_fit(renderer);
    
    make_draggable.call(this,renderer,dragger);
    setup_renderer(renderer);
    renderer.navigation.show();
    renderer.refresh();
  };

  renderer.bind('sequenceChange', seq_change_func);

};


class GatorComponent extends WrapHTML {

  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();
  }


  attributeChangedCallback(name) {
  }

  connectedCallback() {
    if (window.ShadyCSS) {
      ShadyCSS.styleElement(this);
    }
    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));
    this[interactive_symb] = new InteractiveState(this);
    this.renderer = create_renderer.call(this,shadowRoot.getElementById('container'));
    this.renderer.grow_container = true;
    if ( window.getComputedStyle(this).height && window.getComputedStyle(this).height != '0px' ) {
      this.renderer.grow_container = false;
      if (window.getComputedStyle(this).getPropertyValue('--fill-viewer')) {
        this.renderer.fixed_size = true;
      }
    }
  }
  fitToZoom() {
    zoom_to_fit(this.renderer);
  }
  createTrack(track) {
    MASCP.registerLayer(track,{'fullname' : track},[this.renderer]);
    this.renderer.trackOrder = this.renderer.trackOrder.concat([track]);
    this.renderer.showLayer(track);
    this.renderer.refresh();
  }

  get interactive() {
    return this.hasAttribute('interactive');
  }
  set interactive(toggle) {
    if (toggle) {
      debugger;
      this.setAttribute('interactive','');
    } else {
      this.removeAttribute('interactive');
    }
  }
}

customElements.define('x-protviewer',GatorComponent);

export default GatorComponent;
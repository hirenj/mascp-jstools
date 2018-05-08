
import Dragger from './Dragger';
import CondensedSequenceRenderer from './CondensedSequenceRenderer';
import Service from './Service';
import MASCP from './MASCP';

const component_symbol = Symbol('component');

class DraggableRenderer extends CondensedSequenceRenderer {
  constructor(container,component) {
    super(container);
    this[component_symbol] = component;
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

  get selecting() {
    return this[component_symbol].selecting;
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
<slot></slot>
`;

const interactive_symb = Symbol('interactive');

class InteractiveState {
  constructor(component) {
    this.component = component;
  }
  get enabled() {
    return this.component.interactive && ! this.component.selecting;
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
    return this.component.interactive && ! this.component.selecting;
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
  let renderer = new DraggableRenderer(container,this);
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
  renderer.fitZoom();
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
    populate_tracks.call(this);
    setup_renderer(renderer);
    renderer.navigation.show();
    renderer.refresh();
  };
  renderer.bind('sequenceChange', seq_change_func);
};

let populate_tracks = function() {
  for (let track of this.querySelectorAll('x-gatortrack')) {
    this.createTrack(track);
  }
}

let wire_selection_change = function(renderer) {
  renderer.bind('selection', (selections) => {
    let positions = selections.get(renderer);
    if ( ! positions[0] && ! positions[1] ) {
      this.removeAttribute('selected')
    } else {
      this.setAttribute('selected',`${positions[0]}:${positions[1]}`);
    }
    for (let track of this.querySelectorAll('x-gatortrack')) {
      let positions = selections.get(track.layer);
      if ( ! positions[0] && ! positions[1] ) {
        track.removeAttribute('selected')
      } else {
        track.setAttribute('selected',`${positions[0]}:${positions[1]}`);
      }
    }
  });
}


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
    if ( window.getComputedStyle(this).height && window.getComputedStyle(this).height !== '0px' && window.getComputedStyle(this).height !== 'auto' ) {
      this.renderer.grow_container = false;
      if (window.getComputedStyle(this).getPropertyValue('--fill-viewer')) {
        this.renderer.fixed_size = true;
      }
    }
    wire_selection_change.call(this,this.renderer);
  }

  fitToZoom() {
    zoom_to_fit(this.renderer);
  }

  createTrack(track) {
    MASCP.registerLayer(track.name,{},[this.renderer]);
    this.renderer.trackOrder = this.renderer.trackOrder.concat([track.name]);
    this.renderer.showLayer(track.name);
    this.renderer.refresh();
  }

  refreshTracks() {
    populate_tracks.call(this);
  }

  get selecting() {
    return this.hasAttribute('selecting');
  }

  set selecting(toggle) {
    if (toggle) {
      this.setAttribute('selecting','');
    } else {
      this.removeAttribute('selecting');
    }
  }


  get interactive() {
    return this.hasAttribute('interactive');
  }

  set interactive(toggle) {
    if (toggle) {
      this.setAttribute('interactive','');
    } else {
      this.removeAttribute('interactive');
    }
  }
}

customElements.define('x-protviewer',GatorComponent);

export default GatorComponent;
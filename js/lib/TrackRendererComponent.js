
import GatorComponent from './GatorComponent';
import JSandbox from '../jsandbox';
import MASCP from './MASCP';

const SANDBOXES = new Map();

let retrieve_renderer = function() {
  let renderer_url = this.getAttribute('src');
  return fetch(renderer_url)
  .then( dat => dat.text() );
};

function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);

let get_renderer_sequence = (renderer,accession) => {
  return new Promise( resolve => {
  (function() {
    var obj = ({ "gotResult" : function() {
      resolve(renderer.sequence);
    }, "acc" : accession });
    renderer.trigger('readerRegistered',[obj]);
    obj.gotResult();
  })();
  });
};

let set_basic_offset = (objects,basic_offset) => {
  objects.forEach(function(obj) {
    if (obj.options) {
      if (obj.options.offset) {
        obj.options.offset += basic_offset;
        return;
      }
      obj.options.offset = basic_offset;
    } else {
      obj.options = { "offset" : basic_offset };
    }
  });
};

let apply_rendering = (renderer,default_track,objects) => {
  if ( Array.isArray(objects) ) {
    var temp_objects = {}
    console.log('No accession provided');
    temp_objects['DEFAULTACC'] = objects;
    objects = temp_objects;
  }
  for (let acc of Object.keys(objects)) {
    let r = objects[acc];
    set_basic_offset(r,0);

    renderer.renderObjects(default_track,r.filter( function(item) {
      return ! item.track;
    }));

    var items_by_track = {};
    r.filter( function(item) {
      return item.track;
    }).forEach(function(item) {
      items_by_track[item.track] = items_by_track[item.track] || [];
      items_by_track[item.track].push(item);
    });
    Object.keys(items_by_track).forEach(function(track) {
      if (MASCP.getLayer(track)) {
        MASCP.registerLayer(track,{},[renderer]);
        // We force a refresh of the track order
        // to pick up any layers that have been re-enabled
        renderer.trackOrder = renderer.trackOrder;
        renderer.renderObjects(track,items_by_track[track]);
      }
    });
    renderer.trigger('resultsRendered',[this]);
    renderer.refresh();
  }
};

let do_rendering = (renderer,script,data,default_track) => {
  const SANDBOX = SANDBOXES.get(script) || new JSandbox();
  SANDBOXES.set(script,SANDBOX);
  get_renderer_sequence(renderer)
  .then( sequence => {
    SANDBOX.eval(script, () => {
      SANDBOX.eval({ 'data' : 'renderData(input.sequence,input.data,input.acc,input.track)',
                  'input' : { 'sequence' : sequence, 'data' : data, 'track' : default_track },
                  'onerror': message => { throw new Error(message) },
                  'callback' : apply_rendering.bind(null,renderer,default_track)
                 });
    });
  });
};

class TrackRendererComponent extends WrapHTML  {
  static get observedAttributes() {
    return ['track'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    this.script = retrieve_renderer.call(this);
  }

  render(renderer,data,track) {
    this.script
    .then (script => {
      do_rendering(renderer,script,data,track);
    });
  }

  get data() {
    return this._data;
  }

  set data(data) {
    this._data = data;
    this.render(this.ownerDocument.getElementById(this.getAttribute('renderer')).renderer,this._data,this.getAttribute('track'));
  }

  attributeChangedCallback(name) {
    if (this.hasAttribute('renderer') && this.data) {
      this.render(document.getElementById(this.getAttribute('renderer')).renderer,this._data,this.getAttribute('track'));
    }
  }
}

customElements.define('x-trackrenderer',TrackRendererComponent);

let create_track = function() {
  MASCP.registerLayer(this.name,{});
  MASCP.getLayer(this.name).fullname = this.fullname || this.name;
  MASCP.getLayer(this.name).scales.clear();
  for (let scale of this.scale) {
    MASCP.getLayer(this.name).scales.add(scale);
  }
};

class TrackComponent extends WrapHTML  {
  static get observedAttributes() {
    return ['name','fullname','scale'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    create_track.call(this);
  }

  get name() {
    return this.getAttribute('name');
  }

  set name(name) {
    return this.setAttribute('name',name);
  }

  get layer() {
    return MASCP.getLayer(this.name);
  }

  get fullname() {
    return this.getAttribute('fullname');
  }

  set fullname(name) {
    return this.setAttribute('fullname',name);
  }

  get scale() {
    return (this.getAttribute('scale') || '').split(',');
  }

  set scale(scale) {
    return this.setAttribute('scale',scale);
  }


  attributeChangedCallback(name) {
    create_track.call(this);
  }
}

customElements.define('x-gatortrack',TrackComponent);

export default TrackRendererComponent;
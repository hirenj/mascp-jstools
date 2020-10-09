
import GatorComponent from './GatorComponent';
import JSandbox from '../jsandbox';
import MASCP from './MASCP';

import {CondensedIupac, Sugar, Monosaccharide, SugarAwareLayoutFishEye, SVGRenderer} from 'glycan.js';

const Iupac = CondensedIupac.IO;

const IupacSugar = Iupac(Sugar);


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

const max_sizes_map = new WeakMap();
const rendered_sugars_map = new WeakMap();

let ensure_sugar_icon = (renderer,sequence) => {
  if ( renderer._container_canvas.getElementById('sugar_'+sequence.toLowerCase()) ) {
    return;
  }
  let defs_block = renderer._container_canvas.getElementById('defs_sugar');
  SugarAwareLayoutFishEye.LINKS = false;
  let sugar_renderer = new SVGRenderer(defs_block,SugarAwareLayoutFishEye);
  let sug = new IupacSugar();
  sug.sequence = sequence;
  sugar_renderer.element.canvas.setAttribute('id','sugar_'+sequence.toLowerCase());
  sugar_renderer.addSugar(sug);
  sugar_renderer.icon_prefix = 'sugar';
  sugar_renderer.refresh().then( () => {
    let a_use = document.createElementNS('http://www.w3.org/2000/svg','use');
    a_use.setAttributeNS('http://www.w3.org/1999/xlink','href','#sugar_'+sequence.toLowerCase());
    a_use.style.visibility = 'hidden';
    renderer._container_canvas.appendChild(a_use);
    sugar_renderer.element.canvas.getBBox = () => {
      return a_use.getBBox();
    };
    sugar_renderer.scaleToFit({ side: 1, top: 0 });
    a_use.parentNode.removeChild(a_use);
    sugar_renderer.element.canvas.setAttribute('preserveAspectRatio','xMidYMax meet');
    let rendered_sugars = rendered_sugars_map.get(renderer) || [];

    rendered_sugars.push(sugar_renderer.element.canvas);
    rendered_sugars_map.set(renderer, rendered_sugars);

    let [minx,miny,width,height] = sugar_renderer.element.canvas.getAttribute('viewBox').split(' ').map( dim => parseInt(dim) );
    let max_size = max_sizes_map.get(renderer) || {width: 0, height: 0};
    if (width < max_size.width) {
      minx -= (max_size.width - width)/2;
      width = max_size.width;
    }
    if (height < max_size.height) {
      miny -= (max_size.height - height);
      height = max_size.height;
    }
    for (let svgbox of rendered_sugars) {
      svgbox.setAttribute('viewBox',`${minx} ${miny} ${width} ${height}`);
    }
    max_size.width = width;
    max_size.height = height;
    max_sizes_map.set(renderer,max_size);
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

let apply_rendering = function(renderer,default_track,objects) {
  ensure_sugar_icon(renderer,'NeuAc(a2-3)Gal(b1-3)GalNAc');
  ensure_sugar_icon(renderer,'Gal(b1-3)GalNAc');
  ensure_sugar_icon(renderer,'Man(a1-3)[Man(a1-6)]Man(b1-4)GlcNAc(b1-4)GlcNAc');
  if ( Array.isArray(objects) ) {
    var temp_objects = {}
    console.log('No accession provided');
    temp_objects['DEFAULTACC'] = objects;
    objects = temp_objects;
  }
  for (let acc of Object.keys(objects)) {
    let r = objects[acc];
    set_basic_offset(r,0);

    if ( ! this.visible_items ) {
      this.visible_items = {};
    }
    
    let on_default_track = r.filter( item => ! item.track );
    let on_specific_track = r.filter( item => item.track );

    renderer.renderObjects(default_track,on_default_track);

    if ( ! this.visible_items[default_track]) {
      this.visible_items[default_track] = {};
    }
    r.filter( r => r.type === 'marker' ).forEach(item => {
      let target_track = item.track ? item.track : default_track;
      this.visible_items[target_track][item.aa] = this.visible_items[target_track][item.aa] || [];
      if (item.is_stack && Array.isArray(item.options.content)) {
        item.options.content.forEach( stack_item => {
          this.visible_items[target_track][item.aa].push(stack_item);
        });
      } else if (item.options.start && item.options.end) {
        let {start,end,content,count} = item.options;
        this.visible_items[target_track][item.aa].push({ start,end, content, count });
      } else {
        this.visible_items[target_track][item.aa].push(item.options.content);
      }
    });

    let items_by_track = {};

    on_specific_track.forEach( item => {
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

let do_rendering = function(renderer,script,data,default_track) {
  const SANDBOX = SANDBOXES.get(script) || new JSandbox();
  SANDBOXES.set(script,SANDBOX);
  get_renderer_sequence(renderer)
  .then( sequence => {
    SANDBOX.eval(script, () => {
      SANDBOX.eval({ 'data' : 'renderData(input.sequence,input.data,input.acc,input.track)',
                  'input' : { 'sequence' : sequence, 'data' : data, 'track' : default_track },
                  'onerror': message => { throw new Error(message) },
                  'callback' : apply_rendering.bind(this,renderer,default_track)
                 });
    });
  });
};

class TrackRendererComponent extends WrapHTML  {
  static get observedAttributes() {
    return ['track','src'];
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
      do_rendering.call(this,renderer,script,data,track);
    });
  }

  get data() {
    return this._data;
  }

  set data(data) {
    this._data = data;
    if ( ! data ) {
      this.ownerDocument.getElementById(this.getAttribute('renderer')).renderer.removeTrack(MASCP.getLayer(this.getAttribute('track')));
    }
    this.render(this.ownerDocument.getElementById(this.getAttribute('renderer')).renderer,this._data,this.getAttribute('track'));
  }

  attributeChangedCallback(name) {
    if (this.hasAttribute('renderer') && this.data && name === 'track') {
      this.render(document.getElementById(this.getAttribute('renderer')).renderer,this._data,this.getAttribute('track'));
    }
    if (name === 'src') {
      this.script = retrieve_renderer.call(this);
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
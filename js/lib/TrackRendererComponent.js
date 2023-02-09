
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
  const icon_prefix = 'sugarrendered';
  if ( renderer._container_canvas.getElementById(`${icon_prefix}_`+sequence.toLowerCase()) ) {
    return;
  }
  let defs_block = renderer._container_canvas.getElementById('defs_sugar');
  SugarAwareLayoutFishEye.LINKS = false;
  let sugar_renderer = new SVGRenderer(defs_block,SugarAwareLayoutFishEye);
  let sug = new IupacSugar();
  sug.sequence = sequence;
  sugar_renderer.element.canvas.setAttribute('id',`${icon_prefix}_`+sequence.toLowerCase());
  sugar_renderer.addSugar(sug);
  sugar_renderer.icon_prefix = 'sugar';
  sugar_renderer.refresh().then( () => {
    let a_use = document.createElementNS('http://www.w3.org/2000/svg','use');
    a_use.setAttributeNS('http://www.w3.org/1999/xlink','href',`#${icon_prefix}_`+sequence.toLowerCase());
    a_use.style.visibility = 'hidden';
    renderer._container_canvas.appendChild(a_use);
    sugar_renderer.element.canvas.getBBox = () => {
      return a_use.getBBox();
    };
    sugar_renderer.scaleToFit({ side: 0, top: 0 });
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

const uuidv4 = function() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}


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
  if ( ! renderer._container_canvas) {
    return;
  }
  ensure_sugar_icon(renderer,'NeuAc(a2-3)Gal(b1-3)GalNAc');
  ensure_sugar_icon(renderer,'GalNAc');
  ensure_sugar_icon(renderer,'GlcNAc');
  ensure_sugar_icon(renderer,'Fuc');
  ensure_sugar_icon(renderer,'Man');
  ensure_sugar_icon(renderer,'Xyl');
  ensure_sugar_icon(renderer,'Gal(b1-3)GalNAc');
  ensure_sugar_icon(renderer,'Man(a1-3)[Man(a1-6)]Man(b1-4)GlcNAc(b1-4)GlcNAc');
  if ( Array.isArray(objects) ) {
    var temp_objects = {}
    temp_objects['DEFAULTACC'] = objects;
    objects = temp_objects;
  }

  this.visible_items = {};

  for (let acc of Object.keys(objects)) {
    let r = objects[acc];
    set_basic_offset(r,this.offset);

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
    let evObj = new Event('rendered', {bubbles: true, cancelable: true});
    this.dispatchEvent(evObj);
  }
};

let do_native_rendering = async function(renderer,func,data,default_track) {
  let sequence = await this.getSequence(renderer);
  return apply_rendering.bind(this,renderer,default_track)( func(sequence,data,default_track) );
};

let do_rendering = function(renderer,script,data,default_track) {
  if ( ! script ) {
    return;
  }
  if (typeof script === 'function') {
    return do_native_rendering.call(this,renderer,script,data,default_track);
  }
  const SANDBOX = SANDBOXES.get(script) || new JSandbox();
  SANDBOXES.set(script,SANDBOX);
  this.getSequence(renderer)
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

class TrackRendererComponent extends WrapHTML {
  static get observedAttributes() {
    return ['track','renderer'];
  }

  constructor() {
    super();
    this._sequenceChangeCallback = () => {
      this.visible_items = {};
    }
  }

  get script() {
    return new Promise(resolve => {
      resolve(this._script);
    })
  }

  set script(script) {
    if (script.name !== 'renderData') {
      console.log('Function name should be renderData for script in TrackRendererComponent');
    }
    this._script = script;
  }

  get offset() {
    return parseInt(this.getAttribute('offset') || 0);
  }

  set offset(offset) {
    this.setAttribute('offset',offset);
  }

  get data() {
    return this._data;
  }

  get track() {
    let trackname = this.getAttribute('track');
    if (trackname) {
      return trackname;
    }
    let child_track = this.querySelector(':scope > x-gatortrack');
    trackname = child_track.name;
    return trackname;
  }

  get renderer() {
    if ( this._renderer ) {
      let component = this.ownerDocument.getElementById(this._renderer);
      if (component) {
        return component.renderer;
      }
    }
  }

  set data(data) {
    this._data = data;
    if ( ! data ) {
      this.renderer.removeTrack(MASCP.getLayer(this.track));
    }
    this.render(this.renderer,this._data,this.track);
  }

  async getSequence(renderer) {
    if (this.hasAttribute('accession')) {
      return get_renderer_sequence(renderer,this.getAttribute('accession'));
    }
    return get_renderer_sequence(renderer);
  }

  async render(renderer,data,track) {
    let script = await this.script;
    if (renderer) {
      renderer.bind('sequenceChange',this._sequenceChangeCallback);
    }
    do_rendering.call(this,renderer,script,data,track);
  }

  attributeChangedCallback(name) {
    if (name === 'renderer') {
      let last_renderer = this.renderer;
      if ( last_renderer ) {
        last_renderer.unbind('sequenceChange', this._sequenceChangeCallback );
      }
      this._renderer =  this.getAttribute('renderer');
    }
    if (this.renderer && this.data && name === 'track') {
      this.render(this.renderer,this._data,this.getAttribute('track'));
    }
  }

}

class TrackRendererScriptComponent extends TrackRendererComponent  {
  static get observedAttributes() {
    let super_attributes = super.observedAttributes;
    return super_attributes.concat(['src']);
  }

  connectedCallback() {
    this.retrieved_script = retrieve_renderer.call(this);
  }

  get script() {
    return this.retrieved_script;
  }

  set script(script) {
    console.log('Seting script not supported');
    return;
  }

  attributeChangedCallback(name) {
    super.attributeChangedCallback(name);

    if (name === 'src') {
      this.retrieved_script = retrieve_renderer.call(this);
    }
  }
}

customElements.define('x-trackrenderer',TrackRendererScriptComponent);

customElements.define('x-js-trackrenderer',TrackRendererComponent);


let create_track = function() {
  MASCP.registerLayer(this.name,{});
  MASCP.getLayer(this.name).fullname = this.fullname || this.name;
  MASCP.getLayer(this.name).scales.clear();
  for (let scale of this.scale) {
    MASCP.getLayer(this.name).scales.add(scale);
  }
};

const track_name_symbol = Symbol('track_name');

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
    let track_name = this.getAttribute('name');
    if ( track_name ) {
      return track_name
    }
    if ( ! this[track_name_symbol] ) {      
      this[track_name_symbol] = uuidv4();
    }
    track_name = this[track_name_symbol];
    return track_name;
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

export {TrackRendererComponent, TrackComponent};

export default TrackRendererScriptComponent;
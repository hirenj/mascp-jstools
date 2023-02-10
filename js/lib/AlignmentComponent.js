
import ClustalRunner from './ClustalRunner';


class ClustalRunnerPrecomputed extends ClustalRunner {
    constructor(alignments) {
      super();
      this._alignments = alignments;
    }

    get sequences() {
      return this._alignments.data.original_sequences.map( (seq,idx) => { return {  agi: this._alignments.data.ids[idx], toString: () => seq }} );
    }

    retrieve() {
      this._dataReceived(this._alignments);
      this.gotResult();
      this.requestComplete();
    };
}

const read_alignment = async function(url) {
  let data = await fetch(url);
  let json = await data.json();
  this._alignments = json;
};

const setup_alignments = function(alignments) {
  let parent_component = this.parentNode;
  let renderer = parent_component.renderer;
  let runner = new ClustalRunnerPrecomputed(alignments);

  let has_sequence = new Promise(resolve => {
    renderer.bind('sequenceChange',resolve);
  });

  runner.registerSequenceRenderer(renderer);
  let retval = new Promise( resolve => {
    runner.bind('requestComplete', resolve );
  });
  runner.retrieve();
  retval.then( () => {
    if ( !this.hasAttribute('discontinuities') ) {
      runner.result.disableDiscontinuities();
    }
    let evObj = new Event('ready', {bubbles: true, cancelable: true});
    this.dispatchEvent(evObj);
  });
  return retval.then(() => has_sequence);
};

const setup_tracks = function() {
  if ( ! this._alignments ) {
    return;
  }

  let template_el = this.firstElementChild;
  if (!(template_el instanceof HTMLTemplateElement)) {
    let html_content = template_el.innerHTML;
    template_el = document.createElement('template');
    template_el.innerHTML = html_content; 
  }

  if ( ! this._template ) {
    this._template = template_el;
  }

  for (let id of this._alignments.data.ids ) {
    let new_tracks = this._template.content.cloneNode(true);
    for (let renderer of new_tracks.querySelectorAll('x-trackrenderer')) {
      if (renderer.hasAttribute('track')) {
        renderer.setAttribute('track', id);
      }
      renderer.setAttribute('accession',id);
    }
    for (let jsrenderer of new_tracks.querySelectorAll('x-js-trackrenderer')) {
      if (jsrenderer.hasAttribute('track')) {
        jsrenderer.setAttribute('track', id);
      }
      jsrenderer.setAttribute('accession',id);
    }
    for (let track of new_tracks.querySelectorAll('x-gatortrack')) {
      let trackname = id;
      if ( this._alignments.data.names ) {
        trackname = this._alignments.data.names[ this._alignments.data.ids.indexOf(id) ];
      }
      if (track.hasAttribute('scale')) {
        track.setAttribute('scale', id);
      }
      if (track.hasAttribute('name')) {
        track.setAttribute('name', id);
      }
      if (! track.hasAttribute('fullname')) {
        track.setAttribute('fullname',trackname);
      }
    }

    this.parentNode.append(new_tracks);
  }
  this.parentNode.refreshTracks();
}

class AlignmentComponent extends HTMLElement  {
  static get observedAttributes() {
    return ['src'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
  }

  get src() {
    return this.getAttribute('src');
  }

  async performAlignment(sequences=[]) {
    let runner = new ClustalRunner();
    runner.sequences = sequences;
    return new Promise( (resolve,reject) => {
      runner.bind('resultReceived', () => {
        runner.result._raw_data.data.original_sequences = sequences;
        resolve(runner.result._raw_data);
      })
      runner.bind('error',reject);
      runner.retrieve();
    });
  }

  async setAlignment(alignments) {
    this._alignments = alignments;
    await setup_alignments.call(this,this._alignments);
    setup_tracks.call(this,this._template);  
  } 

  set alignment(alignments) {
    this.setAlignment(alignments);
  }

  async attributeChangedCallback(name) {
    await read_alignment.call(this,this.src);
    await setup_alignments.call(this,this._alignments);
    setup_tracks.call(this,this._template);
  }
}

customElements.define('x-alignment',AlignmentComponent);

export default AlignmentComponent;
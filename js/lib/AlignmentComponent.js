
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
  return retval;
};

const setup_tracks = function() {
  if ( ! this._alignments ) {
    return;
  }

  if ( ! this._template ) {
    this._template = this.querySelector('template');
  }

  for (let id of this._alignments.data.ids ) {
    let new_tracks = this._template.content.cloneNode(true);
    for (let renderer of new_tracks.querySelectorAll('x-trackrenderer')) {
      renderer.setAttribute('track', id);
      renderer.setAttribute('accession',id);
    }
    for (let jsrenderer of new_tracks.querySelectorAll('x-js-trackrenderer')) {
      jsrenderer.setAttribute('track', id);
      jsrenderer.setAttribute('accession',id);
    }
    for (let track of new_tracks.querySelectorAll('x-gatortrack')) {
      track.setAttribute('scale', id);
      track.setAttribute('name', id);
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


  async attributeChangedCallback(name) {
    await read_alignment.call(this,this.src);
    await setup_alignments.call(this,this._alignments);
    setup_tracks.call(this,this._template);
  }
}

customElements.define('x-alignment',AlignmentComponent);

export default AlignmentComponent;

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
}

const setup_alignments = function(alignments) {
  let parent_component = this.parentNode;
  let renderer = parent_component.renderer;
  let runner = new ClustalRunnerPrecomputed(alignments);
  runner.registerSequenceRenderer(renderer);
  runner.retrieve();
}

class AlignmentComponent extends HTMLElement  {
  static get observedAttributes() {
    return ['src'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    console.log("Getting alignment at ",this.src);
    // read_alignment.call(this,this.src);
  }

  get src() {
    return this.getAttribute('src');
  }


  async attributeChangedCallback(name) {
    await read_alignment.call(this,this.src);
    setup_alignments.call(this,this._alignments);
  }
}

customElements.define('x-alignment',AlignmentComponent);

export default AlignmentComponent;
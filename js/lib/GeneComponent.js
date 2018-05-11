 
import GenomeReader from './GenomeReader';
import GatorComponent from './GatorComponent';

const last_retrieved_gene = Symbol('last_retrieved_gene');

class GeneComponent extends GatorComponent {
  static get observedAttributes() {
    return ['geneid'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    setup_renderer.call(this);
    if (this.geneid) {
      retrieve_data.call(this);
    }
  }

  attributeChangedCallback(name,old,newval) {
    if (name === 'geneid' && this.renderer) {
      retrieve_data.call(this);
      return;
    }
  }

  get geneid() {
    return this.getAttribute('geneid');
  }
  set geneid(id) {
    this.setAttribute('geneid',id);
  }
}

let reader_has_data = function() {
  if ( ! this.geneid ) {
    return;
  }
  if ( this[last_retrieved_gene] === this.geneid ) {
    return;
  }
  this[last_retrieved_gene] = this.geneid;

  console.log('Getting data for ',this.geneid);
  var reader = new GenomeReader();
  reader.geneid = this.geneid;
  if (this.hasAttribute('reviewed')) {
    reader.reviewed = true;
  }
  // reader.uniprot = 'Q10472';
  reader.exon_margin = 300;//..this.exonmargin || 300;
  if (this.nt_mapping) {
    reader.nt_mapping = this.nt_mapping;
  }
  if ( ! this.ready ) {
    reader.registerSequenceRenderer(this.renderer);
    reader.bind('requestComplete',() => {
      this.renderer.hideAxis();
      this.renderer.fitZoom();
    });
    this.ready = new Promise( (resolve) => {
      reader.bind('requestComplete',() => {
        this.uniprots = Object.keys(reader.result._raw_data.data).map( up => up.toUpperCase() );
        if (reader.reviewed) {
          this.uniprots = this.uniprots.filter( up => up === reader.swissprot.toUpperCase() );
        }
        this.refreshTracks();
        resolve();
        delete this.ready;
        var event = new Event('ready',{bubbles: true});
        this.dispatchEvent(event);
      });
    });
  }

  reader.retrieve(this.accession || ""+this.geneid);

};

let setup_renderer = function() {
  this.renderer.trackOrder = [];
  this.renderer.reset();
};

let retrieve_data = function() {
  this.renderer.bind('sequenceChange',reader_has_data.bind(this));
  this.renderer.setSequence('M');
};

customElements.define('x-geneviewer',GeneComponent);

export default GeneComponent;
 
import GenomeReader from './GenomeReader';
import GatorComponent from './GatorComponent';


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
    retrieve_data.call(this);
  }

  attributeChangedCallback(name) {
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
  var reader = new GenomeReader();
  reader.geneid = this.geneid;
  reader.uniprot = 'Q10472';
  reader.exon_margin = 300;//..this.exonmargin || 300;
  if (this.nt_mapping) {
    reader.nt_mapping = this.nt_mapping;
  }
  reader.registerSequenceRenderer(this.renderer);
  reader.bind('requestComplete',() => {
    this.renderer.hideAxis();
    this.renderer.fitZoom();
  });
  reader.retrieve(this.accession || ""+this.geneid);
};

let setup_renderer = function() {
  this.renderer.trackOrder = [];
  this.renderer.reset();
  this.renderer.bind('sequenceChange', reader_has_data.bind(this) );
};

let retrieve_data = function() {
  this.renderer.setSequence('M');
};

customElements.define('x-geneviewer',GeneComponent);

export default GeneComponent;
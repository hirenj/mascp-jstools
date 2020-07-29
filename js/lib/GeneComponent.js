 
import GenomeReader from './GenomeReader';
import GatorComponent from './GatorComponent';

const last_retrieved_gene = Symbol('last_retrieved_gene');
const datapoints_symbol = Symbol('datapoints');
const chromosome_symbol = Symbol('chromosome');
const cdsstart_symbol = Symbol('cdsstart');
const cdsend_symbol = Symbol('cdsend');
const uniprots_symbol = Symbol('uniprots');

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
    this.renderer.bind('sequenceChange',reader_has_data.bind(this));
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

  get scrollPrecision() {
    return 1E-3;
  }

  get geneid() {
    return this.getAttribute('geneid');
  }
  set geneid(id) {
    this.setAttribute('geneid',id);
  }
  set datapoints(positions) {
    this[datapoints_symbol] = positions.map( pos => [pos,pos+1]);
  }
  get datapoints() {
    return this[datapoints_symbol] || [];
  }
  set uniprots(uniprots) {
    this[uniprots_symbol] = uniprots;
  }
  get uniprots() {
    return this[uniprots_symbol];
  }
  get coordinates() {
    let chr = this[chromosome_symbol];
    let start = this[cdsstart_symbol];
    let end = this[cdsend_symbol];
    return `chr${chr}:${start}-${end}`;
  }
}

let reader_has_data = function() {
  if ( ! this.geneid ) {
    return;
  }
  if ( this[last_retrieved_gene] === this.geneid ) {
    console.log('SENDING READY SAME GENE',this[last_retrieved_gene],this.geneid);
    var event = new Event('ready',{bubbles: true});
    this.dispatchEvent(event);
    return;
  }
  this[last_retrieved_gene] = this.geneid;

  console.log('Getting data for ',this.geneid);
  var reader = new GenomeReader();
  reader.dataRegions = this.datapoints;
  reader.geneid = this.geneid;
  if (this.hasAttribute('reviewed')) {
    reader.reviewed = true;
  }
  reader.exon_margin = 1000;//..this.exonmargin || 300;
  if (this.nt_mapping) {
    reader.nt_mapping = this.nt_mapping;
  }

  if ( ! this.ready ) {
    reader.registerSequenceRenderer(this.renderer);
    reader.bind('requestComplete',() => {
      this.renderer.hideAxis();
      this.renderer.fitZoom();
    });

    reader.bind('requestAborted', () => {
      delete this.ready;
      this[last_retrieved_gene] = null;
      console.log('ABORTING',this[last_retrieved_gene],this.geneid);
      var event = new Event('error',{bubbles: true});
      this.dispatchEvent(event);
    });

    this.ready = new Promise( (resolve) => {
      reader.bind('requestComplete',() => {
        this.uniprots = Object.keys(reader.result._raw_data.data).map( up => up.toUpperCase() );
        if (reader.reviewed) {
          this.uniprots = this.uniprots.filter( up => up === reader.swissprot.toUpperCase() );
        }
        let coordinate_data = reader.result._raw_data.data[(this.uniprots[0] || '').toLowerCase()];
        if (coordinate_data) {
          this[chromosome_symbol] = coordinate_data[0].chr;
          this[cdsstart_symbol] = coordinate_data[0].cdsstart;
          this[cdsend_symbol] = coordinate_data[0].cdsend;
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
  this.renderer.setSequence('M');
};

customElements.define('x-geneviewer',GeneComponent);

export default GeneComponent;
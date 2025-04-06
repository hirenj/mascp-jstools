
function WrapHTML() { return Reflect.construct(HTMLElement, [], Object.getPrototypeOf(this).constructor); }
Object.setPrototypeOf(WrapHTML.prototype, HTMLElement.prototype);
Object.setPrototypeOf(WrapHTML, HTMLElement);


const tmpl = document.createElement('template');

tmpl.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    touch-action: none;
  }
</style>
<div id="sequence"></div>
`;

const idsymbol = Symbol('id');
const lastrenderer = Symbol('lastrenderer');

class HighlightComponent extends WrapHTML {

  static get observedAttributes() {
    return [];
  }

  constructor() {
    super();
    this[idsymbol] = Symbol('Highlight');
  }


  attributeChangedCallback(name) {
  }

  connectedCallback() {
    let shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.appendChild(tmpl.content.cloneNode(true));
    this.updateHighlight();
  }

  disconnectedCallback() {
    if (this[lastrenderer]) {
      this[lastrenderer].removeHighlightByIdentifier(this.index);
    }
  }

  updateHighlight() {
    this[lastrenderer] = this.parentNode.renderer;
    if (this.index && this.parentNode && this.from && this.to) {
      this.parentNode.renderer.setHighlightByIdentifier(this.index,this.from,this.to);
    }
    this.shadowRoot.querySelector('div').textContent = this.parentNode.renderer.sequence.substring(this.from - 1,this.to);
  }

  duplicate() {
    let clone = this.cloneNode(true);
    clone[idsymbol] = Symbol('Highlight');
    this.parentNode.appendChild(clone);
  }

  get to() {
    return +this.getAttribute('to');
  }

  set to(position) {
    this.setAttribute('to',position);
    this.updateHighlight();
  }

  get from() {
    return +this.getAttribute('from');
  }

  set from(position) {
    this.setAttribute('from',position);
    this.updateHighlight();
  }

  get cssIndex() {
    return this.parentNode.renderer.getHighlightCSSIndex(this.index);
  }

  get index() {
    return this[idsymbol];
  }

}

customElements.define('ccg-highlight',HighlightComponent);

export default HighlightComponent;
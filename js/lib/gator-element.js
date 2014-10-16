if ('registerElement' in document) {
  (function() {
    var gatorViewer = (function() {
      var proto = Object.create(HTMLElement.prototype,{
          sequence: {
            set: function(sequence) { this.renderer.setSequence(sequence); },
            get: function() { return this.renderer.sequence; }
          },
          trackmargin: {
            set: function(margin) { this.renderer.trackGap = margin + 4; },
            get: function(margin) { return this.renderer.trackGap - 4;}
          },
          zoom : {
            set: function(zoom) { this.zoomval = zoom; if (zoom === "auto") { this.renderer.enablePrintResizing(); this.renderer.fitZoom(); } else { this.renderer.disablePrintResizing(); this.renderer.zoom = zoom; } },
            get: function(zoom) { return this.renderer.zoom; }
          }
      });
      proto.createdCallback = function() {
        var self = this;
        var shadow = this.createShadowRoot();
        shadow.appendChild(shadow.ownerDocument.createElement('div'));
        this.style.display = 'block';
        shadow.firstChild.style.overflow = 'hidden';
        this.renderer = new MASCP.CondensedSequenceRenderer(shadow.firstChild);

        if ( ! this.getAttribute('zoom')) {
          this.setAttribute('zoom','auto');
        } else {
          this.renderer.zoom = parseFloat(this.getAttribute('zoom'));
        }
        if (this.getAttribute('trackmargin')) {
          this.trackmargin = parseInt(this.getAttribute('trackmargin'));
        }

        this.renderer.bind('sequenceChange',function() {
          self.setAttribute('sequence',self.renderer.sequence);
          if (self.zoomval == "auto") {
            self.renderer.fitZoom();
          }
        });
        this.renderer.bind('zoomChange',function() {
          if (self.zoomval !== 'auto') {
            self.setAttribute('zoom',self.renderer.zoom);
          }
        });
      };
      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == 'sequence' && this.sequence !== newVal) {
          this.sequence = newVal;
        }
        if (attrName == 'zoom' && this.zoomval !== newVal) {
          this.zoom = newVal;
        }
        if (attrName == 'trackmargin' && this.trackmargin !== newVal ) {
          this.trackmargin = parseInt(newVal);
        }
      };
      document.registerElement('gator-viewer', { prototype: proto });
      return proto;
    })();

    var get_reader = function(clazz,caching) {
      var reader = new clazz();
      if (caching) {
        MASCP.Service.BeginCaching(reader);
      }
      return reader;
    };

    var gatorUniprot = (function() {
        var uniprot_proto = document.registerElement('gator-uniprot', {
        prototype: Object.create(gatorViewer, {
          createdCallback : {
            value : function() {
              gatorViewer.createdCallback.apply(this);
              if (this.getAttribute('caching')) {
                this.caching = this.getAttribute('caching');
              }

              if (this.getAttribute('accession')) {
                this.accession = this.getAttribute('accession');
              }

              if (this.getAttribute('auto')) {
                this.auto = this.getAttribute('auto');
              }
            }
          },
          attributeChangedCallback: {
            value : function (attrName,oldVal,newVal) {
              gatorViewer.attributeChangedCallback.call(this,attrName,oldVal,newVal);
              if (attrName == 'accession' && this.accession !== newVal) {
                this.accession = newVal;
              }
              if (attrName == "auto") {
                if (newVal && !this.auto) {
                  this.auto = true;
                } else if ( ! newVal && this.auto ) {
                  this.auto = false;
                }
              }
              if (attrName == 'caching') {
                if (newVal && ! this.caching) {
                  this.caching = newVal;
                } else if (! newVal && this.caching) {
                  this.caching = false;
                }
              }
            }
          },
          auto : {
            get: function() { return this.autoRun; },
            set: function(auto) { this.autoRun = auto; }
          },
          accession: {
            set: function(acc) {
              var self = this;
              self.acc = acc;
              self.setAttribute('accession',acc);
              if (self.auto) {
                self.go();
              }
            },
            get: function() { return this.acc; }
          },
          go: { value : function() {
            MASCP.ready = function() {
              get_reader(MASCP.UniprotReader,self.caching).retrieve(self.acc, function(err) {
                if (!err) {
                  self.renderer.setSequence(this.result.getSequence());
                }
              });
            };
          }},
          caching: {
            set: function(val) {
              if (val) {
                this.cachingval = true;
                this.setAttribute('caching',true);
              } else {
                this.removeAttribute('caching');
              }
            },
            get: function() {
              return this.cachingval;
            }
          }
        })
      });
      return uniprot_proto.prototype;
    })();
    var gatorGene = (function() {
        var gene_proto = document.registerElement('gator-gene', {
        prototype: Object.create(gatorUniprot, {
          createdCallback : {
            value : function() {
              gatorUniprot.createdCallback.apply(this);
              this.renderer.hide_axis = true;
              if (this.getAttribute('geneid')) {
                this.geneid = this.getAttribute('geneid');
              }
              if (this.getAttribute('exonmargin')) {
                this.exonmargin = parseInt(this.getAttribute('exonmargin'));
              }
            }
          },
          attributeChangedCallback: {
            value : function (attrName,oldVal,newVal) {
              gatorUniprot.attributeChangedCallback.call(this,attrName,oldVal,newVal);
              if (attrName == 'geneid' && this.geneid !== newVal) {
                this.geneid = newVal;
              }
            }
          },
          accession : {
            set: function(acc) {
              this.acc = acc;
              this.setAttribute('accession',acc);
            },
            get : function() {
              return this.acc;
            }
          },
          go : { value: function() {
            var self = this;
            self.renderer.grow_container = true;
            self.renderer.trackOrder = [];
            var old_zoom = self.zoom;
            self.renderer.setSequence("M");
            MASCP.ready = function() {
              var reader = get_reader(MASCP.GenomeReader,self.caching);
              reader.geneid = self.geneid;
              reader.exon_margin = self.exonmargin;
              reader.registerSequenceRenderer(self.renderer);
              reader.bind('requestComplete',function() {
                self.renderer.hideAxis();
                self.zoom = old_zoom;
              });
              reader.retrieve(self.accession);
            };
          }},
          geneid: {
            set: function(geneid) {
              var self = this;
              self.ncbigene = geneid;
              self.setAttribute('geneid',geneid);
              if (self.auto) {
                self.go();
              }
            },
            get: function() { return this.ncbigene; }
          }
        })
      });
      return gene_proto.prototype;
    })();

  })();


}
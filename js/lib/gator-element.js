if (typeof document !== 'undefined' && 'registerElement' in document) {
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
            set: function(zoom) {
              this.zoomval = zoom;
              if (zoom === "auto") {
                this.renderer.enablePrintResizing();
                this.renderer.fitZoom();
              } else if (zoom !== null && zoom !== "null") {
                this.renderer.disablePrintResizing();
                this.renderer.zoom = parseFloat(zoom);
                this.zoomval = parseFloat(zoom);
              }
            },
            get: function(zoom) { return this.renderer.zoom; }
          }
      });
      proto.createdCallback = function() {
        var self = this;
        var shadow = this.createShadowRoot();
        shadow.appendChild(shadow.ownerDocument.createElement('div'));
        this.style.display = 'block';
        shadow.firstChild.style.overflow = 'hidden';
        self.renderer = new MASCP.CondensedSequenceRenderer(shadow.firstChild);

        var dragger = new GOMap.Diagram.Dragger();

        var scroll_box = shadow.ownerDocument.createElement('div');
        scroll_box.style.height = '1em';
        shadow.appendChild(scroll_box);

        self.renderer.getVisibleLength = function() {
          return this.rightVisibleResidue() - this.leftVisibleResidue();
        };
        self.renderer.getTotalLength = function() {
          return this.sequence.length;
        };
        self.renderer.getLeftPosition = function() {
          return this.leftVisibleResidue();
        };
        self.renderer.setLeftPosition = function(pos) {
          return this.setLeftVisibleResidue(pos);
        };

        Object.defineProperty(this.renderer,"grow_container",{
          get: function() { return self.style.overflow == "auto"; },
          set: function() { }
        });

        Object.defineProperty(self,"interactive",{
          get: function() { if (self.getAttribute('interactive')) { return true } else { return false }},
          set: function(val) { is_interactive.enabled = val }
        });

        var is_interactive = {'enabled' : self.interactive };
        var observer = new MutationObserver(function() {
          if (self.renderer.grow_container) {
            dragger.enabled = true;
          } else {
            dragger.enabled = false;
            self.renderer.setLeftVisibleResidue(0);
          }
          self.renderer.refresh();
        });
        observer.observe(self, {
            attributes:    true,
            attributeFilter: ["style"]
        });

        if ( ! this.getAttribute('zoom')) {
          this.setAttribute('zoom','auto');
        } else {
          this.zoom = this.getAttribute('zoom');
        }
        if (this.getAttribute('trackmargin')) {
          this.trackmargin = parseInt(this.getAttribute('trackmargin'));
        }

        this.renderer.bind('sequenceChange',function() {
          dragger.applyToElement(self.renderer._canvas);
          dragger.enabled = self.renderer.grow_container;
          GOMap.Diagram.addScrollBar(self.renderer, self.renderer._canvas,scroll_box);

          dragger.addTouchZoomControls(self.renderer, self.renderer._canvas,is_interactive);
          GOMap.Diagram.addScrollZoomControls.call(is_interactive,self.renderer, self.renderer._canvas,0.001);

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
        if (attrName == 'interactive') {
          this.interactive = newVal ? true : false;
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

    var fire_event = function(targ,name) {
      var ev = document.createEvent("Events");
      ev.initEvent(name, false, true);
      targ.dispatchEvent(ev);
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
              if (this.getAttribute('auto')) {
                this.auto = this.getAttribute('auto');
              }

              if (this.getAttribute('accession')) {
                this.accession = this.getAttribute('accession');
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
            var self = this;
            MASCP.ready = function() {
              get_reader(MASCP.UniprotReader,self.caching).retrieve(self.accession, function(err) {
                if (!err) {
                  self.renderer.bind('sequenceChange',function() {
                    self.renderer.unbind('sequenceChange',arguments.callee);
                    fire_event(self,'ready');
                  });
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
              if (attrName == 'exonmargin' && this.exonmargin != newVal) {
                this.exonmargin = parseInt(newVal);
                if (this._genomereader) {
                  this._genomereader.exon_margin = this.exonmargin;
                  this.renderer.refreshScale();
                  if (this.getAttribute('zoom') == 'auto') {
                    this.renderer.fitZoom();
                  }
                }
              }
            }
          },
          accession : {
            set: function(acc) {
              this.acc = acc;
              if (acc) {
                this.setAttribute('accession',acc);
              } else {
                this.removeAttribute('accession');
              }
            },
            get : function() {
              return this.acc;
            }
          },
          go : { value: function() {
            var self = this;
            self.renderer.trackOrder = [];
            self.renderer.reset();
            var old_zoom = self.getAttribute('zoom') || 'auto';
            self.removeAttribute('zoom');
            self.renderer.bind('sequenceChange',function() {
              self.renderer.unbind('sequenceChange',arguments.callee);
              var reader = get_reader(MASCP.GenomeReader,self.caching);
              reader.geneid = self.geneid;
              reader.exon_margin = self.exonmargin;
              self._genomereader = reader;
              reader.registerSequenceRenderer(self.renderer);
              reader.bind('requestComplete',function() {
                self.renderer.hideAxis();
                self.setAttribute('zoom',old_zoom);
                fire_event(self,'ready');
              });
              reader.retrieve(self.accession || ""+self.geneid);
            });
            MASCP.ready = function() {
              self.renderer.setSequence('M');
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
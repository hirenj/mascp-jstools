if ('registerElement' in document) {
  (function() {
    var proto = Object.create(HTMLElement.prototype,{
        sequence: {
          set: function(sequence) { this.renderer.setSequence(sequence); },
          get: function() { return this.renderer.sequence; }
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
      this.setAttribute('zoom','auto');
    };
    proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
      if (attrName == 'sequence' && this.sequence !== newVal) {
        this.sequence = newVal;
      }
      if (attrName == 'zoom' && this.zoomval !== newVal) {
        this.zoom = newVal;
      }
    };
    document.registerElement('gator-viewer', { prototype: proto });

    var get_reader = function(clazz,caching) {
      var reader = new clazz();
      if (caching) {
        MASCP.Service.BeginCaching(reader);
      }
      return reader;
    };

    var uniprot_proto = document.registerElement('gator-uniprot', {
      prototype: Object.create(proto, {
        createdCallback : {
          value : function() {
            proto.createdCallback.apply(this);
            if (this.getAttribute('accession')) {
              this.accession = this.getAttribute('accession');
            }
          }
        },
        attributeChangedCallback: {
          value : function (attrName,oldVal,newVal) {
            proto.attributeChangedCallback.call(this,attrName,oldVal,newVal);
            if (attrName == 'accession' && this.acc !== newVal) {
              this.accession = newVal;
            }
          }
        },
        accession: {
          set: function(acc) {
            var self = this;
            self.acc = acc;
            self.setAttribute('accession',acc);
            get_reader(MASCP.UniprotReader,self.caching).retrieve(self.acc, function(err) {
              if (!err) {
                self.renderer.setSequence(this.result.getSequence());
              }
            });
          },
          get: function() { return this.acc; }
        }
      })
    });

  })();
}
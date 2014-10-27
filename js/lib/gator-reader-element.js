if (typeof document !== 'undefined' && 'registerElement' in document) {
  (function() {

    var get_renderer = function(renderer_url,callback) {

      if (renderer_url.match(/^(https?:\/)?\//)) {
          MASCP.Service.request(renderer_url,callback,true);
      }

    };

    var get_cached_renderer = function(renderer_url,callback) {
      if ( ! sessionStorage.renderer_caches ) {
        sessionStorage.renderer_caches = JSON.stringify({});
      }
      var renderer_caches = JSON.parse(sessionStorage.renderer_caches);
      if (renderer_caches[renderer_url]) {
        console.log("Going to cache for renderer at "+renderer_url);
        callback.call(null,null,renderer_caches[renderer_url]);
        return;
      }
      get_renderer(renderer_url,function(err,data) {

        if ( err ) {
          callback.call(null,err);
          return;
        }
        var renderer_caches = JSON.parse(sessionStorage.renderer_caches);
        renderer_caches[renderer_url] = data;
        sessionStorage.renderer_caches = JSON.stringify(renderer_caches);
        callback.call(null,null,data);
      });
    };

    var iterate_readers = function(err,pref,reader,acc,renderer) {
      reader.preferences = { getPreferences: function(cb) {
        cb.call(reader,null,pref);
      } };
      var track_name = (pref.render_options || {})["track"] ? pref.render_options["track"] : acc;
      if (pref && pref.icons || (pref.render_options || {}).icons ) {
        var icon_block = pref.icons || (pref.render_options || {}).icons;
        MASCP.Service.request(icon_block.url,function(err,doc) {
          if (doc) {
            renderer.importIcons(icon_block.namespace,doc.documentElement);
          }
        },"xml");
      }
      if (pref.type == 'liveClass') {
        reader.registerSequenceRenderer(renderer,pref.render_options || {} );
      }

      reader.retrieve(acc,function() {
        if ( ! this.result ) {
          return;
        }
        if ( renderer.trackOrder.indexOf(track_name) < 0 ) {
          MASCP.registerLayer(track_name, { "fullname" : track_name }, [renderer]);
          renderer.trackOrder.push(track_name);
          renderer.showLayer(track_name);
        }
        if ( ! MASCP.getLayer(track_name) || MASCP.getLayer(track_name).disabled ) {
          MASCP.registerLayer(track_name, {"fullname" : track_name }, [renderer]);
        }
        var datas = this.result._raw_data.data;
        if (pref.render_options["renderer"] && JSandbox) {
          (function(err,doc) {
            if (err) {
              window.notify.alert("Could not render "+pref.title);
              return;
            }
            var sandbox = new JSandbox();
            var seq = renderer.sequence;
            (function() {
              var obj = ({ "gotResult" : function() {
                seq = renderer.sequence;
              }, "agi" : acc });
              renderer.trigger('readerRegistered',[obj]);
              obj.gotResult();
            })();

            sandbox.eval(doc,function() {
              this.eval({ "data" : "renderData(input.sequence,input.data,input.acc)",
                          "input" : { "sequence" : seq, "data" : datas, "acc" : acc  },
                          "onerror" : function(message) { console.log(pref.title); console.log("Errored out"); console.log(message); },
                          "callback" : function(r) {
                            sandbox.terminate();
                            var obj = ({ "gotResult" : function() {
                              r.forEach(function(obj) {
                                var offset = parseInt((pref.render_options || {}).offset || 0);
                                if (obj.options) {
                                  if (obj.options.offset) {
                                    obj.options.offset += offset;
                                    return;
                                  }
                                  obj.options.offset = offset;
                                } else {
                                  obj.options = { "offset" : offset };
                                }
                              });
                              renderer.renderObjects(track_name,r);
                              renderer.trigger('resultsRendered',[this]);
                              renderer.refresh();
                            }, "agi" : acc });
                            renderer.trigger('readerRegistered',[obj]);
                            obj.gotResult();
                          }
                        });
            });
          })(null,pref.render_options['renderer']);
          return;
        }
      });
    };
    var gatorReaderProto = null;
    var gatorReader = (function() {
      var proto = Object.create(HTMLElement.prototype,{
        type: {
          get: function() { return this.readerType; },
          set: function(type) { this.readerType = type; this.setAttribute('type',type); }
        },
        track: {
          get: function() { return this.readerTrack; },
          set: function(track) { this.readerTrack = track; this.setAttribute('track',track); }
        },
        name: {
          get: function() { return this.readerTitle; },
          set: function(name) { this.readerTitle = name; this.setAttribute('name',name); }
        },
        rendererUrl: {
          set: function(url) { this.rendererUrl = url; },
          get: function() { return this.rendererUrl; }
        },
        renderer: {
          set: function(func) { this.renderFunc = func; },
          get: function() { return this.renderFunc }
        }
      });
      proto.createdCallback = function() {
        var self = this;
        this.renderFunc = "";
        if (this.getAttribute('type')) {
          this.type = this.getAttribute('type');
        }
        if (this.getAttribute('rendererurl')) {
          get_cached_renderer(this.getAttribute('rendererurl'),function(err,data) {
            if ( ! err ) {
              self.renderer = data;
            }
          });
        }
      };
      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == "name" && this.name !== newVal) {
          this.name = newVal;
        }
        if (attrName == "type" && this.type !== newVal) {
          this.type = newVal;
        }
        if (attrName == "track" && this.track != newVal ) {
          this.track = newVal;
        }
        if (attrName == "rendererurl") {
          get_cached_renderer(newVal,function(err,data) {
            if ( ! err ) {
              this.renderer = data;
            }
          });
        }
      };
      proto._generateConfig = function() {
          var config = {};
          if ( ! this.config_id ) {
            return config;
          }
          config [ this.config_id ] = { type: this.type, title: this.name, render_options: { track: this.track, renderer: "var renderData = "+this.renderFunc.toString(), icons : { "url" : "/sugars.svg", "namespace" : "sugar" } }, data: this.data };
          return config;
      };

      Object.defineProperty(proto, 'configuration', {
        get: function() {
          return this._generateConfig();
        }
      });
      gatorReaderProto = proto;
      var readerClass = document.registerElement('gator-reader', { prototype: proto });
      return readerClass;
    })();

    var gatorUrl = (function() {
      var proto = Object.create( gatorReaderProto,{
        'href' : {
          get: function() { return this.config_id; },
          set: function(url) { this.config_id = url }
        },
        'type' : {
          get: function() { return "gatorURL" }
        }
      });

      proto.createdCallback = function() {
        var self = this;
        if (this.getAttribute('href')) {
          this.href = this.getAttribute('href');
        }
        gatorReaderProto.createdCallback.apply(this);
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == "href" && newVal !== this.href ) {
          this.href = newVal;
        }
        gatorReaderProto.attributeChangedCallback.apply(this);

      };
      document.registerElement('gator-gatorurl', { prototype: proto });
      return proto;
    })();

    var localReader = (function() {
      var proto = Object.create( gatorReaderProto,{
        'type' : {
          get: function() { return "data" }
        },
        'config_id' : {
          get: function() { return "local-"+((new Date()).getTime()); }
        }
      });

      proto.createdCallback = function() {
        var self = this;
        if (this.getAttribute('data')) {
          // this.data = JSON.parse(this.getAttribute('data'));
        }
        gatorReaderProto.createdCallback.apply(this);
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        gatorReaderProto.attributeChangedCallback.apply(this);
      };
      document.registerElement('gator-localdata', { prototype: proto });
      return proto;
    })();


    var domainReader = (function() {
      var proto = Object.create( gatorReaderProto,{
        'type' : {
          get: function() { return "liveClass"; }
        },
        'endpoint' : {
          get: function() { return this._endpoint },
          set: function(endpoint) { this._endpoint = endpoint }
        },
        'config_id' : {
          get: function() { return "DomainRetriever"; }
        }
      });

      proto.createdCallback = function() {
        var self = this;
        if (this.getAttribute('accepted')) {
          this.accepted = this.getAttribute('accepted');
        }
        if (this.getAttribute('href')) {
          this.endpoint = this.getAttribute('href');
        }

        gatorReaderProto.createdCallback.apply(this);
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        gatorReaderProto.attributeChangedCallback.apply(this);
      };

      proto._generateConfig = function() {
        var config = gatorReaderProto._generateConfig.call(this);
        config['DomainRetriever'].accepted_domains = { 'type' : 'url', url : this.accepted };
        if (this.endpoint) {
          config['DomainRetriever'].url = this.endpoint;
        }
        config['DomainRetriever']['render_options']['renderer'] = null;
        return config;
      };

      document.registerElement('gator-domains', { prototype: proto });
      return proto;
    })();



    var readerRenderer = (function() {
      var proto = Object.create(HTMLElement.prototype,{
      });

      proto.attachedCallback = function() {
        var self = this;
      };

      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
      };

      proto.go = function() {
        var self = this;
        var config = this.readers.reduce(function(result,reader) { var confblock = reader.configuration; for(var key in confblock) { result[key] = confblock[key] }; return result; },{});
        MASCP.IterateServicesFromConfig(config,function(err,pref,reader) {
          iterate_readers(err,pref,reader,self.parentNode.accession,self.parentNode.renderer);
        });
      };

      Object.defineProperty(proto, 'readers', {
        get: function() {
          var all_readers = [];
          var all_nodes = this.childNodes;
          for (var i = 0; i < all_nodes.length; i++) {
            if (all_nodes[i] instanceof gatorReader) {
              all_readers.push(all_nodes[i]);
            }
          }
          return all_readers;
        }
      });
      document.registerElement('gator-reader-renderer', { prototype: proto });
      return proto;
    })();

    var gatorTrack = (function() {
      var proto = Object.create(readerRenderer,{
        name: {
          get: function() { return this.trackName || this.parentNode.accession; },
          set: function(name) { this.trackName = name; this.setAttribute('name',name); update_readers.apply(this); }
        },
        genomic: {
          get: function() { return this.trackGenomic; },
          set: function(is) { if(is) { this.trackGenomic = true; this.setAttribute('genomic',true)} else { this.trackGenomic = false; this.removeAttribute('genomic'); } }
        }
      });
      proto.createdCallback = function() {
        var self = this;
        if (this.getAttribute('name')) {
          this.name = this.getAttribute('name');
        }
        if (this.getAttribute('genomic')) {
          this.genomic = this.getAttribute('genomic');
        }
      };
      proto.attributeChangedCallback = function(attrName, oldVal, newVal) {
        if (attrName == "name" && this.name !== newVal) {
          this.name = newVal;
        }
        if (attrName == "genomic") {
          if ( newVal ) {
            this.genomic = true;
          } else {
            this.genomic = false;
          }
        }
      };
      var update_readers = function() {
        var self = this;
        this.readers.forEach(function(reader) {
          if (! reader.track && self.name) {
            reader.track = self.name;
          }
        });
      };
      proto.go = function() {
        var self = this;
        var lay = MASCP.registerLayer(this.name, { fullname: this.name }, [self.parentNode.renderer] );
        if (this.genomic) {
          lay.genomic = this.genomic;
        } else {
          delete lay.genomic;
        }
        update_readers.apply(this);
        readerRenderer.go.apply(this);
      };
      document.registerElement('gator-track', { prototype: proto });
      return proto;
    })();



  })();


}

if ( typeof MASCP == 'undefined' || typeof MASCP.Service == 'undefined' ) {
    throw "MASCP.Service is not defined, required class";
}

(function() {

  MASCP.EditableReader = MASCP.buildService(function(data) {
    this._raw_data = data;
    return this;
  });

  MASCP.EditableReader.prototype.retrieve = function(acc) {
    if (acc) {
      this.acc = acc;
      this.agi = acc;
    }
    bean.fire(this,'resultReceived');
  };

  var datablockToAnnotations = function(data) {
    var result = [];
    Object.keys(data).forEach(function(key) {
      if (key === 'symbol_map' || key === 'tag_map') {
        return;
      }
      if (data[key] && Array.isArray(data[key])) {
        var array_copy = data[key];
        data[key].forEach(function(anno) {
          anno.acc = key;
        });
        result = result.concat(data[key]);
      }
    });
    return result;
  };

  var annotationsToDatablock = function(annotations) {
    var result = {};
    annotations.forEach(function(anno) {
      if (anno.acc) {
        if ( ! result[anno.acc] ) {
          result[anno.acc] = [];
        }
        result[anno.acc].push(anno);
      }
    });
    return result;
  };

  var mousePosition = function(evt) {
      var posx = 0;
      var posy = 0;
      if (!evt) {
          evt = window.event;
      }

      if (evt.pageX || evt.pageY)     {
          posx = evt.pageX - (document.body.scrollLeft + document.documentElement.scrollLeft);
          posy = evt.pageY - (document.body.scrollTop + document.documentElement.scrollTop);
      } else if (evt.clientX || evt.clientY)  {
          posx = evt.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
          posy = evt.clientY + document.body.scrollTop + document.documentElement.scrollTop;
      }
      if (self.targetElement) {
          posx = evt.screenX;
          posy = evt.screenY;
      }
      return [ posx, posy ];
  };

  var svgPosition = function(ev,svgel) {
      var positions = mousePosition(ev.changedTouches ? ev.changedTouches[0] : ev);
      var p = {};
      if (svgel.nodeName == 'svg') {
          p = svgel.createSVGPoint();
          var rootCTM = svgel.getScreenCTM();
          p.x = positions[0];
          p.y = positions[1];

          self.matrix = rootCTM.inverse();
          p = p.matrixTransform(self.matrix);
      } else {
          p.x = positions[0];
          p.y = positions[1];
      }
      return p;
  };

  var bindClick = function(element,handler) {
    if ("ontouchstart" in window) {
      element.addEventListener('touchstart',function(ev) {
        var startX = ev.touches[0].clientX;
        var startY = ev.touches[0].clientY;
        var reset = function() {
          document.body.removeEventListener('touchmove',move);
          element.removeEventListener('touchend',end);
        };
        var end = function(ev) {
          reset();
          ev.stopPropagation();
          ev.preventDefault();
          if (handler) {
            handler.call(null,ev);
          }
        };
        var move = function(ev) {
          if (Math.abs(ev.touches[0].clientX - startX) > 10 || Math.abs(ev.touches[0].clientY - startY) > 10) {
            reset();
          }
        };
        document.body.addEventListener('touchmove', move , false);
        element.addEventListener('touchend',end,false);
      },false);
    } else {
      element.addEventListener('click',handler,false);
    }
  };

  var mouse_start = function(ev) {
    var self = this;
    if (ev.event_data && ev.event_data.annotationid) {
      var annotation = self.getAnnotation(ev.event_data.annotationid);
      if (annotation) {
        self.pieMaker(self.getAnnotation(ev.event_data.annotationid)).call(ev.target,annotation.type !== 'symbol',ev);
        this.renderer._canvas.addEventListener('mousemove',mouse_move,true);
      }
    }
  };
  var mouse_move = function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
  };

  var mouse_click = function(ev) {
    var self = this;
    if (ev.event_data && ev.event_data.annotationid && ev.event_data.annotationid === "potential") {
      var anno = self.potential_annos[0];
      self.potential_annos = [];
      anno.id = (new Date()).getTime();
      delete anno.class;
      self.annotations.push( anno );
      self.renderer.select();
    }
    ev.preventDefault();
    ev.stopPropagation();

  };

  var touch_end = function(ev) {
    var self = this;
    if (ev.event_data && ev.event_data.annotationid) {
      var annotation = self.getAnnotation(ev.event_data.annotationid);
      if (annotation && self.pie_map[ annotation.id ] ) {
        self.pie_map[ annotation.id].end();
        delete self.pie_map [ annotation.id ];
      }
      ev.preventDefault();
    }
  };

  var setup_mouse_events = function(canvas) {
    var self = this;
    this.pie_map = {};

    canvas.addEventListener('mousedown',mouse_start.bind(self),false);
    canvas.addEventListener('touchstart',mouse_start.bind(self),false);
    canvas.addEventListener('click',mouse_click.bind(self),false);
    canvas.addEventListener('touchend',touch_end.bind(self),false);
  };

  var color_content = function(self,annotation,color) {
    return {'symbol' : color, "hover_function" : function() { annotation.color = ""+color+""; } };
  };

  var icon_content = function(self,annotation,symbol) {
    return { 'symbol' : self.symbolTags[symbol], "hover_function" : function() { console.log("Set symbol to "+symbol); annotation.tag = symbol; }  };
  };

  var tag_content = function(self,annotation,tag) {
    return { 'text' : tag, "hover_function" : function() { annotation.tag = tag; }  };
  };

  var trash_content = function(self,annotation) {
    return { 'symbol' :  '#icon_trash', 'text_alt' : 'Delete', "select_function" : function() { self.demoteAnnotation('self',annotation); } };
  };

  MASCP.EditableReader.prototype.generatePieContent = function(type,annotation,vals) {
    var self = this;
    var contents = [];
    vals.forEach(function(val) {
      contents.push(type.call(null,self,annotation,val));
    });
    contents.push(trash_content(self,annotation));
    return contents;
  };

  MASCP.EditableReader.prototype.pieMaker = function(annotation) {
    var self = this;
    return function(set_col,ev) {
      if ( ! ev ) {
        ev = set_col;
        set_col = null;
      }
      ev.preventDefault();
      ev.stopPropagation();
      if (self.pie_map[ annotation.id ]) {
        return;
      }
      var canvas = self.renderer._canvas;
      var pie_contents;
      if ( ! set_col ) {
        if (annotation.type == 'symbol') {
          pie_contents = self.generatePieContent(icon_content,annotation,Object.keys(self.symbolTags));
        }
      } else {
        pie_contents = self.generatePieContent(tag_content,annotation,Object.keys(self.boxTags));
      }
      var click_point = svgPosition(ev,canvas);
      var pie = PieMenu.create(canvas,click_point.x/canvas.RS,click_point.y/canvas.RS,pie_contents,{ "size" : 7, "ellipse" : true });
      self.pie_map[ annotation.id ] = pie;

      var end_pie = function(ev) {
        canvas.removeEventListener('mouseout',end_pie);
        canvas.removeEventListener('mouseup',end_pie);
        canvas.removeEventListener('mousemove',mouse_move,true);
        if (self.pie_map[annotation.id]) {
          self.pie_map[annotation.id].destroy();
          delete self.pie_map[annotation.id];
        }
      };
      self.pie_map[annotation.id].end = end_pie;

      canvas.addEventListener('mouseup',end_pie,false);

    };
  };

  MASCP.EditableReader.prototype.setupSequenceRenderer = function(renderer,options) {
    var self = this;
    var empty_track = function() {
    };
    bean.add(MASCP.getLayer(options.track),'selection', function(start,end) {
      if ( ! start || ! end ) {
        return;
      }
      end += 1;
      self.potential_annos = [ { 'id' : 'potential', 'type' : Math.abs(start - end) <= 1 ? 'symbol' : 'box', 'acc' : self.acc, "length": Math.abs(start-end) ,"index" : Math.min(start,end), "class" : "potential" } ];
      bean.fire(self,'resultReceived');
    });
    if (renderer._canvas) {
      setup_mouse_events.call(self,renderer._canvas);
    }
    renderer.bind('sequenceChange',function() {
      setup_mouse_events.call(self,this._canvas);
    });

    self.renderer = renderer;

    if (! options.renderer ) {
      options.renderer = "var renderData = " + MASCP.EditableReader.renderer.toString();
    }
  };

  if (Object.defineProperty) {
      Object.defineProperty(MASCP.EditableReader.prototype,"result", {
        get: function() {
          var block = this.data;
          if (this.potential_annos && this.potential_annos[0]) {
            if ( ! block[this.potential_annos[0].acc]) {
              block[this.potential_annos[0].acc] = [];
            }
            block[this.potential_annos[0].acc].push(this.potential_annos[0]);
          }
          return { "_raw_data" : { "data" : block } };
        }
      });

      Object.defineProperty(MASCP.EditableReader.prototype,"annotations", {
          get : function() {
            if (! this._annotations ) {
              this._annotations = setupAnnotations(this);
            }
            return this._annotations;
          },
          set : function(annotations) {
            if (! this._annotations ) {
              this._annotations = setupAnnotations(this);
            }
            if (annotations) {
              Array.prototype.splice.apply(this._annotations,[0,this._annotations.length].concat(annotations));
            }
          }
      });
      Object.defineProperty(MASCP.EditableReader.prototype,"data", {
          get : function() {
            var datablock = annotationsToDatablock(this.annotations);
            datablock.symbol_map = this.symbolTags;
            datablock.tag_map = this.boxTags;
            return datablock;
          },
          set : function(data) {
            this.annotations = datablockToAnnotations(data);
          }
      });
      Object.defineProperty(MASCP.EditableReader.prototype,"symbolTags", {
        get: function() {
          return {
            "GalNAc": "#sugar_galnac",
            "Man" : "#sugar_man",
            "Xyl" : "#sugar_xyl",
            "Fuc" : "#sugar_fuc",
            "GlcNAc" : "#sugar_glcnac",
            "N-linked" : "#sugar_glcnac(b1-4)glcnac"
          };
        }
      });
      Object.defineProperty(MASCP.EditableReader.prototype,"boxTags", {
        get: function() {
          if ( ! this._box_tags) {
            this._box_tags = {
              "Red" : "#f00",
              "Green" : "#0f0",
              "Blue" : "#00f"
            };
          }
          return this._box_tags;
        },
        set: function(tags) {
          Object.keys(tags).forEach(function(tag) {
            this._box_tags[tag] = tags[tag];
          });
        }
      });

  }

  var setupAnnotations = function(self) {
    if (! self._annotations ) {
      self._annotations = [];
    }
    if (! self.potential_annos) {
      self.potential_annos = [];
    }

    var new_annotation = function(added,removed) {
      if ((added && added.pie) || (removed && ("pie" in removed) )) {
        return;
      }
      bean.fire(self,'resultReceived');
    };

    var arr_observer = new ArrayObserver(self._annotations);
    self._annotations.forEach(function(ann) {
      (new ObjectObserver(ann)).open(new_annotation);
    });

    arr_observer.open(function(splices) {
      var any_change = false;
      splices.forEach(function(splice) {
        while(splice.addedCount > 0) {
          var ann = self._annotations[splice.index + splice.addedCount - 1];
          (new ObjectObserver(ann)).open(new_annotation);

          if (ann.acc == self.acc) {
            any_change = true;
          }
          splice.addedCount -= 1;
        }
      });

      if (any_change) {
        new_annotation();
      }
    });

    return self._annotations;
  };

  MASCP.EditableReader.prototype.getAnnotation = function(id) {
    for (var type in this.annotations) {
      var annos = this.annotations.filter(function(anno) {
        return anno.id === id;
      });
      if (annos.length == 1) {
        return annos[0];
      }
    }
    return null;
  };

  MASCP.EditableReader.renderer = function(seq,data,acc) {
    var renderAnnotation = function(annotation,symbol_map,tag_map,top_offset) {
      var objects = [];
      var object;

      if (annotation.type == 'symbol' || annotation.length == 1) {
        object = {  'aa'    : annotation.index,
                    'type'  : 'marker',
                    'options':
                    { "content" : symbol_map[annotation.tag] ? symbol_map[annotation.tag] : "X" ,
                      "bare_element" : true,
                      "border" : "#f00",
                      "offset" : 6 + top_offset,
                      "height" : 12
                    }
                  };
        objects.push(object);
      } else {

        var added = [];
        object = { 'aa' : annotation.index, 'type' :'shape', 'width' : annotation.length, 'options' : {"shape" : "rectangle","height" : 4, "offset" : 0 + top_offset } };
        if (tag_map[annotation.tag]) {
          object.options.fill = tag_map[annotation.tag];
        }

        objects.push(object);

        if (annotation.tag) {
          object = { 'aa' : annotation.index+Math.floor(0.5*annotation.length),
                    'type' : 'marker',
                    'options' : {
                    'content' : { 'type' : 'text_circle',
                                  'text' : annotation.tag,
                                  'options' : {
                                    'stretch' : 'right',
                                    'weight' : 'normal',
                                    'fill' : '#000'
                                  },
                                  'opacity' : 0.8,
                                },
                    'offset' : 7.5 + top_offset,
                    'height' : 15,
                    'no_tracer' : true,
                    'bare_element' : true,
                    'tag_marker' : true,
                    'zoom_level' : 'text'
                    }
                   };
          objects.push(object);

        }
      }
      objects.forEach(function(obj) {
        obj.options.events = [{'type' : 'click', 'data' : {  'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } },
                              {'type' : 'mousedown','data' : { 'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } },
                              {'type' : 'touchstart','data' : { 'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } },
                              {'type' : 'touchend','data' : { 'annotationid' : annotation.id, 'is_annotation' : ! obj.tag_marker } }];
      });
      return objects;
    };

    var datablockToAnnotations = function(data) {
      var result = [];
      Object.keys(data).forEach(function(key) {
        if (key === 'symbol_map' || key === 'tag_map') {
          return;
        }
        if (data[key] && Array.isArray(data[key])) {
          var array_copy = data[key];
          data[key].forEach(function(anno) {
            anno.acc = key;
          });
          result = result.concat(data[key]);
        }
      });
      return result;
    };

    var intervalSortAnnotations = function(annotations) {
      var annos = annotations;
      var intervals = [];
      annos.forEach(function(annotation) {
        if (annotation.class === "potential") {
          return;
        }
        var start;
        var end;
        start = annotation.index;
        end = annotation.index + (annotation.length || 1);
        intervals.push({ "index" : start, "start" : true,  "annotation" : annotation });
        intervals.push({ "index" : end, "start" : false , "annotation" : annotation });
      });
      intervals.sort(function(a,b) {
        var sameAcc = (a.annotation.acc || "").localeCompare(b.annotation.acc);
        if (sameAcc !== 0 && a.annotation.acc && b.annotation.acc) {
          return sameAcc;
        }

        if (a.index < b.index ) {
          return -1;
        }
        if (a.index > b.index ) {
          return 1;
        }
        if (a.index == b.index) {
          return a.start ? -1 : 1;
        }
      });
      annos.forEach(function(annotation) {
        if (annotation.class !== 'potential') {
          return;
        }
        var start;
        var end;
        start = annotation.index;
        end = annotation.index + (annotation.length || 1);
        intervals.unshift({ "index" : end, "start" : false , "annotation" : annotation });
        intervals.unshift({ "index" : start, "start" : true,  "annotation" : annotation });
      });

      return intervals;
    };

    var drawAnnotations = function(annotations,symbol_map,tag_map,acc) {
      var wanted_accs = [acc];
      var to_draw = [];

      var sorted_intervals = intervalSortAnnotations(annotations);
      var current_end = -1;

      var needs_to_draw = true;
      var depth = 0;

      while ( needs_to_draw ) {
        needs_to_draw = false;
        for ( var i = 0; i < sorted_intervals.length; i++ ) {
          if ( ! sorted_intervals[i]) {
            continue;
          }
          var annotation = sorted_intervals[i].annotation;

          if (wanted_accs.indexOf(annotation.acc) < 0 ) {
            continue;
          }
          if (annotation.deleted) {
            continue;
          }
          if (sorted_intervals[i].start) {
            if (sorted_intervals[i].index > current_end) {
              current_end = annotation.index + (annotation.length || 1);
              to_draw = to_draw.concat(renderAnnotation(annotation,symbol_map,tag_map,(annotation.class == "potential") ? -1 : depth));
              sorted_intervals[i] = null;
            } else {
              needs_to_draw = true;
            }
          }
        }
        current_end = 0;
        depth += 10;
      }
      return to_draw;
    };
    return drawAnnotations(datablockToAnnotations(data),data.symbol_map,data.tag_map,acc);

  };

})();
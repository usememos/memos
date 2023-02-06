/*
Viz.js 2.1.2 (Graphviz 2.40.1, Expat 2.2.5, Emscripten 1.37.36)
Copyright (c) 2014-2018 Michael Daines
Licensed under MIT license

This distribution contains other software in object code form:

Graphviz
Licensed under Eclipse Public License - v 1.0
http://www.graphviz.org

Expat
Copyright (c) 1998, 1999, 2000 Thai Open Source Software Center Ltd and Clark Cooper
Copyright (c) 2001, 2002, 2003, 2004, 2005, 2006 Expat maintainers.
Licensed under MIT license
http://www.libexpat.org

zlib
Copyright (C) 1995-2013 Jean-loup Gailly and Mark Adler
http://www.zlib.net/zlib_license.html
*/
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Viz = factory());
}(this, (function () { 'use strict';

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  var WorkerWrapper = function () {
    function WorkerWrapper(worker) {
      var _this = this;

      classCallCheck(this, WorkerWrapper);

      this.worker = worker;
      this.listeners = [];
      this.nextId = 0;

      this.worker.addEventListener('message', function (event) {
        var id = event.data.id;
        var error = event.data.error;
        var result = event.data.result;

        _this.listeners[id](error, result);
        delete _this.listeners[id];
      });
    }

    createClass(WorkerWrapper, [{
      key: 'render',
      value: function render(src, options) {
        var _this2 = this;

        return new Promise(function (resolve, reject) {
          var id = _this2.nextId++;

          _this2.listeners[id] = function (error, result) {
            if (error) {
              reject(new Error(error.message, error.fileName, error.lineNumber));
              return;
            }
            resolve(result);
          };

          _this2.worker.postMessage({ id: id, src: src, options: options });
        });
      }
    }]);
    return WorkerWrapper;
  }();

  var ModuleWrapper = function ModuleWrapper(module, render) {
    classCallCheck(this, ModuleWrapper);

    var instance = module();
    this.render = function (src, options) {
      return new Promise(function (resolve, reject) {
        try {
          resolve(render(instance, src, options));
        } catch (error) {
          reject(error);
        }
      });
    };
  };

  // https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding


  function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode('0x' + p1);
    }));
  }

  function defaultScale() {
    if ('devicePixelRatio' in window && window.devicePixelRatio > 1) {
      return window.devicePixelRatio;
    } else {
      return 1;
    }
  }

  function svgXmlToImageElement(svgXml) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$scale = _ref.scale,
        scale = _ref$scale === undefined ? defaultScale() : _ref$scale,
        _ref$mimeType = _ref.mimeType,
        mimeType = _ref$mimeType === undefined ? "image/png" : _ref$mimeType,
        _ref$quality = _ref.quality,
        quality = _ref$quality === undefined ? 1 : _ref$quality;

    return new Promise(function (resolve, reject) {
      var svgImage = new Image();

      svgImage.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = svgImage.width * scale;
        canvas.height = svgImage.height * scale;

        var context = canvas.getContext("2d");
        context.drawImage(svgImage, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(function (blob) {
          var image = new Image();
          image.src = URL.createObjectURL(blob);
          image.width = svgImage.width;
          image.height = svgImage.height;

          resolve(image);
        }, mimeType, quality);
      };

      svgImage.onerror = function (e) {
        var error;

        if ('error' in e) {
          error = e.error;
        } else {
          error = new Error('Error loading SVG');
        }

        reject(error);
      };

      svgImage.src = 'data:image/svg+xml;base64,' + b64EncodeUnicode(svgXml);
    });
  }

  function svgXmlToImageElementFabric(svgXml) {
    var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref2$scale = _ref2.scale,
        scale = _ref2$scale === undefined ? defaultScale() : _ref2$scale,
        _ref2$mimeType = _ref2.mimeType,
        mimeType = _ref2$mimeType === undefined ? 'image/png' : _ref2$mimeType,
        _ref2$quality = _ref2.quality,
        quality = _ref2$quality === undefined ? 1 : _ref2$quality;

    var multiplier = scale;

    var format = void 0;
    if (mimeType == 'image/jpeg') {
      format = 'jpeg';
    } else if (mimeType == 'image/png') {
      format = 'png';
    }

    return new Promise(function (resolve, reject) {
      fabric.loadSVGFromString(svgXml, function (objects, options) {
        // If there's something wrong with the SVG, Fabric may return an empty array of objects. Graphviz appears to give us at least one <g> element back even given an empty graph, so we will assume an error in this case.
        if (objects.length == 0) {
          reject(new Error('Error loading SVG with Fabric'));
        }

        var element = document.createElement("canvas");
        element.width = options.width;
        element.height = options.height;

        var canvas = new fabric.Canvas(element, { enableRetinaScaling: false });
        var obj = fabric.util.groupSVGElements(objects, options);
        canvas.add(obj).renderAll();

        var image = new Image();
        image.src = canvas.toDataURL({ format: format, multiplier: multiplier, quality: quality });
        image.width = options.width;
        image.height = options.height;

        resolve(image);
      });
    });
  }

  var Viz = function () {
    function Viz() {
      var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          workerURL = _ref3.workerURL,
          worker = _ref3.worker,
          Module = _ref3.Module,
          render = _ref3.render;

      classCallCheck(this, Viz);

      if (typeof workerURL !== 'undefined') {
        this.wrapper = new WorkerWrapper(new Worker(workerURL));
      } else if (typeof worker !== 'undefined') {
        this.wrapper = new WorkerWrapper(worker);
      } else if (typeof Module !== 'undefined' && typeof render !== 'undefined') {
        this.wrapper = new ModuleWrapper(Module, render);
      } else if (typeof Viz.Module !== 'undefined' && typeof Viz.render !== 'undefined') {
        this.wrapper = new ModuleWrapper(Viz.Module, Viz.render);
      } else {
        throw new Error('Must specify workerURL or worker option, Module and render options, or include one of full.render.js or lite.render.js after viz.js.');
      }
    }

    createClass(Viz, [{
      key: 'renderString',
      value: function renderString(src) {
        var _ref4 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
            _ref4$format = _ref4.format,
            format = _ref4$format === undefined ? 'svg' : _ref4$format,
            _ref4$engine = _ref4.engine,
            engine = _ref4$engine === undefined ? 'dot' : _ref4$engine,
            _ref4$files = _ref4.files,
            files = _ref4$files === undefined ? [] : _ref4$files,
            _ref4$images = _ref4.images,
            images = _ref4$images === undefined ? [] : _ref4$images,
            _ref4$yInvert = _ref4.yInvert,
            yInvert = _ref4$yInvert === undefined ? false : _ref4$yInvert,
            _ref4$nop = _ref4.nop,
            nop = _ref4$nop === undefined ? 0 : _ref4$nop;

        for (var i = 0; i < images.length; i++) {
          files.push({
            path: images[i].path,
            data: '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg width="' + images[i].width + '" height="' + images[i].height + '"></svg>'
          });
        }

        return this.wrapper.render(src, { format: format, engine: engine, files: files, images: images, yInvert: yInvert, nop: nop });
      }
    }, {
      key: 'renderSVGElement',
      value: function renderSVGElement(src) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        return this.renderString(src, _extends({}, options, { format: 'svg' })).then(function (str) {
          var parser = new DOMParser();
          return parser.parseFromString(str, 'image/svg+xml').documentElement;
        });
      }
    }, {
      key: 'renderImageElement',
      value: function renderImageElement(src) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var scale = options.scale,
            mimeType = options.mimeType,
            quality = options.quality;


        return this.renderString(src, _extends({}, options, { format: 'svg' })).then(function (str) {
          if ((typeof fabric === 'undefined' ? 'undefined' : _typeof(fabric)) === "object" && fabric.loadSVGFromString) {
            return svgXmlToImageElementFabric(str, { scale: scale, mimeType: mimeType, quality: quality });
          } else {
            return svgXmlToImageElement(str, { scale: scale, mimeType: mimeType, quality: quality });
          }
        });
      }
    }, {
      key: 'renderJSONObject',
      value: function renderJSONObject(src) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var format = options.format;


        if (format !== 'json' || format !== 'json0') {
          format = 'json';
        }

        return this.renderString(src, _extends({}, options, { format: format })).then(function (str) {
          return JSON.parse(str);
        });
      }
    }]);
    return Viz;
  }();

  return Viz;

})));

// WebRTC adapter with cross-browser support
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.adapter = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Shimming starts here.
(function() {
  // Utils.
  var logging = false;
  var browserDetails = {
    browser: null,
    version: null,
    isEdge: false,
    isChrome: false,
    isFirefox: false,
    isSafari: false
  };

  var getUserMedia_ = null;

  var webrtcDetectedBrowser = null;
  var webrtcDetectedVersion = null;

  function trace(text) {
    if (logging && (typeof console !== 'undefined')) {
      console.log(((window.performance.now() / 1000).toFixed(3)) + ': ' + text);
    }
  }

  // Detect browser type and version.
  var userAgent = window.navigator.userAgent.toLowerCase();
  if (userAgent.indexOf('edge/') !== -1) {
    browserDetails.browser = 'edge';
    browserDetails.isEdge = true;
  } else if (userAgent.indexOf('chrome') !== -1) {
    browserDetails.browser = 'chrome';
    browserDetails.isChrome = true;
  } else if (userAgent.indexOf('firefox') !== -1) {
    browserDetails.browser = 'firefox';
    browserDetails.isFirefox = true;
  } else if (userAgent.indexOf('safari') !== -1) {
    browserDetails.browser = 'safari';
    browserDetails.isSafari = true;
  }

  // Get browser version.
  var match = userAgent.match(/(edge|chrome|firefox|safari)\\/(\\d+)/i);
  if (match && match[2]) {
    browserDetails.version = parseInt(match[2], 10);
  }

  // Logging.
  webrtcDetectedBrowser = browserDetails.browser;
  webrtcDetectedVersion = browserDetails.version;

  if (typeof window === 'undefined' || !window.navigator) {
    return;
  }

  if (window.navigator.mediaDevices === undefined) {
    window.navigator.mediaDevices = {};
  }

  // getUserMedia constraints shim.
  var constraintsToChrome_ = function(c) {
    if (typeof c !== 'object' || c.mandatory || c.optional) {
      return c;
    }
    var cc = {};
    Object.keys(c).forEach(function(key) {
      if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
        return;
      }
      var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
      if (r.exact !== undefined && typeof r.exact === 'number') {
        r.min = r.max = r.exact;
      }
      var oldname_ = function(prefix, name) {
        if (prefix) {
          return prefix + name.charAt(0).toUpperCase() + name.slice(1);
        }
        return (name === 'deviceId') ? 'sourceId' : name;
      };
      if (r.ideal !== undefined) {
        cc.optional = cc.optional || [];
        var oc = {};
        if (typeof r.ideal === 'number') {
          oc[oldname_('min', key)] = r.ideal;
          cc.optional.push(oc);
          oc = {};
          oc[oldname_('max', key)] = r.ideal;
          cc.optional.push(oc);
        } else {
          oc[oldname_('', key)] = r.ideal;
          cc.optional.push(oc);
        }
      }
      if (r.exact !== undefined && typeof r.exact !== 'number') {
        cc.mandatory = cc.mandatory || {};
        cc.mandatory[oldname_('', key)] = r.exact;
      } else {
        ['min', 'max'].forEach(function(mix) {
          if (r[mix] !== undefined) {
            cc.mandatory = cc.mandatory || {};
            cc.mandatory[oldname_(mix, key)] = r[mix];
          }
        });
      }
    });
    if (c.advanced) {
      cc.optional = (cc.optional || []).concat(c.advanced);
    }
    return cc;
  };

  getUserMedia_ = function(constraints, onSuccess, onError) {
    if (browserDetails.version >= 61) {
      return navigator.mediaDevices.getUserMedia(constraints).
          then(onSuccess, onError);
    }

    constraints = JSON.parse(JSON.stringify(constraints));
    if (browserDetails.isChrome) {
      var chromever = browserDetails.version;
      var maxver = 64;
      if (chromever >= 61 && chromever < maxver) {
        if (constraints.video) {
          constraints.video = constraintsToChrome_(constraints.video);
        }
      }
    }

    // Get native getUserMedia
    var getUserMediaFunc = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

    if (!getUserMediaFunc) {
      return Promise.reject(
          new Error('getUserMedia is not implemented in this browser'));
    }

    return new Promise(function(resolve, reject) {
      getUserMediaFunc.call(navigator, constraints, resolve, reject);
    }).then(onSuccess, onError);
  };

  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = getUserMedia_;
  }

  // Dummy devicechange event methods.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
    navigator.mediaDevices.addEventListener = function() {
      trace('Dummy mediaDevices.addEventListener called.');
    };
  }
  if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
    navigator.mediaDevices.removeEventListener = function() {
      trace('Dummy mediaDevices.removeEventListener called.');
    };
  }

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    element.srcObject = stream;
  };

  reattachMediaStream = function(to, from) {
    to.srcObject = from.srcObject;
  };

})();

// Export to the adapter global object visible in the browser.
module.exports = {
  browserDetails: browserDetails,
  extractVersion: extractVersion,
  disableLog: disableLog,
  disableWarnings: disableWarnings
};


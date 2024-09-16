/* eslint-disable */
// @ts-nocheck

/*!
 *	dotdotdot JS 4.1.0
 *
 *	dotdotdot.frebsite.nl
 *
 *	Copyright (c) Fred Heusschen
 *	www.frebsite.nl
 *
 *	License: CC-BY-NC-4.0
 *	http://creativecommons.org/licenses/by-nc/4.0/
 */

/** An object with any value. */
interface dddLooseObject {
  [key: string]: any;
}

/** An object with function values. */
interface dddFunctionObject {
  [key: string]: Function;
}

/** Default options for the class. */
interface dddOptions {
  /** The ellipsis to place after the truncated text. */
  ellipsis?: string;

  /** Function to invoke after the truncate process. */
  callback?: Function;

  /** How to truncate: 'node', 'word' (default) or 'letter'. */
  truncate?: string;

  /** Optional tolerance for the container height. */
  tolerance?: number;

  /** Selector for elements not to remove from the DOM. */
  keep?: string;

  /** Whether and when to update the ellipsis: null, true or 'window' (default) */
  watch?: string;

  /** The height for the container. If null, the max-height will be read from the CSS properties. */
  height?: number;
}

/**
* Class for a multiline ellipsis.
*/
export default class Dotdotdot {
  /**	Plugin version. */
  static version: string = '4.1.0';

  /**	Default options. */
  static options: dddOptions = {
      ellipsis: '\u2026 ',
      callback: function (isTruncated) {},
      truncate: 'word',
      tolerance: 0,
      keep: null,
      watch: 'window',
      height: null,
  };

  /** Element to truncate */
  container: HTMLElement;

  /** Inner element, added for measuring. */
  innerContainer: HTMLElement;

  /** Options. */
  options: dddOptions;

  /** The max-height for the element. */
  maxHeight: number;

  /** The ellipsis to use for truncating. */
  ellipsis: Text;

  /** The API */
  API: dddFunctionObject;

  /** Storage for the watch timeout, oddly it has a number type. */
  watchTimeout: number;

  /** Storage for the watch interval, oddly it has a number type. */
  watchInterval: number;

  /** Storage for the original style attribute. */
  originalStyle: string;

  /** Storage for the original HTML. */
  originalContent: Node[];

  /** Function to invoke on window resize. Needs to be stored so it can be removed later on. */
  resizeEvent: EventListener;

  /**
   * Truncate a multiline element with an ellipsis.
   *
   * @param {HTMLElement} 	container						The element to truncate.
   * @param {object} 			[options=Dotdotdot.options]		Options for the menu.
   */
  constructor(
      container: HTMLElement,
      options: dddOptions = Dotdotdot.options
  ) {
      this.container = container;
      this.options = options || {};

      //	Set the watch timeout and -interval;
      this.watchTimeout = null;
      this.watchInterval = null;

      //	Set the resize event handler.
      this.resizeEvent = null;

      //	Extend the specified options with the default options.
      for (let option in Dotdotdot.options) {
          if (!Dotdotdot.options.hasOwnProperty(option)) {
              continue;
          }

          if (typeof this.options[option] == 'undefined') {
              this.options[option] = Dotdotdot.options[option];
          }
      }

      //	If the element allready is a dotdotdot instance.
      //		-> Destroy the previous instance.
      var oldAPI = this.container['dotdotdot'];
      if (oldAPI) {
          oldAPI.destroy();
      }

      //	Create the API.
      this.API = {};
      ['truncate', 'restore', 'destroy', 'watch', 'unwatch'].forEach((fn) => {
          this.API[fn] = () => {
              return this[fn].call(this);
          };
      });

      //	Store the API.
      this.container['dotdotdot'] = this.API;

      //	Store the original style attribute;
      this.originalStyle = this.container.getAttribute('style') || '';

      //	Collect the original contents.
      this.originalContent = this._getOriginalContent();

      //	Create the ellipsis Text node.
      this.ellipsis = document.createTextNode(this.options.ellipsis);

      //	Set CSS properties for the container.
      var computedStyle = window.getComputedStyle(this.container);
      if (computedStyle['word-wrap'] !== 'break-word') {
          this.container.style['word-wrap'] = 'break-word';
      }
      if (computedStyle['white-space'] === 'pre') {
          this.container.style['white-space'] = 'pre-wrap';
      } else if (computedStyle['white-space'] === 'nowrap') {
          this.container.style['white-space'] = 'normal';
      }

      //	Set the max-height for the container.
      if (this.options.height === null) {
          this.options.height = this._getMaxHeight();
      }

      //	Truncate the text.
      this.truncate();

      //	Set the watch.
      if (this.options.watch) {
          this.watch();
      }
  }

  /**
   *	Restore the container to a pre-init state.
   */
  restore() {
      //	Stop the watch.
      this.unwatch();

      //	Restore the original style.
      this.container.setAttribute('style', this.originalStyle);

      //	Restore the original classname.
      this.container.classList.remove('ddd-truncated');

      //	Restore the original contents.
      this.container.innerHTML = '';
      this.originalContent.forEach((element) => {
          this.container.append(element);
      });
  }

  /**
   * Fully destroy the plugin.
   */
  destroy() {
      this.restore();
      this.container['dotdotdot'] = null;
  }

  /**
   * Start a watch for the truncate process.
   */
  watch() {
      //	Stop any previous watch.
      this.unwatch();

      /**	The previously measure sizes. */
      var oldSizes = {
          width: null,
          height: null,
      };

      /**
       * Measure the sizes and start the truncate proces.
       */
      var watchSizes = (
          element: Window | HTMLElement,
          width: string,
          height: string
      ) => {
          //	Only if the container is visible.
          if (
              this.container.offsetWidth ||
              this.container.offsetHeight ||
              this.container.getClientRects().length
          ) {
              let newSizes = {
                  width: element[width],
                  height: element[height],
              };

              if (
                  oldSizes.width != newSizes.width ||
                  oldSizes.height != newSizes.height
              ) {
                  this.truncate();
              }

              return newSizes;
          }
          return oldSizes;
      };

      //	Update onWindowResize.
      if (this.options.watch === 'window') {
          this.resizeEvent = (evnt) => {
              //	Debounce the resize event to prevent it from being called very often.
              if (this.watchTimeout) {
                  clearTimeout(this.watchTimeout);
              }

              this.watchTimeout = setTimeout(() => {
                  oldSizes = watchSizes(window, 'innerWidth', 'innerHeight');
              }, 100);
          };

          window.addEventListener('resize', this.resizeEvent);

          //	Update in an interval.
      } else {
          this.watchInterval = setInterval(() => {
              oldSizes = watchSizes(
                  this.container,
                  'clientWidth',
                  'clientHeight'
              );
          }, 1000);
      }
  }

  /**
   * Stop the watch.
   */
  unwatch() {
      //	Stop the windowResize handler.
      if (this.resizeEvent) {
          window.removeEventListener('resize', this.resizeEvent);
          this.resizeEvent = null;
      }

      //	Stop the watch interval.
      if (this.watchInterval) {
          clearInterval(this.watchInterval);
      }

      //	Stop the watch timeout.
      if (this.watchTimeout) {
          clearTimeout(this.watchTimeout);
      }
  }

  /**
   * Start the truncate process.
   */
  truncate() {
      var isTruncated = false;

      //	Fill the container with all the original content.
      this.container.innerHTML = '';
      this.originalContent.forEach((element) => {
          this.container.append(element);
      });

      //	Get the max height.
      this.maxHeight = this._getMaxHeight();

      //	Truncate the text.
      if (!this._fits()) {
          isTruncated = true;
          this._truncateToNode(this.container);
      }

      //	Add a class to the container to indicate whether or not it is truncated.
      this.container.classList[isTruncated ? 'add' : 'remove'](
          'ddd-truncated'
      );

      //	Invoke the callback.
      this.options.callback.call(this.container, isTruncated);

      return isTruncated;
  }

  /**
   * Truncate an element by removing elements from the end.
   *
   * @param {HTMLElement} element The element to truncate.
   */
  _truncateToNode(element: HTMLElement) {
      var _coms = [],
          _elms = [];

      //	Empty the element
      //		-> replace all contents with comments
      Dotdotdot.$.contents(element).forEach((element) => {
          if (
              element.nodeType != 1 ||
              !(element as HTMLElement).matches('.ddd-keep')
          ) {
              let comment = document.createComment('');
              (element as HTMLElement).replaceWith(comment);

              _elms.push(element);
              _coms.push(comment);
          }
      });

      if (!_elms.length) {
          return;
      }

      //	Re-fill the element
      //		-> replace comments with contents until it doesn't fit anymore.
      for (var e = 0; e < _elms.length; e++) {
          _coms[e].replaceWith(_elms[e]);

          let ellipsis = this.ellipsis.cloneNode(true);

          switch (_elms[e].nodeType) {
              case 1:
                  _elms[e].append(ellipsis);
                  break;

              case 3:
                  _elms[e].after(ellipsis);
                  break;
          }

          let fits = this._fits();
          ellipsis.parentElement.removeChild(ellipsis);

          if (!fits) {
              if (this.options.truncate == 'node' && e > 1) {
                  _elms[e - 2].remove();
                  return;
              }
              break;
          }
      }

      //	Remove left over comments.
      for (var c = e; c < _coms.length; c++) {
          _coms[c].remove();
      }

      //	Get last element
      //		-> the element that overflows.

      var _last = _elms[Math.max(0, Math.min(e, _elms.length - 1))];

      //	Border case
      //		-> the last node with only an ellipsis in it...
      if (_last.nodeType == 1) {
          let element = document.createElement(_last.nodeName);
          element.append(this.ellipsis);

          _last.replaceWith(element);

          //	... fits
          //		-> Restore the full last element.
          if (this._fits()) {
              element.replaceWith(_last);

              //	... doesn't fit
              //		-> remove it and go back one element.
          } else {
              element.remove();
              _last = _elms[Math.max(0, e - 1)];
          }
      }

      //	Proceed inside last element.
      if (_last.nodeType == 1) {
          this._truncateToNode(_last);
      } else {
          this._truncateToWord(_last);
      }
  }

  /**
   * Truncate a sentence by removing words from the end.
   *
   * @param {HTMLElement} element The element to truncate.
   */
  _truncateToWord(element: HTMLElement) {
      var text = element.textContent,
          seporator = text.indexOf(' ') !== -1 ? ' ' : '\u3000',
          words = text.split(seporator);

      for (var a = words.length; a >= 0; a--) {
          element.textContent = this._addEllipsis(
              words.slice(0, a).join(seporator)
          );

          if (this._fits()) {
              if (this.options.truncate == 'letter') {
                  element.textContent = words.slice(0, a + 1).join(seporator);
                  this._truncateToLetter(element);
              }
              break;
          }
      }
  }

  /**
   * Truncate a word by removing letters from the end.
   *
   * @param 	{HTMLElement} element The element to truncate.
   */
  _truncateToLetter(element: HTMLElement) {
      var letters = element.textContent.split(''),
          text = '';

      for (var a = letters.length; a >= 0; a--) {
          text = letters.slice(0, a).join('');

          if (!text.length) {
              continue;
          }

          element.textContent = this._addEllipsis(text);

          if (this._fits()) {
              break;
          }
      }
  }

  /**
   * Test if the content fits in the container.
   *
   * @return {boolean} Whether or not the content fits in the container.
   */
  _fits(): boolean {
      return (
          this.container.scrollHeight <=
          this.maxHeight + this.options.tolerance
      );
  }

  /**
   * Add the ellipsis to a text.
   *
   * @param 	{string} text 	The text to add the ellipsis to.
   * @return	{string}		The text with the added ellipsis.
   */
  _addEllipsis(text: string): string {
      var remove = [' ', '\u3000', ',', ';', '.', '!', '?'];

      while (remove.indexOf(text.slice(-1)) > -1) {
          text = text.slice(0, -1);
      }
      text += this.ellipsis.textContent;

      return text;
  }

  /**
   * Sanitize and collect the original contents.
   *
   * @return {array} The sanitizes HTML elements.
   */
  _getOriginalContent(): HTMLElement[] {
      let keep = 'script, style';
      if (this.options.keep) {
          keep += ', ' + this.options.keep;
      }

      //	Add "keep" class to nodes to keep.
      Dotdotdot.$.find(keep, this.container).forEach((elem) => {
          elem.classList.add('ddd-keep');
      });

      /** Block level HTML tags. */
      let _block_tags_ =
          'div, section, article, header, footer, p, h1, h2, h3, h4, h5, h6, table, td, td, dt, dd, li';

      /** HTML tags that only have block level children. */
      let _block_parents_ =
          'table, thead, tbody, tfoot, tr, dl, ul, ol, video';

      [this.container, ...Dotdotdot.$.find('*', this.container)].forEach(
          (element) => {
              //	Removes empty Text nodes and joins adjacent Text nodes.
              element.normalize();

              //  Remove comments first
              Dotdotdot.$.contents(element).forEach((text) => {
                  if (text.nodeType == 8) {
                      element.removeChild(text);
                  }
              });

              //	Loop over all contents and remove nodes that can be removed.
              Dotdotdot.$.contents(element).forEach((text) => {
                  //	Remove Text nodes that do not take up space in the DOM.
                  //	This kinda asumes a default display property for the elements in the container.
                  if (text.nodeType == 3) {
                      if (text.textContent.trim() == '') {
                          let prev = text.previousSibling as HTMLElement,
                              next = text.nextSibling as HTMLElement;

                          if (
                              text.parentElement.matches(_block_parents_) ||
                              !prev ||
                              (prev.nodeType == 1 &&
                                  prev.matches(_block_tags_)) ||
                              !next ||
                              (next.nodeType == 1 &&
                                  next.matches(_block_tags_))
                          ) {
                              element.removeChild(text);
                          }
                      }
                  }
              });
          }
      );

      //	Create a clone of all contents.
      let content = [];
      Dotdotdot.$.contents(this.container).forEach((element) => {
          content.push(element);
      });

      return content;
  }

  /**
   * Find the max-height for the container.
   *
   * @return {number} The max-height for the container.
   */
  _getMaxHeight(): number {
      if (typeof this.options.height == 'number') {
          return this.options.height;
      }

      var style = window.getComputedStyle(this.container);

      //	Find smallest CSS height
      var properties = ['maxHeight', 'height'],
          height = 0;

      for (var a = 0; a < properties.length; a++) {
          let property = style[properties[a]];
          if (property.slice(-2) == 'px') {
              height = parseFloat(property);
              break;
          }
      }

      //	Remove padding-top/bottom when needed.
      if (style.boxSizing == 'border-box') {
          properties = [
              'borderTopWidth',
              'borderBottomWidth',
              'paddingTop',
              'paddingBottom',
          ];

          for (var a = 0; a < properties.length; a++) {
              let property = style[properties[a]];
              if (property.slice(-2) == 'px') {
                  height -= parseFloat(property);
              }
          }
      }

      //	Sanitize
      return Math.max(height, 0);
  }

  /** DOM traversing functions to uniform datatypes. */
  static $ = {
      /**
       * Find elements by a query selector in an element.
       *
       * @param {string}		selector 			The selector to search for.
       * @param {HTMLElement}	[element=document]	The element to search in.
       * @return {array} 							The found elements.
       */
      find: (
          selector: string,
          element?: HTMLElement | Document
      ): HTMLElement[] => {
          element = element || document;
          return Array.prototype.slice.call(
              element.querySelectorAll(selector)
          );
      },

      /**
       * Collect child nodes (HTML elements and TextNodes) in an element.
       *
       * @param {HTMLElement}	[element=document]	The element to search in.
       * @return {array} 							The found nodes.
       */
      contents: (element?: HTMLElement | Document): Node[] => {
          element = element || document;
          return Array.prototype.slice.call(element.childNodes);
      },
  };
}
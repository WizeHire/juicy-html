(function() {
    /**
     * Checks whether a value is null or undefined
     */
    function nullOrUndefined(v) {
        return v === null || v === undefined;
    }

    var isSafari = navigator.vendor && navigator.vendor.indexOf("Apple") > -1 && navigator.userAgent && !navigator.userAgent.match("CriOS");

    class JuicyHTMLElement extends HTMLElement {
        static get observedAttributes() {
            return ['model', 'href', 'html'];
        }
        constructor(self) {
            self = super(self);
            var model = null; // XXX(tomalec): || this.model ? // to consider for https://github.com/Juicy/juicy-html/issues/30
            Object.defineProperties(this, {
                'model': {
                    set: function(newValue) {
                        model = newValue;
                        this.attachModel(newValue);
                    },
                    get: function() {
                        return model;
                    }
                }
            });
        }
        // Attributes reflection
        get href() {
            return this.getAttribute('href');
        }
        set href(newValue) {
            if (nullOrUndefined(newValue)) {
                this.removeAttribute('href');
            } else {
                this.setAttribute('href', newValue);
            }
        }
        get html() {
            return this.getAttribute('html');
        }
        set html(newValue) {
            if (nullOrUndefined(newValue)) {
                this.removeAttribute('html');
            } else {
                this.setAttribute('html', newValue);
            }
        }
        /** Autostamp on connected */
        connectedCallback() {
            this.isAttached = true;
            // Workaround for lack of inertness as for `<tempalte is="juicy-html">`.
            // Bellow is cheaper and simmpler than attaching shadow with display none
            // it does not give exactly the same behavior, but hopefully nobody would like to make it block.
            this.style.display = 'none';
            // autostamp
            // TODO(tomalec): read pre-upgrade properties in cheap manner
            this.hasAttribute('href') && this.attributeChangedCallback('href', null, this.getAttribute('href'));
            this.hasAttribute('html') && this.attributeChangedCallback('html', null, this.getAttribute('html'));
        }
        disconnectedCallback() {
            this.isAttached = false;
            this.clear();
        }
        /**
         * Skips/disregards pending request if any.
         */
        skipStampingPendingFile() {
            if (this.pending) {
                this.pending.onload = null;
            }
        }
        /**
         * Load the partial from the HTTP server/cache, via XHR.
         * @param  {String} url relative/absolute string to load the resource
         */
        _loadExternalFile(url) {
            var oReq = new XMLHttpRequest();
            var that = this;
            this.pending = oReq;
            oReq.onload = function(event) {
                that.pending = null;
                that.reattachTemplate_(event.target.responseText, oReq.status);
            };
            oReq.open("GET", url, true);
            oReq.send();
        }

        reattachTemplate_(html, statusCode) {
            this.clear();
            if (html === '') {
                if (statusCode === 204) {
                    console.info('no content was returned for juicy-html', this);
                } else {
                    console.warn('href given for juicy-html is an empty file', this);
                }
            }
            // fragmentFromString(strHTML) from http://stackoverflow.com/a/25214113/868184
            var range = document.createRange();

            // Safari does not support `createContextualFragment` without selecting a node.
            if (isSafari) {
                range.selectNode(this);
            }

            var fragment = range.createContextualFragment(html);
            // convert dynamic NodeList to regullar array
            this.stampedNodes = Array.prototype.slice.call(fragment.childNodes);
            // attach models
            this.attributeChangedCallback("model", undefined, this.model || this.getAttribute("model"));
            this.parentNode.insertBefore(fragment, this.nextSibling);
            this.dispatchEvent(new CustomEvent("stamped", {
                detail: this.stampedNodes
            }));

        }

        /**
         * Remove stamped nodes.
         */
        clear() {
            var parent = this.parentNode;
            var childNo = this.stampedNodes && this.stampedNodes.length || 0;
            var child;
            while (childNo--) {
                // this.stampedNodes[childNo].remove();
                child = this.stampedNodes[childNo];
                if (child.parentNode) {
                    child.parentNode.removeChild(child);
                }
            }
            // forget the removed nodes
            this.stampedNodes = null;
        }

        attributeChangedCallback(name, oldVal, newVal) {
            if (this.isAttached) {
                switch (name) {
                    case "model":
                        if (typeof newVal === "string") {
                            newVal = newVal ? JSON.parse(newVal) : null;
                        }
                        this.model = newVal;
                        break;
                    case "href":
                        // skip pending request
                        this.skipStampingPendingFile();
                        if (newVal !== null) {
                            this.removeAttribute('html');
                            this._loadExternalFile(newVal);
                        } else {
                            this.clear();
                        }
                        break;
                    case "html":
                        if (newVal !== null) {
                            this.removeAttribute('href');
                            this.reattachTemplate_(newVal);
                        } else {
                            this.clear();
                        }
                        break;
                }
            }
        }

        attachModel(model, arrayOfElements) {
            arrayOfElements || (arrayOfElements = this.stampedNodes);
            if (model === null || !arrayOfElements) {
                return;
            }
            for (var childNo = 0; childNo < arrayOfElements.length; childNo++) {
                arrayOfElements[childNo].model = model;
            }
        }
    };
    /**
     * Reference to pending request
     * @type {XMLHttpRequest}
     */
    JuicyHTMLElement.prototype.pending = null;
    /**
     * Array of stamped nodes
     * @type {Array}
     */
    JuicyHTMLElement.prototype.stampedNodes = null;
    /**
     * @type {Boolean}
     */
    JuicyHTMLElement.prototype.isAttached = false;

    customElements.define('juicy-html', JuicyHTMLElement);
})();

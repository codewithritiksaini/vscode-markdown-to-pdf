(function() {
  const params = new URLSearchParams(window.location.search);
  const fileId = params.get('file');
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const wsUri = protocol + window.location.host + '/ws?file=' + encodeURIComponent(fileId);
  
  let socket;
  let reconnectDelay = 1000;
  let retryCount = 0;
  const maxRetries = 6;
  let lastSeq = 0;
  let heartbeatTimeout;

  function logToServer(level, message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'log',
        level: level,
        message: message
      }));
    }
  }

  function resetHeartbeat() {
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(() => {
      logToServer('warn', 'Heartbeat timeout. Reconnecting...');
      if (socket) {
        try { socket.close(); } catch(e) {}
      }
    }, 25000); // 25 seconds timeout window
  }

  function reinitializeComponents(cardEl) {
    if (!cardEl) return;

    // highlight.js: Scoped to matching container targets
    if (window.hljs) {
      try {
        const elements = cardEl.querySelectorAll('pre code, .hljs');
        if (elements.length > 0) {
          elements.forEach((el) => {
            if (typeof window.hljs.highlightElement === 'function') {
              window.hljs.highlightElement(el);
            } else if (typeof window.hljs.highlightBlock === 'function') {
              window.hljs.highlightBlock(el);
            }
          });
        }
      } catch (e) {
        logToServer('error', 'hljs reinit failed: ' + e.message);
      }
    }

    // Mermaid diagrams: Scoped to matching container nodes
    if (window.mermaid) {
      try {
        const nodes = cardEl.querySelectorAll('.mermaid');
        if (nodes.length > 0) {
          if (typeof window.mermaid.run === 'function') {
            window.mermaid.run({ nodes: nodes });
          } else if (typeof window.mermaid.init === 'function') {
            window.mermaid.init(undefined, nodes);
          }
        }
      } catch (e) {
        logToServer('error', 'mermaid reinit failed: ' + e.message);
      }
    }

    // MathJax typesetting: Scoped to preview container
    if (window.MathJax) {
      try {
        const hasMath = cardEl.querySelector('.math, .katex, [class*="math"]') || 
                        cardEl.innerHTML.includes('$$') || 
                        cardEl.innerHTML.includes('\\\\(') || 
                        cardEl.innerHTML.includes('\\\\[');
        if (hasMath) {
          if (typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([cardEl]);
          } else if (typeof window.MathJax.typeset === 'function') {
            window.MathJax.typeset([cardEl]);
          } else if (window.MathJax.Hub && typeof window.MathJax.Hub.Queue === 'function') {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, cardEl]);
          }
        }
      } catch (e) {
        logToServer('error', 'MathJax reinit failed: ' + e.message);
      }
    }

    // KaTeX: Scoped math element rendering
    if (window.renderMathInElement) {
      try {
        if (cardEl.querySelector('.math, [class*="math"]')) {
          window.renderMathInElement(cardEl);
        }
      } catch (e) {
        logToServer('error', 'KaTeX reinit failed: ' + e.message);
      }
    }
  }

  function morph(src, dst) {
    // Fast-path subtree skipping
    if (src.isEqualNode(dst)) return;

    if (src.nodeType === Node.TEXT_NODE || src.nodeType === Node.COMMENT_NODE) {
      if (dst.nodeValue !== src.nodeValue) {
        dst.nodeValue = src.nodeValue;
      }
      return;
    }

    if (src.nodeType !== Node.ELEMENT_NODE) return;

    if (src.nodeName !== dst.nodeName) {
      dst.parentNode.replaceChild(dst.ownerDocument.importNode(src, true), dst);
      return;
    }

    // Preserve Canvas elements
    if (dst.nodeName === 'CANVAS') {
      // Morph attributes only
      const srcAttrs = src.attributes;
      const dstAttrs = dst.attributes;
      for (let i = dstAttrs.length - 1; i >= 0; i--) {
        const attr = dstAttrs[i];
        if (!src.hasAttribute(attr.name)) {
          dst.removeAttribute(attr.name);
        }
      }
      for (let i = 0; i < srcAttrs.length; i++) {
        const attr = srcAttrs[i];
        if (dst.getAttribute(attr.name) !== attr.value) {
          dst.setAttribute(attr.name, attr.value);
        }
      }
      return;
    }

    // Save details open state
    const isDetailsOpen = dst.nodeName === 'DETAILS' ? dst.open : false;

    // Save media playback state
    let wasPaused = false;
    let playedTime = 0;
    let rate = 1;
    let vol = 1;
    let isMuted = false;
    let mediaSrcChanged = false;
    let absoluteNewSrc = '';

    if (dst.nodeName === 'VIDEO' || dst.nodeName === 'AUDIO') {
      wasPaused = dst.paused;
      playedTime = dst.currentTime;
      rate = dst.playbackRate;
      vol = dst.volume;
      isMuted = dst.muted;

      const currentSrc = dst.src;
      const newSrcAttr = src.getAttribute('src') || '';
      if (newSrcAttr) {
        try {
          absoluteNewSrc = new URL(newSrcAttr, window.location.href).href;
        } catch (e) {
          absoluteNewSrc = newSrcAttr;
        }
      }
      mediaSrcChanged = (currentSrc !== absoluteNewSrc && newSrcAttr !== '');
    }

    // Reconcile attributes
    const srcAttrs = src.attributes;
    const dstAttrs = dst.attributes;
    for (let i = dstAttrs.length - 1; i >= 0; i--) {
      const attr = dstAttrs[i];
      // Skip resetting media source if it has not changed
      if ((dst.nodeName === 'VIDEO' || dst.nodeName === 'AUDIO') && attr.name === 'src' && !mediaSrcChanged) {
        continue;
      }
      if (!src.hasAttribute(attr.name)) {
        dst.removeAttribute(attr.name);
      }
    }
    for (let i = 0; i < srcAttrs.length; i++) {
      const attr = srcAttrs[i];
      // Skip setting media source if it has not changed
      if ((dst.nodeName === 'VIDEO' || dst.nodeName === 'AUDIO') && attr.name === 'src' && !mediaSrcChanged) {
        continue;
      }
      if (dst.getAttribute(attr.name) !== attr.value) {
        dst.setAttribute(attr.name, attr.value);
      }
    }

    // Preserve focused elements selection/caret
    const isFocused = (document.activeElement === dst);
    let selectionStart = 0;
    let selectionEnd = 0;
    if (isFocused && (dst.nodeName === 'INPUT' || dst.nodeName === 'TEXTAREA')) {
      try {
        selectionStart = dst.selectionStart;
        selectionEnd = dst.selectionEnd;
      } catch (e) {}
    }

    // Preserve states
    if (dst.nodeName === 'INPUT' || dst.nodeName === 'TEXTAREA') {
      if (dst.value !== src.value) {
        dst.value = src.value;
      }
      if (src.checked !== undefined && dst.checked !== src.checked) {
        dst.checked = src.checked;
      }
    } else if (dst.nodeName === 'OPTION') {
      if (dst.selected !== src.selected) {
        dst.selected = src.selected;
      }
    }

    // Preserve nested scroll containers positions
    const scrollTop = dst.scrollTop;
    const scrollLeft = dst.scrollLeft;

    const srcChildren = Array.from(src.childNodes);
    const dstChildren = Array.from(dst.childNodes);
    
    // Key-based matching
    const dstKeys = new Map();
    dstChildren.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE && child.id) {
        dstKeys.set(child.id, child);
      }
    });

    let dstIndex = 0;
    srcChildren.forEach((srcChild) => {
      let dstChild = null;
      if (srcChild.nodeType === Node.ELEMENT_NODE) {
        if (srcChild.id) {
          dstChild = dstKeys.get(srcChild.id);
        }
        // Explicit safeguard to reuse canvas element node and preserve webgl/2d drawing context
        if (!dstChild && srcChild.nodeName === 'CANVAS') {
          dstChild = Array.from(dst.childNodes).find(child => child.nodeName === 'CANVAS' && !child._matched);
        }

        if (dstChild) {
          dstChild._matched = true;
          if (dst.childNodes[dstIndex] !== dstChild) {
            dst.insertBefore(dstChild, dst.childNodes[dstIndex]);
          }
        }
      }

      if (!dstChild) {
        dstChild = dst.childNodes[dstIndex];
      }

      if (!dstChild) {
        dst.appendChild(dst.ownerDocument.importNode(srcChild, true));
      } else if (srcChild.nodeName !== dstChild.nodeName || srcChild.nodeType !== dstChild.nodeType) {
        dst.replaceChild(dst.ownerDocument.importNode(srcChild, true), dstChild);
      } else {
        morph(srcChild, dstChild);
      }
      dstIndex++;
    });

    while (dst.childNodes.length > dstIndex) {
      dst.removeChild(dst.lastChild);
    }

    // Clean up temporary matching properties from canvas nodes
    Array.from(dst.childNodes).forEach(child => {
      if (child.nodeName === 'CANVAS') {
        delete child._matched;
      }
    });

    // Restore scroll positions
    if (dst.scrollTop !== scrollTop) dst.scrollTop = scrollTop;
    if (dst.scrollLeft !== scrollLeft) dst.scrollLeft = scrollLeft;

    // Restore details open state without mutating src node
    if (dst.nodeName === 'DETAILS') {
      if (dst.open !== isDetailsOpen) {
        dst.open = isDetailsOpen;
      }
    }

    // Restore media playback state
    if (dst.nodeName === 'VIDEO' || dst.nodeName === 'AUDIO') {
      if (dst._restoreMediaState) {
        dst.removeEventListener('loadedmetadata', dst._restoreMediaState);
        dst._restoreMediaState = null;
      }

      if (mediaSrcChanged) {
        const restoreState = () => {
          try {
            dst.playbackRate = rate;
            dst.volume = vol;
            dst.muted = isMuted;
            dst.currentTime = playedTime;
            if (!wasPaused && dst.paused) {
              dst.play().catch(() => {});
            }
          } catch (e) {}
          dst.removeEventListener('loadedmetadata', restoreState);
          if (dst._restoreMediaState === restoreState) {
            dst._restoreMediaState = null;
          }
        };
        dst._restoreMediaState = restoreState;
        dst.addEventListener('loadedmetadata', restoreState, { once: true });
      } else {
        try {
          dst.playbackRate = rate;
          dst.volume = vol;
          dst.muted = isMuted;
          if (!wasPaused && dst.paused) {
            dst.play().catch(() => {});
          }
        } catch (e) {}
      }
    }

    // Restore focus and cursor range
    if (isFocused) {
      dst.focus();
      if (dst.nodeName === 'INPUT' || dst.nodeName === 'TEXTAREA') {
        try {
          dst.setSelectionRange(selectionStart, selectionEnd);
        } catch (e) {}
      }
    }
  }

  function connect() {
    socket = new WebSocket(wsUri);
    socket.onopen = function() {
      logToServer('info', 'WebSocket connected browser-side');
      reconnectDelay = 1000;
      retryCount = 0;
      resetHeartbeat();
    };
    socket.onmessage = function(event) {
      const data = JSON.parse(event.data);
      if (data.type === 'ping') {
        resetHeartbeat();
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      if (data.type === 'update') {
        resetHeartbeat();
        if (data.seq && data.seq < lastSeq) {
          return;
        }
        lastSeq = data.seq;

        document.title = data.title + ' — Markdown Preview';
        const filenameEl = document.querySelector('.page-header .filename');
        if (filenameEl) {
          filenameEl.textContent = data.title + '.md';
        }

        const cardEl = document.querySelector('.card');
        if (cardEl) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data.html;

          const srcChildren = Array.from(tempDiv.childNodes);
          let dstIndex = 0;
          srcChildren.forEach((srcChild) => {
            let dstChild = cardEl.childNodes[dstIndex];
            if (!dstChild) {
              cardEl.appendChild(cardEl.ownerDocument.importNode(srcChild, true));
            } else if (srcChild.nodeName !== dstChild.nodeName || srcChild.nodeType !== dstChild.nodeType) {
              cardEl.replaceChild(cardEl.ownerDocument.importNode(srcChild, true), dstChild);
            } else {
              morph(srcChild, dstChild);
            }
            dstIndex++;
          });

          while (cardEl.childNodes.length > dstIndex) {
            cardEl.removeChild(cardEl.lastChild);
          }
        }

        let styleEl = document.getElementById('custom-injected-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'custom-injected-style';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = data.customCSS || '';

        reinitializeComponents(cardEl);
      }
    };
    socket.onclose = function() {
      clearTimeout(heartbeatTimeout);
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(connect, reconnectDelay);
        reconnectDelay *= 2;
      }
    };
    socket.onerror = function(err) {
      // connection loss handled by onclose
    };
  }
  connect();
})();

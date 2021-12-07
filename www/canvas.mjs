import { DPI } from "./config.mjs";

function canvas(id) {
  const _canvas = document.getElementById(id);
  const _gl = _canvas.getContext("webgl2");
  const _resize = () => {
    const { innerWidth: width, innerHeight: height } = window;
    _canvas.width = width * DPI;
    _canvas.height = height * DPI;
    _canvas.style.width = `${width}px`;
    _canvas.style.height = `${height}px`;
  };

  window.addEventListener("resize", () => {
    // TODO: debounce
    _resize();
  });

  window.addEventListener("orientationchange", () => {
    // TODO: debounce
    _resize();
  });

  // Configure webgl context
  // Enable alpha
  _gl.enable(_gl.BLEND);
  _gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
  _gl.disable(_gl.DEPTH_TEST);

  _resize();

  return {
    get gl() {
      return _gl;
    },
    get el() {
      return _canvas;
    },
    get width() {
      return _canvas.width;
    },
    get height() {
      return _canvas.height;
    },
    clear() {
      _gl.viewport(0, 0, _gl.canvas.width, _gl.canvas.height);
      // Set clear color to black, fully opaque
      _gl.clearColor(0.0, 0.0, 0.0, 1.0);
      // Clear the color buffer with specified clear color
      _gl.clear(_gl.COLOR_BUFFER_BIT);
    },
  };
}

export default canvas;

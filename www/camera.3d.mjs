const { mat3, vec2 } = window.glMatrix;

function vec(x, y) {
  return vec2.fromValues(x, y);
}
function getCameraMatrix(x, y, zoom, width, height) {
  const scale = 1 / zoom;
  const mat = mat3.create();
  mat3.translate(mat, mat, vec(x, y));
  mat3.scale(mat, mat, vec(scale, scale));
  // Center viewport on target
  mat3.translate(mat, mat, vec(-width / 2, -height / 2));
  return mat;
}

function getViewProjectionMatrix(x, y, zoom, width, height) {
  const projMatrix = mat3.projection(mat3.create(), width, height);
  const cameraMatrix = getCameraMatrix(x, y, zoom, width, height);
  const viewMatrix = mat3.invert(mat3.create(), cameraMatrix);
  return mat3.multiply(mat3.create(), projMatrix, viewMatrix);
}

function getClipSpacePosition(clientX, clientY, canvas) {
  // Get relative screen position
  const { left, top } = canvas.getBoundingClientRect();
  const screenX = clientX - left;
  const screenY = clientY - top;
  // Get normalized 0 to 1 position across and down canvas
  const normalizedX = screenX / canvas.clientWidth;
  const normalizedY = screenY / canvas.clientHeight;
  // Convert to clip space
  const clipX = normalizedX * 2 - 1;
  const clipY = normalizedY * -2 + 1;
  return [clipX, clipY];
}

function camera(gl, coord = { x: 0, y: 0 }) {
  const _canvas = gl.canvas;
  let _x = coord.x;
  let _y = coord.y;
  let _zoom = 1;
  let _viewProjMatrix = getViewProjectionMatrix(
    _x,
    _y,
    _zoom,
    gl.canvas.width,
    gl.canvas.height
  );

  return {
    get coord() {
      return { x: _x, y: _y };
    },
    get zoom() {
      return _zoom;
    },
    get width() {
      return gl.canvas.width;
    },
    get height() {
      return gl.canvas.height;
    },
    get viewProjMatrix() {
      return _viewProjMatrix;
    },
    // Move to coordinate
    moveTo(x, y) {
      _x = x;
      _y = y;
      _viewProjMatrix = getViewProjectionMatrix(
        _x,
        _y,
        _zoom,
        this.width,
        this.height
      );
    },
    zoomToCenter(zoom) {
      _zoom = zoom;
      _viewProjMatrix = getViewProjectionMatrix(
        _x,
        _y,
        _zoom,
        this.width,
        this.height
      );
    },
    zoomToScreenCoord(clientX, clientY, zoom) {
      const [clipX, clipY] = getClipSpacePosition(clientX, clientY, _canvas);
      // Position before zooming
      const [preZoomX, preZoomY] = vec2.transformMat3(
        vec2.create(),
        vec(clipX, clipY),
        mat3.invert(mat3.create(), _viewProjMatrix)
      );
      // Set zoom
      _zoom = zoom;
      // And get updated view projection
      _viewProjMatrix = getViewProjectionMatrix(
        _x,
        _y,
        _zoom,
        this.width,
        this.height
      );
      // Position after zooming
      const [postZoomX, postZoomY] = vec2.transformMat3(
        vec2.create(),
        vec(clipX, clipY),
        mat3.invert(mat3.create(), _viewProjMatrix)
      );
      // Camera needs to be moved the difference of before and after
      _x += preZoomX - postZoomX;
      _y += preZoomY - postZoomY;
      // Set final view projection
      _viewProjMatrix = getViewProjectionMatrix(
        _x,
        _y,
        _zoom,
        this.width,
        this.height
      );
    },
  };
}

export default camera;

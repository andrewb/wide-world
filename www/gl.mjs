function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.error(`Error: ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initShaderProgram(gl, vs, fs) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vs);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fs);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.error(`Error: ${gl.getProgramInfoLog(program)}`);
    return null;
  }
  return program;
}

function loadTexture(gl, image, idx = 0) {
  const texId = `TEXTURE${idx}`;
  const texture = gl.createTexture();
  gl.activeTexture(gl[texId]);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // No Mipmaps or repeat
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    gl.RGBA, // src format
    gl.UNSIGNED_BYTE, // src type
    image
  );
  return idx;
}

function glsl(strings, ...values) {
  return `#version 300 es
    ${values.reduce((p, v, i) => `${p}${v}${strings[i + 1]}`, strings[0])}
  `;
}

export { glsl, initShaderProgram, loadTexture };

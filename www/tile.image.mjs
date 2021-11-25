import { glsl, initShaderProgram, loadTexture } from "./gl.mjs";

const MAX_BATCH_COUNT = 256 * 256;
const VERTS_PER_QUAD = 6;
const FLOATS_PER_VERT = 2;
const INDICES = [0, 1, 3, 3, 1, 2];
const SPRITES_PER_ROW = 12;
const TEX_X_OFFSET = 1 / SPRITES_PER_ROW;
const TEX_Y_OFFSET = 1 / 5;

const vs = glsl`
  precision highp float;

  in vec2 a_position;
  in vec2 a_tex_coord;

  uniform vec2 u_resolution;
  uniform mat3 u_matrix;

  out vec2 v_tex_coord;

  void main() {
    gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
    v_tex_coord = a_tex_coord;
  }
`;

const fs = glsl`
  precision lowp float;
 
  in vec2 v_tex_coord;

  uniform sampler2D u_image;

  out vec4 out_color;
 
  void main() {
    // DEBUG
    // out_color = vec4(1, 0, 0, 1);
    out_color = texture(u_image, v_tex_coord);
  }
`;

const vertArr = new Float32Array(
  MAX_BATCH_COUNT * VERTS_PER_QUAD * FLOATS_PER_VERT
);

const texArr = new Float32Array(
  MAX_BATCH_COUNT * VERTS_PER_QUAD * FLOATS_PER_VERT
);

let batchCount = 0;

function initTileShader(gl, texture) {
  const program = initShaderProgram(gl, vs, fs);

  const attributes = {
    position: gl.getAttribLocation(program, "a_position"),
    texCoord: gl.getAttribLocation(program, "a_tex_coord"),
  };
  const uniforms = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    matrix: gl.getUniformLocation(program, "u_matrix"),
    image: gl.getUniformLocation(program, "u_image"),
  };
  const buffers = {
    position: gl.createBuffer(),
    texCoord: gl.createBuffer(),
  };

  // Load textures
  const texId = loadTexture(gl, texture, 0);

  const vao = gl.createVertexArray();

  gl.bindVertexArray(vao);

  // Position
  gl.enableVertexAttribArray(attributes.position);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(
    attributes.position,
    2, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    0 // offset
  );

  // Texture
  gl.enableVertexAttribArray(attributes.texCoord);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoord);
  gl.vertexAttribPointer(
    attributes.texCoord,
    2, // size
    gl.FLOAT, // type
    false, // normalize
    0, // stride
    0 // offset
  );

  gl.bindVertexArray(null);

  // Identity matrix
  let _viewProjMatrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  const _flush = () => {
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // Uniforms
    gl.uniform2f(uniforms.resolution, gl.canvas.width, gl.canvas.height);
    gl.uniformMatrix3fv(uniforms.matrix, false, _viewProjMatrix);
    gl.uniform1i(uniforms.image, texId);

    // Position
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, vertArr, gl.STATIC_DRAW);

    // Texture
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoord);
    gl.bufferData(gl.ARRAY_BUFFER, texArr, gl.STATIC_DRAW);

    gl.drawArrays(gl.TRIANGLES, 0, batchCount * VERTS_PER_QUAD);

    gl.bindVertexArray(null);

    batchCount = 0;
  };

  return {
    flush() {
      if (batchCount) {
        _flush();
      }
    },
    add(x, y, l, w, h = 1.0, type = 0) {
      const offset1 = batchCount * VERTS_PER_QUAD * FLOATS_PER_VERT;

      const points = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];

      const tex = [
        [0.0, 0.0],
        [TEX_X_OFFSET, 0.0],
        [TEX_X_OFFSET, TEX_Y_OFFSET],
        [0.0, TEX_Y_OFFSET],
      ];

      for (let i = 0, j = 0; i < INDICES.length; i++, j += 2) {
        const p = points[INDICES[i]];
        // A flat iso tile is twice as wide as it is tall
        // Note, the diagonal edge will match the width of the tile
        // px
        vertArr[offset1 + j] = x + l * 2 * p[0];
        // py
        vertArr[offset1 + j + 1] = y + w * 2 * p[1] - h * (l / 2);

        // Texture
        const t = tex[INDICES[i]];
        const tx = t[0] + (type % SPRITES_PER_ROW) * TEX_X_OFFSET;
        const ty = t[1] + Math.floor(type / SPRITES_PER_ROW) * TEX_Y_OFFSET;
        texArr[offset1 + j] = tx;
        texArr[offset1 + j + 1] = ty;
      }

      batchCount++;

      if (batchCount === MAX_BATCH_COUNT) {
        _flush();
      }
    },
    set viewProjMatrix(mat) {
      _viewProjMatrix = mat;
    },
  };
}

export default initTileShader;

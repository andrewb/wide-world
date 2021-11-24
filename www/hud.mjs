function hud(id) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.textBaseline = "middle";
  return {
    update(text) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillText(text, 4, 16);
    },
  };
}

export default hud;

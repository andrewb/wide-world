// Utils
export function debounce(func, timeout = 1 / 120) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

export function length(p1, p2) {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint(p1, p2) {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  };
}

function point(pointer) {
  let _pointer = pointer;
  let _prevX = _pointer.clientX;
  let _prevY = _pointer.clientY;
  return {
    update(p) {
      _prevX = _pointer.clientX;
      _prevY = _pointer.clientY;
      _pointer = p;
    },
    get delta() {
      const x = _pointer.clientX - _prevX;
      const y = _pointer.clientY - _prevY;
      return {
        x,
        y,
      };
    },
    get velocity() {
      const dT = (performance.now() - _pointer.timeStamp) / 1000;
      const { x: dX, y: dY } = this.delta;
      return {
        x: dX / dT,
        y: dY / dT,
      };
    },
    get curr() {
      return {
        x: _pointer.clientX,
        y: _pointer.clientY,
      };
    },
    get prev() {
      return {
        x: _prevX,
        y: _prevY,
      };
    },
  };
}

function tap(pointer) {
  return {
    get data() {
      return {
        x: pointer.clientX,
        y: pointer.clientY,
      };
    },
  };
}

function pan(pointer) {
  const _point = point(pointer);
  return {
    update(p) {
      _point.update(p);
    },
    get data() {
      const { delta, velocity } = _point;
      return {
        dX: delta.x,
        dY: delta.y,
        vX: velocity.x,
        vY: velocity.y,
      };
    },
  };
}

function gesture(pointer1, pointer2) {
  const _point1 = point(pointer1);
  const _point2 = point(pointer2);
  const _length = length(_point1.curr, _point2.curr);
  const _points = new Map();
  _points.set(pointer1.pointerId, _point1);
  _points.set(pointer2.pointerId, _point2);

  return {
    get scale() {
      const pointers = [..._points.values()].map((p) => p.curr);
      return length(...pointers) / _length;
    },
    get midpoint() {
      return midpoint(_point1.curr, _point2.curr);
    },
    get delta() {
      return [..._points.values()].map((p) => p.delta);
    },
    get deltaXY() {
      const l1 = length(_point1.curr, _point2.curr);
      const l2 = length(_point1.prev, _point2.prev);
      return l1 - l2;
    },
    get deltaMidpoint() {
      const m1 = midpoint(_point1.curr, _point2.curr);
      const m2 = midpoint(_point1.prev, _point2.prev);
      return {
        x: m1.x - m2.x,
        y: m1.y - m2.y,
      };
    },
    get data() {
      return {
        scale: this.scale,
        midpoint: this.midpoint,
        delta: this.delta,
        deltaXY: this.deltaXY,
        deltaMidpoint: this.deltaMidpoint,
      };
    },
    update(pointer) {
      const p = _points.get(pointer.pointerId);
      p.update(pointer);
    },
  };
}

export default function addPointerEvents(target) {
  const events = new Map();

  const callbacks = {
    tap: [],
    pinch: [],
    pinchStart: [],
    pinchEnd: [],
    pan: [],
    panStart: [],
    panEnd: [],
  };

  let _pinch;
  let _pan;
  let _tap;

  function callback(type, e, data) {
    callbacks[type].forEach((cb) =>
      cb({
        preventDefault: e.preventDefault.bind(e),
        ...data,
      })
    );
  }

  const onGestureMove = debounce((e, g) => {
    callback("pinch", e, g.data);
  });

  function onPointerDown(e) {
    events.set(e.pointerId, e);
    if (events.size === 1) {
      _tap = tap(e);
    }
    if (events.size === 2) {
      _tap = undefined;
      _pinch = gesture(...events.values());
      callback("pinchStart", e, _pinch.data);
    }
  }

  function onPointerMove(e) {
    _tap = undefined;

    if (events.size === 0) {
      return;
    }

    if (events.size === 1) {
      if (_pan) {
        _pan.update(e);
        callback("pan", e, _pan.data);
      } else {
        _pan = pan(e);
        callback("panStart", e, _pan.data);
      }
    }

    if (events.size === 2) {
      _pinch.update(e);
      onGestureMove(e, _pinch);
    }

    events.set(e.pointerId, e);
  }

  function onPointerUp(e) {
    if (_tap) {
      callback("tap", e, _tap.data);
    }
    if (_pan) {
      callback("panEnd", e, _pan.data);
    }
    if (_pinch) {
      callback("pinchEnd", e, _pinch.data);
    }
    _tap = undefined;
    _pan = undefined;
    _pinch = undefined;
    events.delete(e.pointerId);
  }

  // Pointer down and move
  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointermove", onPointerMove);
  // Pointer up
  target.addEventListener("pointerup", onPointerUp);
  target.addEventListener("pointercancel", onPointerUp);
  target.addEventListener("pointerleave", onPointerUp);
  target.addEventListener("pointerout", onPointerUp);
  return {
    on: (event, cb) => {
      if (Array.isArray(callbacks[event])) {
        callbacks[event].push(cb);
      }
    },
  };
}

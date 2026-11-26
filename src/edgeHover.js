let _timer = null;

export function edgeEnter(setter, id) {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  setter(id);
}

export function edgeLeave(setter, delay = 180) {
  _timer = setTimeout(() => { setter(null); _timer = null; }, delay);
}

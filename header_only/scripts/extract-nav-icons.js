'use strict';

const fs = require('fs');
const path = require('path');
const { parseFig, resolveVectorNodePaths, transformSvgPathData } = require('openfig-core');
const { svgPathBbox } = require('svg-path-bbox');

const FIG = path.join(__dirname, '../ОК только скопонованное объя изм.2.fig');
const OUT = path.join(__dirname, '../icons/nav');

const doc = parseFig(new Uint8Array(fs.readFileSync(FIG)));
const nodes = doc.message.nodeChanges || [];
const parentMap = new Map();

nodes.forEach(function (n) {
  if (!n.parentIndex || !n.parentIndex.guid) return;
  const pk = n.parentIndex.guid.sessionID + ':' + n.parentIndex.guid.localID;
  if (!parentMap.has(pk)) parentMap.set(pk, []);
  parentMap.get(pk).push(n);
});

function gid(n) {
  if (!n.guid) return null;
  return n.guid.sessionID + ':' + n.guid.localID;
}

function pos(n) {
  const t = n.transform || {};
  return { x: t.m02 || 0, y: t.m12 || 0 };
}

function walk(node, ox, oy, depth, hits) {
  const p = pos(node);
  const ax = ox + p.x;
  const ay = oy + p.y;
  hits.push({
    node: node,
    name: node.name || '',
    type: node.type,
    x: Math.round(ax),
    y: Math.round(ay),
    w: node.size ? Math.round(node.size.x) : 0,
    h: node.size ? Math.round(node.size.y) : 0,
    depth: depth
  });
  (parentMap.get(gid(node)) || []).forEach(function (c) {
    walk(c, ax, ay, depth + 1, hits);
  });
}

function collectPaths(root) {
  const rootPos = { x: 0, y: 0 };
  const paths = [];

  function visit(n, ox, oy) {
    const p = pos(n);
    const nx = ox + p.x;
    const ny = oy + p.y;
    if (n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION') {
      const resolved = resolveVectorNodePaths(doc, n);
      resolved.fill.concat(resolved.stroke).forEach(function (pg) {
        if (!pg.svgPath) return;
        paths.push(transformSvgPathData(pg.svgPath, {
          translateX: nx - rootPos.x,
          translateY: ny - rootPos.y
        }));
      });
    }
    (parentMap.get(gid(n)) || []).forEach(function (c) {
      visit(c, nx, ny);
    });
  }

  visit(root, 0, 0);
  return paths;
}

function normalizePaths(paths) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  paths.forEach(function (d) {
    const bbox = svgPathBbox(d);
    minX = Math.min(minX, bbox[0]);
    minY = Math.min(minY, bbox[1]);
    maxX = Math.max(maxX, bbox[2]);
    maxY = Math.max(maxY, bbox[3]);
  });

  return {
    paths: paths.map(function (d) {
      return transformSvgPathData(d, {
        translateX: -minX,
        translateY: -minY
      });
    }),
    width: Math.max(1, Math.ceil(maxX - minX)),
    height: Math.max(1, Math.ceil(maxY - minY))
  };
}

function exportIcon(root, filename, viewW, viewH) {
  const collected = collectPaths(root);
  if (!collected.length) {
    console.warn('no paths for', filename);
    return false;
  }
  const normalized = normalizePaths(collected);
  const body = normalized.paths.map(function (d) {
    return '<path d="' + d + '" fill="currentColor"/>';
  }).join('\n');
  const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    normalized.width + ' ' + normalized.height + '">\n' +
    body + '\n</svg>';
  fs.writeFileSync(path.join(OUT, filename), svg);
  console.log('wrote', filename, normalized.paths.length, 'paths', normalized.width + 'x' + normalized.height);
  return true;
}

const frame = nodes.filter(function (n) {
  return n.name === 'Frame 268' && n.size && Math.round(n.size.x) === 1920;
}).pop();

const hits = [];
walk(frame, 0, 0, 0, hits);

function findIcon(matchFn) {
  return hits.find(matchFn);
}

const icons = {
  'ads.svg': findIcon(function (h) { return h.name === 'Frame 25555675' && h.w === 28 && h.h === 32; }),
  'letters.svg': findIcon(function (h) { return h.depth === 2 && h.x === 282 && h.y === 13 && h.w === 36 && h.h === 32 && h.name === 'Group'; }),
  'import.svg': findIcon(function (h) { return h.depth === 2 && h.x === 710 && h.y === 13 && h.w === 33 && h.h === 32 && h.name === 'Group'; }),
  'companies.svg': findIcon(function (h) { return h.depth === 2 && h.x === 1028 && h.y === 13 && h.w === 33 && h.h === 32 && h.name === 'Group'; }),
  'resume.svg': findIcon(function (h) { return h.name === 'people-1 1' && h.w === 32 && h.h === 32; }),
  'managers.svg': findIcon(function (h) { return h.depth === 1 && h.x === 1477 && h.y === 12 && h.w === 32 && h.h === 32 && h.name === 'Group'; })
};

fs.mkdirSync(OUT, { recursive: true });

Object.keys(icons).forEach(function (file) {
  const hit = icons[file];
  if (!hit) {
    console.warn('missing', file);
    return;
  }
  exportIcon(hit.node, file, hit.w, hit.h);
});

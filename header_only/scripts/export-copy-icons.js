'use strict';

const fs = require('fs');
const path = require('path');
const { parseFig, resolveVectorNodePaths, transformSvgPathData } = require('openfig-core');
const { svgPathBbox } = require('svg-path-bbox');

const FIG = path.join(__dirname, '../ОК только скопонованное объя изм.2.fig');
const OUT = path.join(__dirname, '../icons/compiled-ads');

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
  return n.guid ? n.guid.sessionID + ':' + n.guid.localID : null;
}

function pos(n) {
  const t = n.transform || {};
  return { x: t.m02 || 0, y: t.m12 || 0 };
}

function roundPath(d) {
  return d.replace(/-?\d+\.\d+/g, function (n) {
    return String(Math.round(Number(n) * 100) / 100);
  });
}

function collectPaths(root, mode) {
  const paths = [];

  function visit(n, ox, oy) {
    const p = pos(n);
    const nx = ox + p.x;
    const ny = oy + p.y;
    if (n.type === 'VECTOR') {
      const resolved = resolveVectorNodePaths(doc, n);
      const list = mode === 'stroke'
        ? (resolved.stroke.length ? resolved.stroke : resolved.fill)
        : resolved.fill;
      list.forEach(function (pg) {
        if (!pg.svgPath) return;
        paths.push(transformSvgPathData(pg.svgPath, {
          translateX: nx,
          translateY: ny
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

function normalizeToBox(paths, boxW, boxH) {
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

  const norm = paths.map(function (d) {
    return transformSvgPathData(d, {
      translateX: -minX,
      translateY: -minY
    });
  });

  return {
    paths: norm.map(roundPath),
    width: boxW || Math.max(1, Math.ceil(maxX - minX)),
    height: boxH || Math.max(1, Math.ceil(maxY - minY))
  };
}

function writeSvg(filename, paths, opts) {
  const normalized = normalizeToBox(paths, opts.boxW, opts.boxH);
  const body = normalized.paths.map(function (d) {
    if (opts.mode === 'stroke') {
      return '<path d="' + d + '" fill="none" stroke="' + opts.color + '" stroke-width="' + opts.strokeWidth + '" stroke-linejoin="round"/>';
    }
    return '<path d="' + d + '" fill="' + opts.color + '"/>';
  }).join('\n  ');
  const svg = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">\n  ' + body + '\n</svg>\n';
  fs.writeFileSync(path.join(OUT, filename), svg);
  console.log('wrote', filename);
}

const copyGroup = nodes.find(function (n) {
  return n.name === 'Group'
    && n.size
    && Math.abs(n.size.x - 20) < 0.2
    && Math.abs((n.transform && n.transform.m12) - 1334) < 1;
});

if (!copyGroup) {
  console.error('copy icon group not found');
  process.exit(1);
}

writeSvg('copy-hover.svg', collectPaths(copyGroup, 'fill'), {
  mode: 'fill',
  color: '#0087FC',
  boxW: 20,
  boxH: 20
});

writeSvg('copy.svg', collectPaths(copyGroup, 'stroke'), {
  mode: 'stroke',
  color: '#0087FC',
  strokeWidth: 1.15,
  boxW: 20,
  boxH: 20
});

writeSvg('copy-purple-hover.svg', collectPaths(copyGroup, 'fill'), {
  mode: 'fill',
  color: '#A006F8',
  boxW: 20,
  boxH: 20
});

writeSvg('copy-purple.svg', collectPaths(copyGroup, 'stroke'), {
  mode: 'stroke',
  color: '#A006F8',
  strokeWidth: 1.15,
  boxW: 20,
  boxH: 20
});

'use strict';
const assert = require('assert');
const path = require('path');
const Svgicons2svgfont = require('svgicons2svgfont');
const svg2ttf = require('svg2ttf');
const ttf2woff = require('ttf2woff');
const Readable = require('stream').Readable;

/**
 * @param  {InputFileSystem} fs      An input file system
 * @param  {String[]} icons          Array of icon file paths
 * @param  {Object} options          SVG-Font options
 * @return {Promise<String>}         Base64 encoded font
 */
module.exports = function createIconFont (fs, icons, options) {
  assert(typeof options === 'object', 'Options are mandatory.');
  icons = icons.map((iconPath) => path.resolve('.', iconPath));
  return new Promise((resolve, reject) => {
    const fontStream = new Svgicons2svgfont({
      name: options.name,
      normalize: true,
      fontHeight: options.enforcedSvgHeight ? options.enforcedSvgHeight : undefined,
      log: function () {},
      error: function (err) {
        reject(err);
      }
    });
    let svgFont = '';
    fontStream
      .on('finish', function () {
        resolve(svgFont);
      })
      .on('data', function (part) {
        svgFont += part;
      })
      .on('error', function (err) {
        reject(err);
      });
    icons.forEach((filename, i) => {
      const glyph = new Readable();
      glyph._read = function noop () {};
      glyph.metadata = {
        unicode: [String.fromCodePoint('\ue000'.charCodeAt(0) + i)],
        name: 'i' + i
      };
      fontStream.write(glyph);
      fs.readFile(filename, function (err, result) {
        if (err) {
          return reject(err);
        }
        result = result.toString();
        // prevent svgs with fill="none" from beeing translated into an empty symbol
        result = result.replace(/\sfill\s*=\s*["']?none['"]?/ig, '');
        glyph.push(result);
        glyph.push(null);
      });
    });
    fontStream.end();
  })
    .then((svgFont) => svg2ttf(svgFont, {}).buffer)
    .then((ttfFont) => ttf2woff(ttfFont).buffer)
    .then((woffFont) => Buffer.from(woffFont).toString('base64'));
};

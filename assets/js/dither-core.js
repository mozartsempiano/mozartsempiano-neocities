(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.DitherCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var VALID_BAYER = { 2: true, 4: true, 8: true, 16: true };

  var BAYER_2X2 = [
    [0, 2],
    [3, 1],
  ];
  var BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  var BAYER_8X8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  var BAYER_16X16 = [
    [0, 128, 32, 160, 8, 136, 40, 168, 2, 130, 34, 162, 10, 138, 42, 170],
    [192, 64, 224, 96, 200, 72, 232, 104, 194, 66, 226, 98, 202, 74, 234, 106],
    [48, 176, 16, 144, 56, 184, 24, 152, 50, 178, 18, 146, 58, 186, 26, 154],
    [240, 112, 208, 80, 248, 120, 216, 88, 242, 114, 210, 82, 250, 122, 218, 90],
    [12, 140, 44, 172, 4, 132, 36, 164, 14, 142, 46, 174, 6, 134, 38, 166],
    [204, 76, 236, 108, 196, 68, 228, 100, 206, 78, 238, 110, 198, 70, 230, 102],
    [60, 188, 28, 156, 52, 180, 20, 148, 62, 190, 30, 158, 54, 182, 22, 150],
    [252, 124, 220, 92, 244, 116, 212, 84, 254, 126, 222, 94, 246, 118, 214, 86],
    [3, 131, 35, 163, 11, 139, 43, 171, 1, 129, 33, 161, 9, 137, 41, 169],
    [195, 67, 227, 99, 203, 75, 235, 107, 193, 65, 225, 97, 201, 73, 233, 105],
    [51, 179, 19, 147, 59, 187, 27, 155, 49, 177, 17, 145, 57, 185, 25, 153],
    [243, 115, 211, 83, 251, 123, 219, 91, 241, 113, 209, 81, 249, 121, 217, 89],
    [15, 143, 47, 175, 7, 135, 39, 167, 13, 141, 45, 173, 5, 133, 37, 165],
    [207, 79, 239, 111, 199, 71, 231, 103, 205, 77, 237, 109, 197, 69, 229, 101],
    [63, 191, 31, 159, 55, 183, 23, 151, 61, 189, 29, 157, 53, 181, 21, 149],
    [255, 127, 223, 95, 247, 119, 215, 87, 253, 125, 221, 93, 245, 117, 213, 85],
  ];

  var BAYER_MATRICES = {
    2: BAYER_2X2,
    4: BAYER_4X4,
    8: BAYER_8X8,
    16: BAYER_16X16,
  };

  function isValidBayerSize(value) {
    return !!VALID_BAYER[Number(value)];
  }

  function normalizeBayerSize(value, fallback) {
    var n = parseInt(String(value == null ? "" : value).trim(), 10);
    if (isValidBayerSize(n)) return n;
    return isValidBayerSize(fallback) ? Number(fallback) : 16;
  }

  function luminosity(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function getRootBlock(css) {
    var match = String(css || "").match(/:root\s*\{[\s\S]*?\}/);
    return match ? match[0] : "";
  }

  function getCssVarRgb(css, name) {
    var re = new RegExp("--" + name + "\\s*:\\s*rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)", "i");
    var match = String(css || "").match(re);
    if (!match) return null;
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    };
  }

  function getDuotonePaletteFromCssText(css) {
    var rootCss = getRootBlock(css);
    if (!rootCss) return null;

    var whiteRgb = getCssVarRgb(rootCss, "clr-white");
    var blackRgb =
      getCssVarRgb(rootCss, "clr-black-a10") ||
      getCssVarRgb(rootCss, "clr-black-a0");

    if (!whiteRgb || !blackRgb) return null;
    return [whiteRgb, blackRgb];
  }

  function applyBayerDitherToRgba(data, width, height, bayerSize, palette) {
    var size = normalizeBayerSize(bayerSize, 16);
    var matrix = BAYER_MATRICES[size];
    var max = size * size - 1;

    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        var idx = (y * width + x) * 4;
        var a = data[idx + 3];
        if (a === 0) continue;

        var lum = luminosity(data[idx], data[idx + 1], data[idx + 2]);
        var threshold = matrix[y % size][x % size];
        var normalizedThreshold = (threshold / max) * 255;
        var color = lum > normalizedThreshold ? palette[0] : palette[1];

        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
      }
    }

    return data;
  }

  function applyBayerDitherToImageData(imageData, bayerSize, palette) {
    if (!imageData || !imageData.data) return imageData;
    applyBayerDitherToRgba(
      imageData.data,
      Number(imageData.width) || 0,
      Number(imageData.height) || 0,
      bayerSize,
      palette
    );
    return imageData;
  }

  return {
    VALID_BAYER: VALID_BAYER,
    BAYER_MATRICES: BAYER_MATRICES,
    isValidBayerSize: isValidBayerSize,
    normalizeBayerSize: normalizeBayerSize,
    luminosity: luminosity,
    getRootBlock: getRootBlock,
    getCssVarRgb: getCssVarRgb,
    getDuotonePaletteFromCssText: getDuotonePaletteFromCssText,
    applyBayerDitherToRgba: applyBayerDitherToRgba,
    applyBayerDitherToImageData: applyBayerDitherToImageData,
  };
});

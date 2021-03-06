var utils = require('./utils')
var BN = require('bignumber.js')
var ext = require('./bn-extensions')

// split utxos between each output, ignores outputs with .value defined
module.exports = function split (utxos, outputs, feeRate) {
  if (!utils.uintOrNull(feeRate)) return {}

  var bytesAccum = utils.transactionBytes(utxos, outputs)
  var fee = ext.mul(feeRate, bytesAccum)
  if (outputs.length === 0) return { fee: fee }

  var inAccum = utils.sumOrNaN(utxos)
  var outAccum = utils.sumForgiving(outputs)
  var remaining = ext.sub(inAccum, outAccum, fee)

  if (!remaining || remaining.isLessThan(0)) return { fee: fee }

  var unspecified = outputs.reduce(function (a, x) {
    return a + !x.value
  }, 0)

  if (ext.isZero(remaining) && ext.isZero(unspecified)) return utils.finalize(utxos, outputs, feeRate)

  // Counts the number of split outputs left
  var splitOutputsCount = new BN(outputs.reduce(function (a, x) {
    return a + !x.value
  }, 0))

  // any number / 0 = infinity (shift right = 0)
  var splitValue = new BN(remaining).dividedBy(splitOutputsCount).toFixed(0);

  // ensure every output is either user defined, or over the threshold
  if (!outputs.every(function (x) {
    return x.value !== undefined || new BN(splitValue).isGreaterThan(utils.dustThreshold(x, feeRate))
  })) {
    return { fee: fee }
  }

  // assign splitValue to outputs not user defined
  outputs = outputs.map(function (x) {
    if (x.value !== undefined) return x
    // not user defined, but still copy over any non-value fields
    var y = {}
    for (var k in x) y[k] = x[k]
    y.value = new BN(splitValue);
    return y
  })

  return utils.finalize(utxos, outputs, feeRate)
}

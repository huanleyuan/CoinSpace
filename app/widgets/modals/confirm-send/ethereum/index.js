'use strict';

var Ractive = require('widgets/modals/base');
var emitter = require('lib/emitter');
var getWallet = require('lib/wallet').getWallet;
var parseHistoryTx = require('lib/wallet').parseHistoryTx;
var toAtom = require('lib/convert').toAtom;
var toUnitString = require('lib/convert').toUnitString;
var showInfo = require('widgets/modals/flash').showInfo;

function open(data) {

  var ractive = new Ractive({
    partials: {
      content: require('./_content.ract'),
      error: require('../error.ract'),
      success: require('../success.ract')
    },
    data: extendData(data)
  });

  ractive.on('send', function() {
    ractive.set('sending', true);
    var wallet = getWallet();
    var tx = null;

    try {
      tx = createTx();
    } catch(err) {
      if (err.message.match(/Insufficient funds/)) {
        ractive.set('sending', false);
        return showInfo({title: 'Insufficient funds'});
      }
      return handleTransactionError(err);
    }

    wallet.sendTx(tx, function (err, historyTx) {
      if (err) return handleTransactionError(err);

      ractive.set('confirmation', false);
      ractive.set('success', true);
      ractive.set('onDismiss', data.onSuccessDismiss);

      // update balance & tx history
      emitter.emit('wallet-ready');
      if (historyTx) {
        emitter.emit('append-transactions', [parseHistoryTx(historyTx)]);
      }
    });
  });

  function createTx() {
    var wallet = getWallet();
    var tx;
    if (data.importTxOptions) {
      tx = wallet.createImportTx(data.importTxOptions);
    } else {
      tx = wallet.createTx(data.to, toAtom(data.amount));
    }
    return tx;
  }

  function handleTransactionError(err) {
    console.error(err);
    ractive.set('confirmation', false)
    ractive.set('error', err.message)
  }

  return ractive
}

function extendData(data) {
  data.confirmation = true;
  data.feeSign = data.importTxOptions ? '-' : '+';

  var wallet = getWallet();
  data.fee = toUnitString(wallet.getDefaultFee(), 18);
  data.feeDenomination = 'ETH';

  return data;
}

module.exports = open

'use strict';

var Ractive = require('lib/ractive');
var emitter = require('lib/emitter');
var toUnitString = require('lib/convert').toUnitString;
var getTokenNetwork = require('lib/token').getTokenNetwork;
var getWallet = require('lib/wallet').getWallet;
var strftime = require('strftime');
var showError = require('widgets/modals/flash').showError;
var showTransactionDetail = require('widgets/modals/transaction-detail');

module.exports = function(el) {
  var network = getTokenNetwork();
  var ractive = new Ractive({
    el: el,
    template: require('./index.ract'),
    data: {
      transactions: [],
      formatTimestamp: function(timestamp) {
        var date = new Date(timestamp)
        return strftime('%b %d %l:%M %p', date)
      },
      formatConfirmations: function(number) {
        if (network === 'ripple') return '';
        if (number === 1) {
          return number + ' confirmation';
        } else {
          return number + ' confirmations';
        }
      },
      getToAddress: function(tx) {
        if (network === 'ethereum' || network === 'ripple') {
          return tx.to;
        } else if (['bitcoin', 'bitcoincash', 'litecoin', 'testnet'].indexOf(network) !== -1) {
          return tx.outs[0].address;
        }
      },
      isReceived: function(tx) {
        if (network === 'ethereum' || network === 'ripple') {
          return tx.to === getWallet().addressString;
        } else if (['bitcoin', 'bitcoincash', 'litecoin', 'testnet'].indexOf(network) !== -1) {
          return tx.amount > 0;
        }
      },
      isConfirmed: function(confirmations) {
        if (network === 'ripple') return true;
        return confirmations >= getWallet().minConf;
      },
      isFailed: function(tx) {
        if (network === 'ethereum' || network === 'ripple') {
          return tx.status === false;
        } else if (['bitcoin', 'bitcoincash', 'litecoin', 'testnet'].indexOf(network) !== -1) {
          return false;
        }
      },
      toUnitString: toUnitString,
      loadingTx: true,
      hasMore: false,
      loadingMore: false
    }
  })

  emitter.on('append-transactions', function(newTxs){
    newTxs.forEach(function(tx) {
      ractive.unshift('transactions', tx);
    })
    ractive.set('loadingTx', false)
  })

  emitter.on('set-transactions', function(txs) {
    var wallet = getWallet();
    network = getTokenNetwork();
    ractive.set('transactions', txs)
    ractive.set('hasMore', wallet ? wallet.hasMoreTxs : false)
    ractive.set('loadingTx', false)
  })

  emitter.on('sync', function() {
    ractive.set('transactions', [])
    ractive.set('loadingTx', true)
  })

  ractive.on('show-detail', function(context) {
    var index = context.node.getAttribute('data-index')
    var data = {
      transaction: ractive.get('transactions')[index],
      formatTimestamp: ractive.get('formatTimestamp'),
      formatConfirmations: ractive.get('formatConfirmations'),
      isReceived: ractive.get('isReceived'),
      isFailed: ractive.get('isFailed'),
      isConfirmed: ractive.get('isConfirmed'),
      toUnitString: ractive.get('toUnitString'),
      isNetwork: function(str) {
        return str === network
      }
    }
    showTransactionDetail(data)
  })

  ractive.on('load-more', function() {
    ractive.set('loadingMore', true);
    var transactions = ractive.get('transactions');
    var start = transactions[transactions.length - 1].id;
    var wallet = getWallet();

    wallet.loadTxs(wallet.addressString, start).then(function(result) {
      ractive.set('loadingMore', false);
      ractive.set('hasMore', result.hasMoreTxs)
      result.txs.forEach(function(tx) {
        ractive.push('transactions', tx);
      })
    }).catch(function(err) {
      console.error(err);
      ractive.set('loadingMore', false);
      showError({message: err.message});
    })
  })

  return ractive
}

"use strict";

var async = require("async");
var BTCE = require("btc-e");
var _ = require("lodash");
var moment = require("moment");
var StringScanner = require("strscan").StringScanner;
var BigNumber = require("bignumber.js");

var util = require("./util"); //custom functions

function Btce (options) {
    var self = this;
    self[options] = options;

    var btcePrivate;
    if (typeof options.key === "string" && typeof options.secret === "string") {
        btcePrivate = new BTCE(options.key, options.secret);
    } else {
        btcePrivate = null;
    }
    var btcePublic = new BTCE();        // create an object which will be used for public API calls

    self.getTicker = function (options, callback) {
        var ticker;
        var btcePair = pairMap(options.pair);
        btcePublic.ticker(btcePair, function (err, btceTicker) {
            // https://btc-e.com/api/3/ticker/btc_usd
            if (err) {
                ticker = {
                    timestamp: moment().utc().format("X"),
                    data: {}
                }
            } else {
                ticker = {
                    timestamp: util.adjTimestamp(btceTicker.ticker.updated),
                    data: {
                        pair: pairMap(btcePair),
                        last: btceTicker.ticker.last,
                        bid: btceTicker.ticker.sell,
                        ask: btceTicker.ticker.buy,
                        volume: btceTicker.ticker.vol_cur
                    }
                };
            }
            callback(err, ticker);
        });
    }

    self.getOrderBook = function (options, callback) {
        var orderBook;
        var err = new Error("Method not implemented")
        orderBook = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, orderBook);
    }

    self.getTrades = function (options, callback) {
        var trades;
        var err = new Error("Method not implemented")
        trades = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, trades);
    }

    self.getFee = function (options, callback) {
        var fixedFee = self.properties.fee;           // fee is hardcodded and fixed
        var err = null;
        var fee = {
            timestamp: moment().utc().format("X"),
            error: "",
            data: {
                pair: options.pair,
                fee: fixedFee
            }
        }
        callback(err, fee);
    }

    self.getTransactions = function (options, callback) {
        var transactions;
        var err = new Error("Method not implemented")
        transactions = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, transactions);
    }

    self.getBalance = function (options, callback) {
        var balance;
        var err = new Error("Method not implemented")
        balance = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, balance);
    }

    self.getOpenOrders = function (options, callback) {
        var openOrders;
        var err = new Error("Method not implemented")
        openOrders = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, openOrders);
    }

    self.postSellOrder = function (options, callback) {
        var orderResult;
        var err = new Error("Method not implemented")
        orderResult = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, orderResult);
    }

    self.postBuyOrder = function (options, callback) {
        var orderResult;
        var err = new Error("Method not implemented")
        orderResult = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, orderResult);
    }

    self.cancelOrder = function (options, callback) {
        var orderResult;
        var err = new Error("Method not implemented")
        orderResult = {
            timestamp: moment().utc().format("X"),
            error: err.message,
            data: {}
        }
        callback(err, orderResult);
    }

    var pairMap = function (pairString) { // converts pairString to different format
    // (to map string format used by cryptox pair to/from format used by btc-e npm module
    // Example "BTCUSD" to "btc_usd" or "btc_usd" to "BTCUSD"
    // If input string is not 6 characters or doesn't contain one "_", the function returns the input string (unmodified)
        var currency1, currency2;
        //Example "BTCUSD" to "btc_usd"
        if(pairString.length == 6) {
            currency1 = pairString.slice(0,3).toLowerCase();
            currency2 = pairString.slice(3).toLowerCase();
            return currency1 + "_" + currency2;
        }
        //Example "btc_usd" to "BTCUSD"
        var currency = pairString.split("_");
        if(currency.length != 2)
            return pairString;
        return currency[0].toUpperCase() + currency[1].toUpperCase();
    };
}

Btce.prototype.properties = {
    name: "BTC-e",              // Proper name of the exchange/provider
    slug: "btce",               // slug name of the exchange. Needs to be the same as the .js filename
    markets: [                  // all allowed currency/asset combinatinos (pairs) that form a market
        {
            pair: "USDBTC"
        },
        {
            pair: "RURBTC"
        },
        {
            pair: "EURBTC"
        },
        {
            pair: "BTCLTC"
        },
        {
            pair: "USDLTC"
        },
        {
            pair: "RURLTC"
        },
        {
            pair: "EURLTC"
        },
        {
            pair: "BTCNMC"
        },
        {
            pair: "USDNMC"
        },
        {
            pair: "BTCNVC"
        },
        {
            pair: "USDNVC"
        },
        {
            pair: "RURUSD"
        },
        {
            pair: "USDEUR"
        },
        {
            pair: "BTCTRC"
        },
        {
            pair: "BTCPPC"
        },
        {
            pair: "USDPPC"
        },
        {
            pair: "BTCFTC"
        },
        {
            pair: "BTCXPM"
        }
    ],
    publicAPI: {
        supported: true,            // is public API (not requireing user authentication) supported by this exchange?
        requires: []                // required parameters
    },
    privateAPI: {
        supported: true,            // is public API (requireing user authentication) supported by this exchange?
        requires: ["key", "secret"]
    },
    marketOrder: false,             // does it support market orders?
    infinityOrder: false,           // does it supports infinity orders?
                                    // (which means that it will accept orders bigger then the current balance and order at the full balance instead)
    monitorError: "",               //if not able to monitor this exchange, please set it to an URL explaining the problem
    tradeError: "",                  //if not able to trade at this exchange, please set it to an URL explaining the problem
    fee: 0.002                      // fee is hardcoded and fixed to 0.2%
}

module.exports = Btce;
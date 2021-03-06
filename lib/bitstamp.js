"use strict";

const moment = require("moment");
const _ = require("lodash");
const async = require("async");
const BITSTAMP = require('bitstamp');

const util = require("./util"); //custom functions

function Bitstamp (options) {
    const self = this;

    let bitstampPublic, bitstampPrivate;
    self["options"] = options;

    bitstampPublic = new BITSTAMP();
    if (typeof options["key"] === "string" && typeof options["secret"] === "string" && typeof options.username === "string") {
        bitstampPrivate = new BITSTAMP(options.key, options.secret, options.username);
    } else {
        bitstampPrivate = bitstampPublic;
    }

    Object.getOwnPropertyNames(Object.getPrototypeOf(bitstampPrivate)).forEach(prop => {
        if (typeof  bitstampPrivate[prop] === 'function' && prop !== 'constructor') {
          self[prop] = bitstampPrivate[prop];
        }
    });

    let checkErr = function (err, result) {     // arguments are the result from BITSTAMP module,
                                                // returns the error (as Error object type) or null id no error
        if (err instanceof Error)
            return err;
        if (typeof err === "string")
            return new Error(err);
        if (result && typeof result.error === "string")
            return new Error(result.error);
    };

	let user_transactions = function (options, callback) {             // same function as native API wrapper, but it returns result normalized according to JSON schema
		bitstampPrivate.user_transactions('', options, function (err, xTransactions) {
			let transactions, amount;
			transactions = {
				timestamp: util.timestampNow(),
				error: err && err.message || "",
				data: []
			};
			if (err) {
				return callback(err, transactions);
			}
			// var jf = require("jsonfile"); jf.writeFileSync(__dirname + "/bitstamp-getFee_MockApiResponse.json", xTransactions);     // only used to create MockApiResponse file for the test unit
			xTransactions.forEach(function (element, index, array) {
				transactions.data.push(
					{
						tx_id: "",
						datetime: "",
						type: "",
						symbol: "",
						amount_base: '0',
						amount_counter: '0',
						rate: '0',
						fee_base: '0',
						fee_counter: '0',
						order_id: "",
						add_info: ""
					});
				let tx = transactions.data[transactions.data.length - 1];
				tx.tx_id = element.id.toString();
				tx.datetime = moment(element.datetime + " Z").utc().format();
				let btc  = parseFloat(element.btc);
                let usd  = parseFloat(element.usd);
                let eur  = parseFloat(element.eur);
				switch (element.type) {
                    case 0:
					case '0':     // deposit
						tx.type = "deposit";
						if (btc > 0) {
							tx.symbol = "XBT";
							tx.amount_base = element.btc;
						}
						if (usd > 0) {
							tx.symbol = "USD";
							tx.amount_base = element.usd;
						}
                        if (eur > 0) {
                            tx.symbol = "EUR";
                            tx.amount_base = element.eur;
                        }
						break;
                    case 1:
					case '1':     // withdrawal
						tx.type = "withdrawal";
						if (btc < 0) {
							tx.symbol = "XBT";
							tx.amount_base = element.btc;
						}
                        if (usd < 0) {
                            tx.symbol = "USD";
                            tx.amount_base = element.usd;
                        }
                        if (eur < 0) {
                            tx.symbol = "EUR";
                            tx.amount_base = element.eur;
                        }
						break;
                    case 2:
					case '2':     // market trade
						tx.type = btc < 0 ? "sell" : "buy";
						if (usd) {
                            tx.symbol = "XBT_USD";
                            tx.amount_counter = element.usd;
                            tx.rate = element.btc_usd.toString();
                        } else {
                            tx.symbol = "XBT_EUR";
                            tx.amount_counter = element.eur;
                            tx.rate = element.btc_eur.toString();
                        }
                        tx.amount_base = element.btc;
						tx.order_id = element.order_id ? element.order_id.toString() : "";
						break;
                    case 14:
                    case '14':     // deposit
                        tx.type = "transfer";
                        break;
					default:
                        tx.type = "unknown";
				}
				tx.fee_counter = element.fee;
			});
			callback(null, transactions);
		});
	};

    self.getRate = function (options, callback) {
        self.getTicker(options, function(err, result) {
            let rate = {
                timestamp: util.timestampNow(),
                error: "",
                data: []
            };
            if (err) {
                rate.error = err.message;
                return callback(err, rate);
            }
            rate.timestamp = result.timestamp;
            let data = {
                pair: result.data[0].pair,
                rate: result.data[0].last
            };
            rate.data.push(data);
            callback(err, rate);
        });
    };

    function formatCurrencyPair(pair) {
        if (typeof pair !== "string") {
            return pair;
        }
        let currencies = pair.split('_');
        return `${currencies[0].replace(/xbt/i, 'BTC').toUpperCase()}${currencies[1].replace(/xbt/i, 'BTC').toUpperCase()}`
    }

    self.getTicker = function (options, callback) {
        // https://www.bitstamp.net/api/ticker/
        let ticker, data;
        let pair = formatCurrencyPair(options.pair);
        bitstampPublic.ticker(pair, function(xErr, bitstampTicker) {
            let err = checkErr(xErr, bitstampTicker);
            ticker = {
                timestamp: util.timestampNow(),
                error: err && err.message || "",
                data: []
            };
            if (err)
                return callback(err, ticker);

            // let jf = require("jsonfile"); jf.writeFileSync(__dirname + "/bitstamp-getFee_MockApiResponse.json", bitstampTicker, {spaces: 2});     // only used to create MockApiResponse file for the test unit
            ticker.timestamp = util.timestamp(bitstampTicker.timestamp);
            data = {
                pair: options.pair.toUpperCase(),
                last: bitstampTicker.last,
                bid: bitstampTicker.bid,
                ask: bitstampTicker.ask,
                volume: bitstampTicker.volume,
                high: bitstampTicker.high,
                low: bitstampTicker.low,
                vwap: bitstampTicker.vwap
            };
            ticker.data.push(data);
            callback(null, ticker);
        })
    };

    self.getOrderBook = function (options, callback) {
        let pair = formatCurrencyPair(options.pair);
        bitstampPublic.order_book(pair, function (xErr, bitstampOrderBook) {
            // https://www.bitstamp.net/api/order_book/
            let err = checkErr(xErr, bitstampOrderBook);
            let orderBook = {
                timestamp: util.timestampNow(),
                error: err && err.message || "",
                data: []
            };
            if (err) {
                return callback(err, orderBook);
            }
            orderBook.timestamp = util.timestamp(bitstampOrderBook.timestamp);
            let data = {
                pair: options.pair.toUpperCase(),
                asks: [],
                bids: [],
            };
            orderBook.data.push(data);
            let order;
            bitstampOrderBook.asks.forEach(function (element, index, asks) {
                order = {
                    price: asks[index][0],
                    volume: asks[index][1],
                };
                orderBook.data[0].asks.push(order);
            });
            bitstampOrderBook.bids.forEach(function (element, index, bids) {
                order = {
                    price: bids[index][0],
                    volume: bids[index][1],
                };
                orderBook.data[0].bids.push(order);
            });
            callback(null, orderBook);
        });
    };

    self.getTrades = function (options, callback) {
        var trades;
        var err = new Error("Method not implemented");
        trades = {
            timestamp: util.timestampNow(),
            error: err.message,
            data: []
        };
        callback(err, trades);
    };

    self.getFee = function (options, callback) {
        bitstampPrivate.balance(null, function (xErr, bitstampBalance) {
            let err = checkErr(xErr, bitstampBalance);
            let pair = formatCurrencyPair(options.pair).toLocaleLowerCase();
            if (!err && pair && !bitstampBalance.hasOwnProperty(`${pair}_fee`)) {
                err  = new Error(`Invalid pair ${pair}`)
            }

            let fee = {
                timestamp: util.timestampNow(),
                error: err && err.message || "",
                data: []
            };

            if (err) {
                return callback(err, fee);
            }
            // let jf = require("jsonfile"); jf.writeFileSync(__dirname + "/bitstamp-getFee_MockApiResponse.json", bitstampBalance, {spaces: 2});     // only used to create MockApiResponse file for the test unit

            if (pair) {
                let bitstampFee = bitstampBalance[`${pair}_fee`];
                let data = {
                    pair: options.pair.toUpperCase(),
                    maker_fee: (parseFloat(bitstampFee) / 100).toString(), // note that Bitstamp native API call returns 0.2 for 0.2%
                    taker_fee: (parseFloat(bitstampFee) / 100).toString(),
                };
                fee.data.push(data);
            } else {
                for (let key in bitstampBalance) {
                    if (bitstampBalance.hasOwnProperty(key)) {
                        let s = key.split('_');
                        if (s[1] === 'fee') {
                            let data = {
                                pair: `${s[0].substr(0, 3)}_${s[0].substr(3, 3)}`.toUpperCase(),
                                maker_fee: (parseFloat(bitstampBalance[key]) / 100).toString(), // note that Bitstamp native API call returns 0.2 for 0.2%
                                taker_fee: (parseFloat(bitstampBalance[key]) / 100).toString(),
                            };
                            fee.data.push(data);
                        }
                    }
                }
            }
            callback(null, fee);
        });
    };

    self.getTransactions = function (optionsP, callback) {
        var limit, skip, skippedCount, beforeMoment, afterMoment, txMoment, fetchMore, manualFilter;
	    var transactions = {
		    timestamp: util.timestampNow(),
		    error: "",
		    data: []
	    };

	    let options = _.clone(optionsP);
        util.addDefaults("getTransactions", options);

	    // store for later manipulation of result data
	    limit = options.limit;
	    skip = options.hasOwnProperty("skip") && options.skip || 0;
	    beforeMoment = options.hasOwnProperty("before") && moment(options.before) || null;
	    afterMoment = options.hasOwnProperty("after") && moment(options.after) || null;

	    //set xOptions to call the function
	    var xOptions = {
		    offset: skip,
		    limit: options.limit,
		    sort: options.sort
	    };
	    if (options.hasOwnProperty("before") || options.hasOwnProperty("after") || options.hasOwnProperty("type")) {
		    // if we will aplly manual filter, don't skip anything and fetch maximum
		    xOptions.limit = self.properties.dictionary.getTransactions.limit.maximum;
		    xOptions.offset = 0;
		    manualFilter = true;
	    }
	    async.doWhilst(
		    function (cb) {
			    user_transactions(xOptions, function (err, result) {
				    if (err)
				        return cb(err);
				    fetchMore = !(xOptions.limit < self.properties.dictionary.getTransactions.limit.maximum);     // if we fetched less than maximum we don't need to fetchMore for sure
				    fetchMore = fetchMore  && !(result.data.length < xOptions.limit);     // if fetched below the xOptions.limit, we can't fetch more (we fetched all)
				    // drop records before, after and skip
				    var drop, p = 0;  // points to the current record to check;
				    while (p < result.data.length) {
					    drop = false;
					    txMoment = moment(result.data[p].datetime);
					    drop = beforeMoment && txMoment.isAfter(beforeMoment);
					    if (!drop && options.hasOwnProperty("type")) {
						    drop = (options.type === "movements") && (["buy", "sell"].indexOf(result.data[p].type) > -1);
						    drop = drop ||  (options.type === "trades") && (["deposit", "withdrawal"].indexOf(result.data[p].type) > -1);
					    }
					    if (!drop && afterMoment && txMoment.isBefore(afterMoment)) {
						    fetchMore = false;
						    drop = true;
					    }
					    if (!drop && options.hasOwnProperty("symbol")) {
						    let currency, found;
						    currency = options.symbol.substr(0,3);
						    found = result.data[p].symbol.indexOf(currency) > -1;
						    found = found || result.data[p].symbol.indexOf(currency.replace(/xbt/i, "BTC")) > -1;
						    currency = options.symbol.substr(3,3);
						    found = found || currency !== "" && (result.data[p].symbol.indexOf(currency) > -1);
                            found = found || currency !== "" && (result.data[p].symbol.indexOf(currency.replace(/xbt/i, "BTC")) > -1);
						    drop = !found;
					    }
					    if (drop)
						    result.data.splice(p, 1);       // drop the record
					    else
						    p++;                           // or move pointer to next one
				    }
				    util.extendTransactions(transactions, result);
				    fetchMore = fetchMore && transactions.data.length < limit + skip;
				    cb(null);
			    });
	        },
		    function () {
			    if (fetchMore)
			        xOptions.offset += xOptions.limit;
			    return fetchMore;
		    },
		    function (err) {
			    if (err) {
				    transactions.error = err.message;
				    return callback(err, transactions);
			    }
			    if (manualFilter && skip)
				    transactions.data.splice(0, skip);
			    transactions.data.splice(limit, transactions.data.length - limit);
			    callback(null, transactions);
	        });
    };

    self.getBalance = function (options, callback) {
        bitstampPrivate.balance(null, function (err, bitstampBalance) {
            let balance = {
                timestamp: util.timestampNow(),
                error: err && err.message || "",
                data: []
            };
            if (err) {
                return callback(err, balance);
            }
            // var jf = require("jsonfile"); jf.writeFileSync(__dirname + "/bitstamp-getFee_MockApiResponse.json", bitstampBalance);     // only used to create MockApiResponse file for the test unit
            let data = {
                total: [],
                available: []
            };
            let amount = bitstampBalance.btc_balance;
            if (amount)
                data.total.push({currency: "XBT", amount: amount});
            amount = bitstampBalance.usd_balance;
            if (bitstampBalance.usd_balance)
                data.total.push({currency: "USD", amount: amount});
            amount = bitstampBalance.btc_available;
            if (amount)
                data.available.push({currency: "XBT", amount: amount});
            amount = bitstampBalance.usd_available;
            if (amount)
                data.available.push({currency: "USD", amount: amount});
            balance.data.push(data);
            callback(null, balance);
        });
    };

    self.getMarginPositions = function (options, callback) {
        let err = new Error("Method not supported");
        let result = {
            timestamp: util.timestampNow(),
            error: err && err.message || "",
            data: []
        };
        if (err)
            return callback(err, result);
        return callback(null, result);
    };


    self.getOpenOrders = function (options, callback) {
        var openOrders;
        var err = new Error("Method not implemented");
        openOrders = {
            timestamp: util.timestampNow(),
            error: err.message,
            data: []
        };
        callback(err, openOrders);
    };

    self.postSellOrder = function (options, callback) {
        var orderResult;
        var err = new Error("Method not implemented");
        orderResult = {
            timestamp: util.timestampNow(),
            error: err.message,
            data: []
        };
        callback(err, orderResult);
    };

    self.postBuyOrder = function (options, callback) {
        var orderResult;
        var err = new Error("Method not implemented");
        orderResult = {
            timestamp: util.timestampNow(),
            error: err.message,
            data: []
        };
        callback(err, orderResult);
    };

    self.cancelOrder = function (options, callback) {
        var orderResult;
        var err = new Error("Method not implemented");
        orderResult = {
            timestamp: util.timestampNow(),
            error: err.message,
            data: []
        };
        callback(err, orderResult);
    };
}

Bitstamp.prototype.properties = {
    name: "Bitstamp",              // Proper name of the exchange/provider
    slug: "bitstamp",               // slug name of the exchange. Needs to be the same as the .js filename
    methods: {
        implemented: ["getRate", "getTicker", "getOrderBook", "getFee", "getTransactions", "getBalance"],
        notSupported: ["getLendBook", "getActiveOffers", "postOffer", "cancelOffer", "getMarginPositions"]
    },
    instruments: [                  // all allowed currency/asset combinatinos (pairs) that form a market
        {
            pair: "XBT_USD"
        }
    ],
	dictionary: {
		"withdrawal_requests": {
			type: {
				"0": "SEPA",
				"1": "Bitcoin",
				"2": "WIRE transfer"
			},
			status: {
				"0": "open",
				"1": "in process",
				"2": "finished",
				"3": "canceled",
				"4": "failed"
			}
		},
		"sell": {
			"type": {
				"0": "buy",
				"1": "sell"
			}
		},
		"buy": {
			"type" :{
				"0": "buy",
				"1": "sell"
			}
		},
		"open_orders": {
			"type" :{
				"0": "buy",
				"1": "sell"
			}
		},
		"user_transactions": {
			"offset" : {
				"default": 0
			},
			"limit" : {
				"default": 100,
				"maximum": 1000
			},
			"sort" : {
				"desc": "desc",
				"asc": "asc",
				"default": "desc"
			},
			"type" :{
				"0": "deposit",
				"1": "withdrawal",
				"2": "trade"
			}
		},
		"getTransactions": {
			"limit" : {
				"maximum": 1000
			}
		}
	},
	publicAPI: {
        supported: true,            // is public API (not requireing user authentication) supported by this exchange?
        requires: []                // required parameters
    },
    privateAPI: {
        supported: true,            // is public API (requireing user authentication) supported by this exchange?
        requires: ["key", "secret", "username"]
    },
    marketOrder: false,             // does it support market orders?
    infinityOrder: false,           // does it supports infinity orders?
                                    // (which means that it will accept orders bigger then the current balance and order at the full balance instead)
    monitorError: "",               //if not able to monitor this exchange, please set it to an URL explaining the problem
    tradeError: ""                  //if not able to trade at this exchange, please set it to an URL explaining the problem
};

module.exports = Bitstamp;

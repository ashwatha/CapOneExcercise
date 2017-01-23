(function() {

    // Declare the levelMoneyApp module and its dependency 'ui.bootstrap'and ui.router
    //ui.router helps in switching to different tabs on the same page

    var levelMoneyApp = angular.module('levelMoneyApp', ["ui.router", "ui.bootstrap"]);

    //Config for levelMoneyApp where we define each state’s behavior
    levelMoneyApp.config(function($stateProvider, $urlRouterProvider) {

        $urlRouterProvider.otherwise("/main/tab1");

        $stateProvider
            .state("main", {
                abtract: true,
                url: "/main",
                templateUrl: "main.html"
            })
            .state("main.tab1", {
                url: "/tab1",
                templateUrl: "tab1.html"
            })
            .state("main.tab2", {
                url: "/tab2",
                templateUrl: "tab2.html"
            })
            .state("main.tab3", {
                url: "/tab3",
                templateUrl: "tab3.html"
            })
            .state("main.tab4", {
                url: "/tab4",
                templateUrl: "tab4.html"
            })
            .state("main.tab5", {
                url: "/tab5",
                templateUrl: "tab5.html"
            })
            .state("main.tab6", {
                url: "/tab6",
                templateUrl: "tab6.html"
            });

    });


    //idFilter is used to disregard all donut-related transactions from the spending
    levelMoneyApp.filter("idFilter", function() {
        return function(input) {
            var output = [];
            angular.forEach(input, function(value, key) {
                if (value.merchant != "Krispy Kreme Donuts" && value.merchant != "Dunkin #336784") {
                    output.push(value);
                }
            });
            return output;
        }
    });

    levelMoneyApp.controller('transactionsController', ['$rootScope', '$scope', '$http', 'calculateService', '$state', '$filter', 'dataRequestService', function($rootScope, $scope, $http, calculateService, $state, $filter, dataRequestService) {
        $scope.loading = true;

        $scope.go = function(route) {
            $state.go(route);
        };

        $scope.active = function(route) {
            return $state.is(route);
        };

        $scope.tabs = [{
            heading: "All Transactions",
            route: "main.tab1",
            active: false
        }, {
            heading: "Transactions Summary",
            route: "main.tab2",
            active: false
        }, {
            heading: "Ignore Donuts",
            route: "main.tab3",
            active: false
        }, {
            heading: "Ignore Donuts Summary",
            route: "main.tab4",
            active: false
        }, {
            heading: "Crystal Ball",
            route: "main.tab5",
            active: false
        }, {
            heading: "Crystal Ball Summary",
            route: "main.tab6",
            active: false
        }

        ];

        $scope.$on("$stateChangeSuccess", function() {
            $scope.tabs.forEach(function(tab) {
                tab.active = $scope.active(tab.route);
            });
        });

        $scope.transactions = [];
        $scope.nodoughnutTransactions = [];
        $scope.avgtransactions = {};
        $scope.avgtransactionsnd = {};
        $scope.credit = 0;
        $scope.creditNoDoughnuts = 0;
        $scope.debit = 0;
        $scope.debitNoDoughnuts = 0;
        $scope.projectedTransactions = [];

        //calculate the average credits and debit for the entire transaction given
        dataRequestService.async('https://2016.api.levelmoney.com/api/v2/core/get-all-transactions', {})
            .then(function(data) {
                $scope.transactions = data;
                tempArray = calculateService.calculate($scope.transactions);
                $scope.avgtransactions = tempArray[0];
                $scope.credit = tempArray[1];
                $scope.debit = tempArray[2];

                //calculate the average credits and debit for the transactions ignoring donuts
                $scope.nodoughnutTransactions = $filter('idFilter')($scope.transactions);
                tempArray = calculateService.calculate($scope.nodoughnutTransactions);
                $scope.avgtransactionsnd = tempArray[0];
                $scope.creditNoDoughnuts = tempArray[1];
                $scope.debitNoDoughnuts = tempArray[2];


                //calculate the average projected credits and projected debit for the current month
                dataRequestService.async('https://2016.api.levelmoney.com/api/v2/core/projected-transactions-for-month', {
                    year: parseInt($filter('date')(new Date(), "yyyy"), 10),
                    month: parseInt($filter('date')(new Date(), "M"), 10)
                }).then(function(data) {
                    $scope.projectedTransactions = data;
                    var tempArray = $scope.transactions.concat($scope.projectedTransactions);
                    tempArray = calculateService.calculate(tempArray);
                    $scope.avgprojectedtransactions = tempArray[0];
                    $scope.projectedcredit = tempArray[1];
                    $scope.projecteddebit = tempArray[2];
                });
            })
            .finally(function() {
                $scope.loading = false;
            });
    }]);

    //Calculation Service to calculate the total credit and total debit
    levelMoneyApp.factory('calculateService', ['$filter', function($filter) {
        return {
            calculate: function(transactions) {
                var returnArray = [];
                var amtTransactionsByMonth = {};
                var creditTransactionTotal = 0;
                var debitTransactionTotal = 0;

                for (var i = 0; i < transactions.length; i++) {
                    var getString = $filter('date')(transactions[i]["transaction-time"], "yyyy-MM");
                    temp = {};
                    var amt = parseInt(transactions[i].amount, 10);

                    if (getString in amtTransactionsByMonth) {
                        var temp = amtTransactionsByMonth[getString];
                        if (amt >= 0) {
                            creditTransactionTotal = creditTransactionTotal + amt;

                            if ("credit" in temp) {
                                var tempCredit = temp["credit"];
                                temp["credit"] = tempCredit + amt;
                            } else {
                                temp["credit"] = amt;
                            }

                        } else {
                            debitTransactionTotal = debitTransactionTotal + amt;

                            if ("debit" in temp) {
                                var tempDebit = temp["debit"];
                                temp["debit"] = tempDebit + amt;
                            } else {
                                temp["debit"] = amt;
                            }
                        }

                    } else {
                        if (amt >= 0) {
                            creditTransactionTotal = creditTransactionTotal + amt;
                            temp["credit"] = amt;

                        } else {
                            debitTransactionTotal = debitTransactionTotal + amt;
                            temp["debit"] = amt;
                        }
                    }

                    amtTransactionsByMonth[getString] = temp;
                }

                returnArray.push(amtTransactionsByMonth);
                var avgtranslength = Object.keys(amtTransactionsByMonth).length;
                returnArray.push(creditTransactionTotal / avgtranslength);
                returnArray.push(debitTransactionTotal / avgtranslength);

                return returnArray;
            }
        };
    }]);


    //data Request Service, a service used to make api calls
    levelMoneyApp.factory('dataRequestService', ['$filter', '$http', function($filter, $http) {
        var dataRequestService = {
            async: function(uri, additionalArgs) {

                var commonArgs = {
                    args: {
                        'uid': 1110590645,
                        'token': '3EB119C7F4B10F9C6F488B437ED89D3F',
                        'api-token': 'AppTokenForInterview',
                        'json-strict-mode': false,
                        'json-verbose-response': false
                    }
                };
                args = angular.extend({}, commonArgs, additionalArgs);

                var promise = $http({
                    method: 'POST',
                    url: uri,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    data: args
                })
                    .then(function(result) {
                        if (result.data.error != "no-error") {
                            function DataRequestException(message) {
                                this.name = 'DataRequestException';
                                this.message = message;
                            }
                            DataRequestException.prototype = new Error();
                            DataRequestException.prototype.constructor = DataRequestException;

                            throw new DataRequestException('Error occured while trying to connect to server and get data: ' + result.data.error);
                        }
                        return (result.data.transactions);
                    })
                    .catch(function(data) {
                        console.log('Error: ', data);
                        alert('Error: ' + data.message);
                    });
                return promise;
            }
        };
        return dataRequestService;
    }]);


}());
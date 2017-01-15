var pdApp = angular
    .module('pdModule', ['ngAnimate'])
    .constant("CONSTANTS", {
        FIVEHUNDRED_PIX_CONSUMER_KEY: "ch1v90aEp64AtJhuAjgov97uM93HW4Gg34jA8DuC",
        FIVEHUNDRED_PIX_API_URL_BASE: "https://api.500px.com"
    });

pdApp.config(function($httpProvider) {

    $httpProvider.interceptors.push(function($q, $rootScope) {
        return {
            'request': function(config) {
                $rootScope.$broadcast('loading-started');
                return config || $q.when(config);
            },
            'response': function(response) {
                $rootScope.$broadcast('loading-complete');
                return response || $q.when(response);
            }
        };
    });

});

pdApp.directive("loadingIndicator", function() {
    return {
        restrict: "A",
        template: "<div>Loading...</div>",
        link: function(scope, element, attrs) {
            scope.$on("loading-started", function(e) {
                element.css({
                    "display": ""
                });
            });

            scope.$on("loading-complete", function(e) {
                element.css({
                    "display": "none"
                });
            });
        }
    };
});

pdApp.controller('pdController', ['$scope', '$timeout', '$interval', '$http', 'CONSTANTS',
    function($scope, $timeout, $interval, $http, CONSTANTS) {
        var w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            x = w.innerWidth || e.clientWidth || g.clientWidth,
            y = w.innerHeight || e.clientHeight || g.clientHeight;
        console.log('SCREEN SIZE: ' + x + 'x' + y + ' ' + w.innerWidth + ' ' + w.innerHeight);
        console.log(d.getElementsByTagName('body')[0].clientWidth + ' ' + d.getElementsByTagName('body')[0].clientHeight);
        var bodyElement = document.getElementsByTagName("body")[0];
        var firstRunMessageId = document.getElementById("firstRunMessageId")
        var regExNotLetterOrNumber = /[^a-zA-Z0-9]/;
        bodyElement.style.backgroundSize = 'contain';
        bodyElement.style.backgroundRepeat = 'no-repeat';
        bodyElement.style.backgroundPosition = 'center';
        $scope.settings = {};
        $scope.message = "";
        $scope.startupMessage = true;
        var slideshowDiv = document.getElementById("slideshowDiv");
        var db;
        var dbOpen = indexedDB.open('500px', 27);
        var timer = null;
        var userDisplayedInterval = null;
        dbOpen.onupgradeneeded = function(e) {
            console.log("Upgrading...");
            thisDb = e.target.result;
            var tables = ['photos', 'photosHistory', 'settings'];
            angular.forEach(tables, function(table) {
                if (thisDb.objectStoreNames.contains(table)) {
                    thisDb.deleteObjectStore(table);
                }
                var objectStore = thisDb.createObjectStore(table);
                objectStore.createIndex("index", "id", {
                    unique: true
                });
            });
        }
        dbOpen.onsuccess = function(e) {
            console.log("DB opened. ");
            db = e.target.result;
            $scope.loadSettings();
            $scope.startupMessage = false;
        }
        dbOpen.onerror = function(e) {
            console.log("DB open error. " + e);
        }

        function storePhotoRecord(data) {
            console.log("Store photo: " + data.id);
            var transaction = db.transaction(["photos"], "readwrite");
            var store = transaction.objectStore("photos");
            var request = store.add(data, data.id);
            request.onsuccess = function(e) {
                console.log("Add successful photo: " + data.id);
            }
            request.onerror = function(e) {
                console.log("Add failed " + request.error);
            }
        }
        $scope.changeMode = function() {
            console.log("Mode changed to " + $scope.settings.usersOrFeatures + ". Clearing photos table and saving settings.");
            clearPhotos();
            $scope.saveSettings();
        }

        function clearPhotos() {
            if (!db) {
                console.log("DB not ready in clearPhotos method.");
                return;
            }
            var transactionDelete = db.transaction(["photos"], "readwrite");
            var storeDelete = transactionDelete.objectStore("photos");
            var clearRequest = storeDelete.clear();
            clearRequest.onsuccess = function(e) {
                console.log("Clear photo table");
            }
            clearRequest.onerror = function(e) {
                console.log("Clear photo table error: " + clearRequest.error);
            }
        }

        function movePhoto(data) {
            console.log("Move photo record: " + data.id);
            var transaction = db.transaction(["photosHistory"], "readwrite");
            var store = transaction.objectStore("photosHistory");
            var request = store.put(data, data.id);
            request.onsuccess = function(e) {
                console.log("Add successful photo record to photosHistory: " + data.id + ". Now will delete record from photos.");
                var transactionDelete = db.transaction(["photos"], "readwrite");
                var storeDelete = transactionDelete.objectStore("photos");
                var deleteRequest = storeDelete.delete(data.id);
                deleteRequest.onsuccess = function(e) {
                    console.log("Deleted photo record: " + data.id);
                }
                deleteRequest.onerror = function(e) {
                    console.log("Delete photo record error: " + deleteRequest.error);
                }
            }
            request.onerror = function(e) {
                console.log("Add failed to photosHistory table. " + request.error);
            }
        }

        $scope.slideshowInProgress = true;
        $scope.seconds = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 60
        ]
        var familyFriendlyDefaultCategories = [
            "Animals",
            "City and Architecture",
            "Nature",
            "Still Life"
        ];
        var categories = [
            "Uncategorized",
            "Abstract",
            "Animals",
            "Black and White",
            "Celebrities",
            "City and Architecture",
            "Commercial",
            "Concert",
            "Family",
            "Fashion",
            "Film",
            "Fine Art",
            "Food",
            "Journalism",
            "Landscapes",
            "Macro",
            "Nature",
            "Nude",
            "People",
            "Performing Arts",
            "Sport",
            "Still Life",
            "Street",
            "Transportation",
            "Travel",
            "Underwater",
            "Urban Exploration",
            "Wedding"
        ];

        function stopSlideshow() {
            $scope.slideshowInProgress = false;
            window.clearInterval(timer);
            bodyElement.style.backgroundImage = null;
            document.body.style.cursor = 'default';
            $scope.$apply();
        }

        function log(msg) {
            console.log(msg);
            $scope.message = msg;
        }
        bodyElement.addEventListener('touchstart', function(e) {
            log("Slideshow stopped by touching the screen.");
            stopSlideshow();
        });

        document.onkeypress = function(e) {
            e = e || window.event;
            var charCode = (typeof e.which == "undefined") ? e.keyCode : e.which;
            var charStr = String.fromCharCode(charCode);
            if (/\d/.test(charStr)) {
                log("Slideshow stopped by keying the number: " + charStr + ".");
                stopSlideshow();
            }
            return true;
        };
        $scope.startSlideshow = function() {
            $scope.slideshowInProgress = true;
            $scope.message = "";
            $scope.$apply();
            if (userDisplayedInterval != null) {
              console.log("Cancel interval");
              $interval.cancel(userDisplayedInterval);
            }
            $scope.userDisplayed = null;
            var transaction = db.transaction(["photos"], "readonly");
            var store = transaction.objectStore("photos");
            var index = store.index("index");
            var request = index.count();
            request.onsuccess = function(e) {
                console.log("Row count: " + request.result);
                if (request.result == 0) {
                    queryServerPhotos();
                } else {
                    document.body.style.cursor = 'none';
                    slideshowRoutine();
                    timer = setInterval(slideshowRoutine, $scope.settings.seconds * 1000);
                }
            }
            request.onerror = function(e) {
                console.log("Row count error: " + request.error);
            }
        }


        $scope.queryServerUsers = function() {
            console.log("queryServerUsers() " + $scope.settings.usernames);
            $scope.users = [];
            $scope.errors = [];
            var url = CONSTANTS.FIVEHUNDRED_PIX_API_URL_BASE + "/v1/users/show";
            var arrayOfUsernames = $scope.settings.usernames.split(regExNotLetterOrNumber);
            console.log(arrayOfUsernames.length + " usernames");
            for (var i = 0; i < arrayOfUsernames.length; i++) {
                console.log("Query user name: " + arrayOfUsernames[i]);
                httpConfig = {
                    method: "GET",
                    params: {
                        username: arrayOfUsernames[i],
                        consumer_key: CONSTANTS.FIVEHUNDRED_PIX_CONSUMER_KEY
                    }
                }
                console.log("URL:" + url + "HTTP Config: " + JSON.stringify(httpConfig));
                $http.get(url, httpConfig).then(function(response) {
                    console.log(response);
                    $scope.users.push(response.data.user);
                    if ($scope.users.length == $scope.users.length) {
                        $scope.saveUsers();
                    }
                }, function(response) {
                    console.log(response);
                    $scope.errors.push(response.data.error + " - Username: " + httpConfig.params.username);
                });
            }
            var userDisplayedIndex = 0;
            var userDisplayedIntervalMillis = 1000;
            if (userDisplayedInterval != null) {
              console.log("Cancel interval");
              $scope.userDisplayed = null;
              $interval.cancel(userDisplayedInterval);
            }
            function userDisplayedFunction() {
                console.log("userDisplayFunction - index: " + userDisplayedIndex);
                $scope.userDisplayed = $scope.users[userDisplayedIndex++];
                if (userDisplayedIndex == $scope.users.length) {
                    userDisplayedIndex = 0;
                }
            }
            userDisplayedInterval = $interval(userDisplayedFunction, userDisplayedIntervalMillis);
        }

        function queryServerPhotos() {
            var url = CONSTANTS.FIVEHUNDRED_PIX_API_URL_BASE + "/v1/photos";
            var httpConfig;
            if ($scope.settings.usersOrFeatures == "features") {
                incrementCategory();
                console.log('queryServerPhotos by category. Settings: ' + JSON.stringify($scope.settings));
                httpConfig = {
                    method: "GET",
                    params: {
                        feature: $scope.settings.feature,
                        only: $scope.settings.currentCategory,
                        page: $scope.getPageNumber(),
                        consumer_key: CONSTANTS.FIVEHUNDRED_PIX_CONSUMER_KEY,
                        rpp: 5,
                        image_size: $scope.settings.imageSize
                    }
                }
            } else {
                incrementUser();
                console.log('queryServerPhotos by user. Settings: ' + JSON.stringify($scope.settings));
                httpConfig = {
                    method: "GET",
                    params: {
                        feature: "user",
                        username: $scope.settings.currentUsername,
                        page: $scope.getPageNumberForUsername(),
                        consumer_key: CONSTANTS.FIVEHUNDRED_PIX_CONSUMER_KEY,
                        rpp: 5,
                        image_size: $scope.settings.imageSize
                    }
                }
            }
            console.log("URL:" + url + "HTTP Config: " + JSON.stringify(httpConfig));
            $http.get(url, httpConfig).success(function(data) {
                $scope.items = data.photos;
                $scope.setPageNumber(data.current_page);
                if ($scope.settings.pageNumber > data.total_pages || data.photos.length == 0) {
                    console.log("Total quantity of pages exceeded. Setting page number back to 1.");
                    if ($scope.settings.usersOrFeatures == 'features') {
                        $scope.setPageNumber(0);
                    } else {
                        $scope.setPageNumberForUser(0);
                    }
                }
                $scope.saveSettings();
                angular.forEach($scope.items, function(item) {
                    var img = new Image();
                    img.src = item.image_url;
                    storePhotoRecord(item);
                });
                document.body.style.cursor = 'none';
                slideshowRoutine();
                timer = setInterval(slideshowRoutine, $scope.settings.seconds * 1000);
            });
        }

        function slideshowRoutine() {
            $scope.slideshowInProgress = true;
            var transaction = db.transaction(["photos"], "readonly");
            var store = transaction.objectStore("photos");
            store.openCursor().onsuccess = function(event) {
                var cursor = event.target.result;
                if (cursor) {
                    var photo = cursor.value;
                    console.log("Read photo from db table: " + photo.id);
                    bodyElement.style.backgroundImage = 'url(' + photo.image_url + ')';
                    movePhoto(photo);
                } else {
                    console.log("Cursor not found.");
                    window.clearInterval(timer);
                    queryServerPhotos();
                }
            };

        }

        window.onload = function() {
            console.log("Document loaded.");
        }
        $scope.selectAllCategories = function() {
            angular.forEach($scope.settings.categories, function(category) {
                category.checked = true;
            });
        }
        $scope.deselectAllCategories = function() {
            angular.forEach($scope.settings.categories, function(category) {
                category.checked = false;
            });
        }
        $scope.saveUsers = function() {
            var arrayOfUsernames = $scope.settings.usernames.split(regExNotLetterOrNumber);
            var arrayOfUsers = [];
            for (var i = 0; i < arrayOfUsernames.length; i++) {
                var username = arrayOfUsernames[i];
                if (isNotBlank(username)) {
                    console.log("User name " + i + ": " + username);
                    var found = false;
                    angular.forEach($scope.settings.users, function(user) {
                        if (user.name == username) {
                            arrayOfUsers.push(user);
                            found = true;
                        }
                    });
                    if (!found) {
                        var user = {
                            "name": username,
                            "pageNumber": 1
                        }
                        arrayOfUsers.push(user);
                    }
                }
            }
            $scope.settings.users = arrayOfUsers;
            $scope.settings.currentUsername = null;
            clearPhotos();
            $scope.saveSettings();
        }

        function incrementUser() {
            console.log("Increment user. Users: " + JSON.stringify($scope.settings.users));
            var nextUser = null;
            var pageNumber = 1;
            var firstUser = null;
            var firstUserPageNumber = 1;
            var found = false;
            angular.forEach($scope.settings.users, function(user) {
                console.log("Increment user: " + JSON.stringify(user));
                if (firstUser == null) {
                    firstUser = user.name;
                    firstUserPageNumber = user.pageNumber;
                    console.log("First user: " + firstUser);
                }
                if (nextUser == null && found) {
                    nextUser = user.name;
                    pageNumber = user.pageNumber;
                    console.log("Next user: " + nextUser + " at page number: " + pageNumber);
                }
                if (user.name == $scope.settings.currentUsername) {
                    found = true;
                    console.log("Current user found: " + user.name);
                }
            });
            if (nextUser == null) {
                if (firstUser != null) {
                    nextUser = firstUser;
                    pageNumber = firstUserPageNumber;
                    console.log("Setting next user to the first user: " + firstUser);
                } else {
                    nextUser = "imagesbylaurie";
                    pageNumber = 1;
                    console.log("Setting next user to default user: " + nextUser);
                }
            }
            pageNumber++;
            console.log("Next user finally is: " + nextUser + " at page number: " + pageNumber);
            $scope.settings.currentUsername = nextUser;
            $scope.setPageNumberForUser(pageNumber);
            $scope.$apply();
            $scope.saveSettings();
        }

        function incrementCategory() {
            var nextCategory = null;
            var pageNumber = 1;
            var firstCategoryChecked = null;
            var firstCategoryCheckedPageNumber = 1;
            var found = false;
            angular.forEach($scope.settings.categories, function(category) {
                console.log("Increment category: " + JSON.stringify(category));
                if (firstCategoryChecked == null && category.checked) {
                    firstCategoryChecked = category.name;
                    firstCategoryCheckedPageNumber = category.pageNumber;
                    console.log("First checked category: " + firstCategoryChecked);
                }
                if (nextCategory == null && found && category.checked) {
                    nextCategory = category.name;
                    pageNumber = category.pageNumber;
                    console.log("Next checked category: " + nextCategory + " at page number: " + pageNumber);
                }
                if (category.name == $scope.settings.currentCategory) {
                    found = true;
                    console.log("Current category found: " + category.name);
                }
            });
            if (nextCategory == null) {
                if (firstCategoryChecked != null) {
                    nextCategory = firstCategoryChecked;
                    pageNumber = firstCategoryCheckedPageNumber;
                    console.log("Setting next category to the first category checked: " + firstCategoryChecked);
                } else {
                    nextCategory = "Nature";
                    pageNumber = 1;
                    console.log("Setting next category to default category: " + nextCategory);
                }
            }
            pageNumber++;
            console.log("Next category finally is: " + nextCategory + " at page number: " + pageNumber);
            $scope.settings.currentCategory = nextCategory;
            $scope.setPageNumber(pageNumber);
            $scope.$apply();
            $scope.saveSettings();
        }
        $scope.getPageNumberForUsername = function() {
            var pageNumber = 1;
            angular.forEach($scope.settings.users, function(user) {
                if ($scope.settings.currentUsername == user.name) {
                    pageNumber = user.pageNumber;
                }
            });
            console.log("Returning page number: " + pageNumber + " for user: " + $scope.settings.currentUsername);
            return pageNumber;
        }
        $scope.getPageNumber = function() {
            var pageNumber = 1;
            angular.forEach($scope.settings.categories, function(category) {
                if ($scope.settings.currentCategory == category.name) {
                    pageNumber = category.pageNumber;
                }
            });
            return pageNumber;
        }
        $scope.setPageNumber = function(pageNumber) {
            console.log("Set page number to: " + pageNumber + " before: " + $scope.getPageNumber());
            angular.forEach($scope.settings.categories, function(category) {
                if ($scope.settings.currentCategory == category.name) {
                    console.log("Current category found.");
                    category.pageNumber = pageNumber;
                }
            });
            console.log("Set page number to: " + pageNumber + " after: " + $scope.getPageNumber());
        }
        $scope.setPageNumberForUser = function(pageNumber) {
            console.log("Set page number to: " + pageNumber + " before: " + $scope.getPageNumber());
            angular.forEach($scope.settings.users, function(user) {
                if ($scope.settings.currentUsername == user.name) {
                    console.log("Current user found.");
                    user.pageNumber = pageNumber;
                }
            });
            console.log("Set page number to: " + pageNumber + " after: " + $scope.getPageNumber());
        }
        $scope.loadDefaultSettings = function() {
            $scope.settings = {};
            $scope.settings.categories = [];
            for (var i = 0; i < categories.length; i++) {
                var category = {
                    "name": categories[i],
                    "pageNumber": 1,
                    "checked": false
                };
                if (familyFriendlyDefaultCategories.indexOf(category.name) != -1) {
                    category.checked = true;
                }
                $scope.settings.categories.push(category);
            }
            $scope.settings.feature = "highest_rated";
            $scope.settings.seconds = 3;
            $scope.settings.currentCategory = "Nature";
            $scope.settings.imageSize = 1080;
            $scope.settings.usersOrFeatures = "features";
            console.log("Loaded default settings: " + JSON.stringify($scope.settings));
        }
        $scope.loadSettings = function() {
            var transaction = db.transaction(["settings"], "readonly");
            var store = transaction.objectStore("settings");
            var request = store.get("main");
            request.onsuccess = function(e) {
                console.log("Got settings: " + request.result);
                if (request.result === null || typeof request.result === 'undefined') {
                    $scope.loadDefaultSettings();
                    $scope.saveSettings();
                } else {
                    $scope.settings = request.result;
                }
                $scope.startSlideshow();
            }
            request.onerror = function(e) {
                console.log("Get settings failed " + request.error);
            }
        }

        $scope.saveSettings = function() {
            if (!db) {
                console.log("DB not ready in saveSettings method.");
                return;
            }
            var transaction = db.transaction(["settings"], "readwrite");
            var store = transaction.objectStore("settings");
            var request = store.put($scope.settings, "main");
            request.onsuccess = function(e) {
                console.log("Write settings successful.");
            }
            request.onerror = function(e) {
                console.log("Write settings failed " + request.error);
            }
        }
    }
]);

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

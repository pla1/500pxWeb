var pdApp = angular
    .module('pdModule', [])
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


pdApp.controller('pdController', ['$scope', '$http', 'CONSTANTS', function($scope, $http, CONSTANTS) {
    var w = window,
        d = document,
        e = d.documentElement,
        g = d.getElementsByTagName('body')[0],
        x = w.innerWidth || e.clientWidth || g.clientWidth,
        y = w.innerHeight || e.clientHeight || g.clientHeight;
    console.log('SCREEN SIZE: ' + x + 'x' + y + ' ' + w.innerWidth + ' ' + w.innerHeight);
    console.log(d.getElementsByTagName('body')[0].clientWidth + ' ' + d.getElementsByTagName('body')[0].clientHeight);
    var bodyElement = document.getElementsByTagName("body")[0];
    bodyElement.style.backgroundSize = 'contain';
    bodyElement.style.backgroundRepeat = 'no-repeat';
    bodyElement.style.backgroundPosition = 'center';
    $scope.settings = {};
    $scope.message = "";
    var slideshowDiv = document.getElementById("slideshowDiv");
    var db;
    var dbOpen = indexedDB.open('500px', 21);
    var timer = null;
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
    }
    dbOpen.onerror = function(e) {
        console.log("DB open error. " + e);
    }

    function storePhoto(data) {
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

    categories = [
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
        log("touchstart event. Slideshow stopped.");
        stopSlideshow();
    });
    document.onkeydown = function(evt) {
        log("onkeydown event. Slideshow stopped.");
        stopSlideshow();
    };
    $scope.startSlideshow = function() {
        $scope.slideshowInProgress = true;
        var transaction = db.transaction(["photos"], "readonly");
        var store = transaction.objectStore("photos");
        var index = store.index("index");
        var request = index.count();
        request.onsuccess = function(e) {
            console.log("Row count: " + request.result);
            if (request.result == 0) {
                queryServer();
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



    function queryServer() {
        incrementCategory();
        console.log('queryServer settings: ' + JSON.stringify($scope.settings));
        var url = CONSTANTS.FIVEHUNDRED_PIX_API_URL_BASE + "/v1/photos";
        var httpConfig = {
            method: "GET",
            params: {
                feature: $scope.settings.feature,
                only: $scope.settings.currentCategory,
                page: $scope.settings.pageNumber,
                consumer_key: CONSTANTS.FIVEHUNDRED_PIX_CONSUMER_KEY,
                rpp: 5,
                image_size: $scope.settings.imageSize
            }
        }
        console.log("URL:" + url + "HTTP Config: " + JSON.stringify(httpConfig));
        $http.get(url, httpConfig).success(function(data) {
            $scope.items = data.photos;
            $scope.settings.pageNumber = data.current_page;
            if ($scope.settings.pageNumber > data.total_pages) {
              console.log("Total quantity of pages exceeded. Setting page number back to 1.");
              $scope.settings.pageNumber = 1;
            }
            $scope.saveSettings();
            angular.forEach($scope.items, function(item) {
                storePhoto(item);
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
                queryServer();
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

    function incrementCategory() {
        var nextCategory = null;
        var firstCategoryChecked = null;
        var found = false;
        angular.forEach($scope.settings.categories, function(category) {
            console.log("Increment category: " + JSON.stringify(category));
            if (firstCategoryChecked == null && category.checked) {
                firstCategoryChecked = category.name;
                console.log("First checked category: " + firstCategoryChecked);
            }
            if (nextCategory == null && found && category.checked) {
                nextCategory = category.name;
                console.log("Next checked category: " + nextCategory);
            }
            if (category.name == $scope.settings.currentCategory) {
                found = true;
                console.log("Current category found: " + category.name);
            }
        });
        if (nextCategory == null) {
            $scope.settings.pageNumber++;
            console.log("next category was null. Incrementing page number to: " + $scope.settings.pageNumber);
            if (firstCategoryChecked != null) {
                nextCategory = firstCategoryChecked;
                console.log("Setting next category to the first category checked: " + firstCategoryChecked);
            } else {
                nextCategory = "Nature";
                console.log("Setting next category to default category: " + nextCategory);
            }
        }
        console.log("Next category finally is: " + nextCategory);
        $scope.settings.currentCategory = nextCategory;
        $scope.$apply();
        $scope.saveSettings();
    }

    $scope.loadDefaultSettings = function() {
        $scope.settings = {};
        $scope.settings.categories = [];
        for (var i = 0; i < categories.length; i++) {
            var category = {
                "name": categories[i],
                "checked": true
            };
            if (category.name == "Nude") {
                category.checked = false;
            }
            $scope.settings.categories.push(category);
        }
        $scope.settings.feature = "highest_rated";
        $scope.settings.seconds = 3;
        $scope.settings.pageNumber = 1;
        $scope.settings.currentCategory = "Nature";
        $scope.settings.imageSize = 1080;
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
}]);

function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}

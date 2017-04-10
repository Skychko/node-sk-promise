# Npm Module

## Install

```sh
$ npm install node-sk-promise
```

## Example

```nodejs
var Promise = require('node-sk-promise');

var pr = new Promise(function(res, rej){
    setTimeout(function(){
        res('World');
    }, 1000);
});

pr.then(function(data){
    console.log('Hello, '+data+'!');
});
```

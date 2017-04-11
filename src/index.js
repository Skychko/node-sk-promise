var PENDING = 1;
var CANCELED = 2;
var REJECTED = 3;
var RESOLVED = 4;

function Pr(fn){
    var _this = this;
    this._state = PENDING;
    this._value = null;
    this._thens_queue = [];
    this._catches_queue = [];
    function res(val){
        if (_this._state !== PENDING)
            return;
        _this._state = RESOLVED;
        _this._value = val;
        _this._run_thens();
    }
    function rej(val){
        if (_this._state !== PENDING)
            return;
        _this._state = REJECTED;
        _this._value = val;
        _this._run_catches();
    }
    if (typeof fn == 'function')
    {
        try {
            fn(res, rej);
        } catch(e){
            this._state = REJECTED;
            this._value = e;
            this._run_catches();
        }
    }
}
// internal functions (can been changed)
Pr.is_promise = function(obj){
    return obj && typeof obj.then == 'function'
        && typeof obj['catch'] == 'function';
};
Pr.get_finished_promise = function(state, value){
    var pr = new Pr();
    pr._state = state;
    pr._value = value;
    return pr;
};
Pr.prototype._run = function(val){
    if (this.state !== PENDING)
        return;
    try {
        var res = this._fn(val);
        if (Pr.is_promise(res))
        {
            switch (res._state)
            {
            case PENDING:
                res._thens_queue = res._thens_queue.concat(this._thens_queue);
                res._catches_queue = res._catches_queue.concat(
                    this._catches_queue);
                return;
            case CANCELED: return this._state = CANCELED;
            case RESOLVED:
                this._state = RESOLVED;
                this._value = res._value;
                this._run_thens();
                return;
            case REJECTED:
                this._state = REJECTED;
                this._value = res._value;
                this._run_catches();
                return;
            }
        }
        else
        {
            this._state = RESOLVED;
            this._value = res;
            this._run_thens();
        }
    } catch(e){
        this._state = REJECTED;
        this._value = e;
        this._run_catches();
    }
};
Pr.prototype._run_catches = function(){
    for (var i = 0; i<this._catches_queue.length; ++i)
        this._catches_queue[i]._run(this._value);
    for (var i = 0; i<this._thens_queue.length; ++i)
        this._thens_queue[i]._run_catches(this._value);
};
Pr.prototype._run_thens = function(){
    for (var i = 0; i<this._thens_queue.length; ++i)
        this._thens_queue[i]._run(this._value);
    for (var i = 0; i<this._catches_queue.length; ++i)
        this._catches_queue[i]._run_thens(this._value);
};
Pr.prototype._finish = function(state, value){
    if (this._state !== PENDING)
        return;
    this._state = state;
    this._value = value;
    switch (this._state)
    {
    case RESOLVED: return this._run_thens();
    case REJECTED: return this._run_catches();
    }
};
// external functions (api fixed)
Pr.resolve = function(val){
    return Pr.get_finished_promise(RESOLVED, val);
};
Pr.reject = function(val){
    return Pr.get_finished_promise(REJECTED, val);
};
Pr.all = function(arr){
    var pr = new Pr();
    if (arr.length === 0)
    {
        pr._finish(RESOLVED, null);
        return pr;
    }
    var len = arr.length;
    var result = [];
    var finished = 0;
    for (var i = 0; i<len; ++i)
    {
        (function(i){
            arr[i]
                .then(function(res){
                    result[i] = res;
                    ++finished;
                    if (finished === len)
                        pr._finish(RESOLVED, result);
                })['catch'](function(res){
                    pr._finish(REJECTED, res);
                });
        })(i);
    }
    return pr;
};
Pr.defer = function(){
    var resolve, reject;
    var promise = new Pr(function(res, rej){
        resolve = res;
        reject = rej;
    });
    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};
Pr.prototype.then = function(fn){
    var res, pr;
    switch(this._state)
    {
    case PENDING:
        var pr = new Pr();
        pr.state = PENDING;
        pr._fn = fn;
        this._thens_queue.push(pr);
        return pr;
    case RESOLVED:
        try {
            res = fn(this._value);
            if (Pr.is_promise(res))
                return res;
            return Pr.get_finished_promise(RESOLVED, res);
        } catch(e){
            return Pr.get_finished_promise(REJECTED, e);
        }
    case REJECTED:
        return this;
    case CANCELED:
        return this;
    }
};
Pr.prototype['catch'] = function(fn){
    var res, pr;
    switch(this._state)
    {
    case PENDING:
        var pr = new Pr();
        pr.state = PENDING;
        pr._fn = fn;
        this._catches_queue.push(pr);
        return pr;
    case RESOLVED:
        return this;
    case REJECTED:
        try {
            res = pr(this._value);
            if (Pr.is_promise(res))
                return res;
            return Pr.get_finished_promise(RESOLVED, res);
        } catch(e){
            return Pr.get_finished_promise(REJECTED, res);
        }
    case CANCELED:
        return this;
    }
};
// wrapper for IE9
Pr.prototype._catch = Pr.prototype['catch'];
Pr.prototype.cancel = function(){
    if (this._state === PENDING)
        this._state = CANCELED;
    return this;
};
Pr.prototype.isCancelled = function(){
    return this._state === CANCELED;
};
Pr.prototype.isRejected = function(){
    return this._state === REJECTED;
};
Pr.prototype.isResolved = function(){
    return this._state === RESOLVED;
};
Pr.prototype.isPending = function(){
    return this._state === PENDING;
};

module.exports = Pr;
